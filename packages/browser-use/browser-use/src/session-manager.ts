/**
 * 功能：持有 LFAA 隔离 Chromium BrowserContext 与可见页面状态。
 * 作用：Agent Tools 与右 Dock 读取/操控同一会话；不附着用户个人浏览器 Profile。
 * 关联文件：index.ts、packages/api/browser-controller、packages/client/ui-sidebar-browser。
 */
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { isPublicMcpAddress, resolveMcpEndpoint } from "lfaa-mcp-client/src/network.js";
import type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";
import { TabbitBrowserProvider, type TabbitTabSummary } from "./tabbit-provider.js";

const SESSION_IDLE_TTL_MS = 30 * 60_000;
const SESSION_SWEEP_MS = 60_000;
const MAX_SESSIONS = 24;
const MAX_SESSIONS_PER_USER = 4;
const MAX_PAGE_COUNT = 8;
const MAX_PAGE_TEXT = 16_000;
const MAX_INTERACTIVE_ITEMS = 80;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const PAGE_ACTION_TIMEOUT_MS = 8_000;
const SENSITIVE_FIELD = /(?:password|passcode|secret|token|api[\s_-]?key|authorization|验证码|密码|密钥|令牌)/iu;
export const BROWSER_ALLOWED_KEYS = ["Enter", "Tab", "Shift+Tab", "Escape", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "PageDown", "PageUp", "Space", "Backspace", "Delete", "Control+A", "Meta+A", "Control+C", "Control+V", "Control+X", "Control+Z", "Control+Y", "Meta+C", "Meta+V", "Meta+X", "Meta+Z", "Meta+Y"] as const;
const BROWSER_ALLOWED_KEY_SET: ReadonlySet<string> = new Set(BROWSER_ALLOWED_KEYS);

export interface BrowserProviderSummary { id: BrowserProviderId; name: string; available: boolean; reason?: string; isolation: "app-session" | "new-profile" | "user-profile" }
export interface BrowserTabSummary { id: string; title: string; url: string; active: boolean }
export interface BrowserSnapshot {
  sessionId: string;
  providerId: BrowserProviderId;
  revision: number;
  url: string;
  title: string;
  pageText: string;
  controls: Array<{ role: string; name: string; type?: string; disabled: boolean }>;
  tabs: BrowserTabSummary[];
  screenshot: { mimeType: "image/jpeg"; dataBase64: string; width: number; height: number } | null;
}
export interface BrowserRevision { revision: number; url: string; title: string }
export interface BrowserDragPoint { x: number; y: number; delayMs: number }
export interface BrowserRunAdapterContext {
  ownerId: string;
  sourceSessionId: string;
  runId: string;
  signal: AbortSignal;
  onRunDispose: (cleanup: () => void) => void;
}
export interface BrowserRunAdapter {
  readonly runId: string;
  listTabs(): Promise<TabbitTabSummary[]>;
  claimTab(tabId: number): Promise<BrowserSnapshot>;
  navigate(providerId: BrowserProviderId, url: string): Promise<BrowserSnapshot>;
  navigateProjectPreview(providerId: BrowserProviderId, preview: { url: string; close: () => Promise<void> }): Promise<BrowserSnapshot>;
  observe(providerId: BrowserProviderId): Promise<BrowserSnapshot>;
  click(providerId: BrowserProviderId, role: string, name: string): Promise<BrowserSnapshot>;
  fill(providerId: BrowserProviderId, label: string, value: string): Promise<BrowserSnapshot>;
  pressKey(providerId: BrowserProviderId, key: string): Promise<BrowserSnapshot>;
  scroll(providerId: BrowserProviderId, direction: "up" | "down", amount: number): Promise<BrowserSnapshot>;
}

interface BrowserSession {
  id: string;
  ownerId: string;
  sourceSessionId: string;
  providerId: BrowserProviderId;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastUsedAt: number;
  revision: number;
  operationTail: Promise<void>;
  allowedLocalOrigin: string | null;
  projectPreview: { url: string; close: () => Promise<void> } | null;
  ownsContext: boolean;
  nativePageHandlers?: Map<Page, { domcontentloaded: () => void; close: () => void; framenavigated: (frame: import("playwright-core").Frame) => void }>;
  nativePageListener?: (page: Page) => void;
  disposed: boolean;
}

function sessionKey(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId): string {
  return createHash("sha256").update(`${ownerId}\0${sourceSessionId}\0${providerId}`).digest("hex");
}

function availableChannels(): Array<{ id: BrowserProviderId; name: string; channel: "msedge" | "chrome"; paths: string[] }> {
  if (process.platform === "win32") {
    const programs = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA].filter((item): item is string => Boolean(item));
    return [
      { id: "lfaa-managed-edge", name: "LFAA 隔离浏览器 · Edge", channel: "msedge", paths: programs.map(root => join(root, "Microsoft", "Edge", "Application", "msedge.exe")) },
      { id: "lfaa-managed-chrome", name: "LFAA 隔离浏览器 · Chrome", channel: "chrome", paths: programs.map(root => join(root, "Google", "Chrome", "Application", "chrome.exe")) }
    ];
  }
  if (process.platform === "darwin") {
    return [
      { id: "lfaa-managed-edge", name: "LFAA 隔离浏览器 · Edge", channel: "msedge", paths: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", join(process.env.HOME ?? "", "Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")] },
      { id: "lfaa-managed-chrome", name: "LFAA 隔离浏览器 · Chrome", channel: "chrome", paths: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", join(process.env.HOME ?? "", "Applications/Google Chrome.app/Contents/MacOS/Google Chrome")] }
    ];
  }
  return [];
}

function validateNavigationUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("浏览器地址必须是有效 URL。"); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) {
    throw new Error("浏览器只允许不含账号密码的 HTTP(S) 地址。");
  }
  return url;
}

function isSensitiveField(label: string, type?: string): boolean {
  return type?.toLowerCase() === "password" || SENSITIVE_FIELD.test(label);
}

export class BrowserSessionManager {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly sessionKeys = new Map<string, string>();
  private readonly runAdapters = new Map<string, { adapter: BrowserRunAdapter; signal: AbortSignal; dispose: () => void }>();
  private readonly channels = availableChannels();
  private readonly sweepTimer = setInterval(() => { void Promise.all([this.sweepExpired(), this.tabbit.sweepExpired()]).catch(() => undefined); }, SESSION_SWEEP_MS);
  private readonly browsers = new Map<"msedge" | "chrome" | "native", Promise<Browser>>();
  private readonly nativeActiveTargets = new Map<string, string>();
  private readonly tabbit: TabbitBrowserProvider;
  private readonly nativeCdpPortFile = process.env.LFAA_ELECTRON_CDP_PORT_FILE?.trim() ?? "";
  private readonly nativeAppOrigin = process.env.LFAA_ELECTRON_BROWSER_APP_ORIGIN?.trim() ?? "";
  private disposed = false;

  constructor(private readonly localHostExecution: boolean) {
    this.tabbit = new TabbitBrowserProvider(localHostExecution);
    this.sweepTimer.unref?.();
  }

  createRunAdapter(binding: BrowserRunAdapterContext): BrowserRunAdapter {
    const { ownerId, sourceSessionId, runId, signal, onRunDispose } = binding;
    if (this.disposed) throw new Error("Browser Owner 已关闭。");
    if (!ownerId || ownerId.length > 256 || ownerId.includes("\0") || !sourceSessionId || sourceSessionId.length > 160 || sourceSessionId.includes("\0") || !runId || runId.length > 160 || runId.includes("\0")) {
      throw new Error("浏览器 Run 必须绑定有效账户、LFAA Session 与 Agent Run。");
    }
    if (!signal || typeof signal.addEventListener !== "function" || typeof onRunDispose !== "function") {
      throw new Error("当前 Agent Run 缺少取消信号或资源清理入口。");
    }
    signal.throwIfAborted();
    const key = createHash("sha256").update(JSON.stringify([ownerId, sourceSessionId, runId])).digest("hex");
    const existing = this.runAdapters.get(key);
    if (existing) {
      if (existing.signal !== signal) throw new Error("同一浏览器 Run 收到了不一致的取消信号。");
      return existing.adapter;
    }

    let active = true;
    const invoke = <T>(operation: () => Promise<T>): Promise<T> => {
      if (!active || this.disposed) throw new Error("当前 Agent Run 的浏览器桥接已结束。");
      signal.throwIfAborted();
      return operation();
    };
    const adapter: BrowserRunAdapter = Object.freeze({
      runId,
      listTabs: (): Promise<TabbitTabSummary[]> => invoke(() => this.listTabs(ownerId, sourceSessionId, "tabbit-personal", signal)),
      claimTab: (tabId: number): Promise<BrowserSnapshot> => invoke(() => this.claimTab(ownerId, sourceSessionId, "tabbit-personal", tabId, signal)),
      navigate: (providerId: BrowserProviderId, url: string): Promise<BrowserSnapshot> => invoke(() => this.navigate(ownerId, sourceSessionId, providerId, url, signal)),
      navigateProjectPreview: (providerId: BrowserProviderId, preview: { url: string; close: () => Promise<void> }): Promise<BrowserSnapshot> => invoke(() => this.navigateProjectPreview(ownerId, sourceSessionId, providerId, preview, signal)),
      observe: (providerId: BrowserProviderId): Promise<BrowserSnapshot> => invoke(() => this.observeForRun(ownerId, sourceSessionId, providerId, signal)),
      click: (providerId: BrowserProviderId, role: string, name: string): Promise<BrowserSnapshot> => invoke(() => this.click(ownerId, sourceSessionId, providerId, role, name, signal)),
      fill: (providerId: BrowserProviderId, label: string, value: string): Promise<BrowserSnapshot> => invoke(() => this.fill(ownerId, sourceSessionId, providerId, label, value, signal)),
      pressKey: (providerId: BrowserProviderId, key: string): Promise<BrowserSnapshot> => invoke(() => this.pressKey(ownerId, sourceSessionId, providerId, key, signal)),
      scroll: (providerId: BrowserProviderId, direction: "up" | "down", amount: number): Promise<BrowserSnapshot> => invoke(() => this.scroll(ownerId, sourceSessionId, providerId, direction, amount, signal))
    });
    const dispose = () => {
      if (!active) return;
      active = false;
      if (this.runAdapters.get(key)?.adapter === adapter) this.runAdapters.delete(key);
    };
    this.runAdapters.set(key, { adapter, signal, dispose });
    try {
      onRunDispose(dispose);
    } catch (error) {
      dispose();
      throw error;
    }
    return adapter;
  }

  listProviders(): BrowserProviderSummary[] {
    if (!this.localHostExecution) return [];
    const providers: BrowserProviderSummary[] = this.channels.map(channel => {
      const executableExists = channel.paths.some(path => existsSync(path));
      return {
        id: channel.id,
        name: channel.name,
        available: executableExists,
        ...(!executableExists ? { reason: `未在当前系统位置发现 ${channel.channel === "msedge" ? "Microsoft Edge" : "Google Chrome"}。` } : {}),
        isolation: "new-profile" as const
      };
    });
    if (this.nativeCdpPortFile) {
      const port = this.readNativeCdpPort();
      providers.unshift({
        id: "lfaa-native-browser",
        name: "LFAA 原生浏览器",
        available: port !== null,
        ...(port === null ? { reason: "Electron 原生浏览器的本机连接尚未就绪。" } : {}),
        isolation: "app-session"
      });
    }
    providers.push({ id: "tabbit-personal", name: "Tabbit Browser · 个人会话", available: this.tabbit.isAvailable(), ...(!this.tabbit.isAvailable() ? { reason: "未在当前账户稳定启动器位置发现 Tabbit LocalAgent。" } : {}), isolation: "user-profile" as const });
    return providers;
  }

  async setNativeActiveTarget(ownerId: string, sourceSessionId: string, targetId: string): Promise<void> {
    if (!this.nativeCdpPortFile || !/^[a-zA-Z0-9_-]{1,128}$/u.test(targetId)) throw new Error("原生浏览器标签标识无效。");
    const key = sessionKey(ownerId, sourceSessionId, "lfaa-native-browser");
    const existingId = this.sessionKeys.get(key);
    const existing = existingId ? this.sessions.get(existingId) : undefined;
    if (existing && !existing.disposed) {
      await this.exclusive(existing, async () => {
        const match = await this.findNativePageInBrowser(existing.browser, targetId);
        if (!match) throw new Error("当前活动的原生浏览器标签尚未出现在 Chromium 中。");
        if (match.context !== existing.context) {
          if (existing.nativePageListener) existing.context.off("page", existing.nativePageListener);
          for (const [watchedPage, handlers] of existing.nativePageHandlers ?? []) {
            watchedPage.off("domcontentloaded", handlers.domcontentloaded);
            watchedPage.off("close", handlers.close);
            watchedPage.off("framenavigated", handlers.framenavigated);
          }
          existing.context = match.context;
          existing.nativePageHandlers = new Map();
          for (const watchedPage of match.context.pages()) this.watchNativePage(existing, watchedPage);
          existing.nativePageListener = watchedPage => this.watchNativePage(existing, watchedPage);
          match.context.on("page", existing.nativePageListener);
        }
        const page = match.page;
        existing.page = page;
        this.watchNativePage(existing, page);
        existing.revision += 1;
        this.touch(existing);
      });
    }
    this.nativeActiveTargets.delete(key);
    this.nativeActiveTargets.set(key, targetId);
    while (this.nativeActiveTargets.size > 128) this.nativeActiveTargets.delete(this.nativeActiveTargets.keys().next().value!);
  }

  async listTabs(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<TabbitTabSummary[]> {
    if (providerId !== "tabbit-personal") throw new Error("此浏览器提供方不需要连接个人标签列表。");
    return this.tabbit.listTabs(ownerId, sourceSessionId, signal);
  }

  async claimTab(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, tabId: number, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId !== "tabbit-personal") throw new Error("只有 Tabbit 个人浏览器支持连接已有标签。");
    return this.tabbit.claimTab(ownerId, sourceSessionId, tabId, signal);
  }

  async getPanelSnapshot(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, includeScreenshot = true): Promise<BrowserSnapshot | null> {
    if (providerId === "tabbit-personal") return this.tabbit.getPanelSnapshot(ownerId, sourceSessionId, includeScreenshot);
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed) return null;
    return this.exclusive(session, () => this.observe(session, providerId === "lfaa-native-browser" ? false : includeScreenshot));
  }

  async resizeViewport(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, width: number, height: number, signal?: AbortSignal): Promise<BrowserSnapshot | null> {
    if (providerId === "tabbit-personal") throw new Error("Tabbit 个人浏览器的视口由用户控制，LFAA 不会调整其窗口尺寸。");
    if (providerId === "lfaa-native-browser") throw new Error("原生浏览器视口由当前工作区布局控制。");
    if (!Number.isInteger(width) || width < 320 || width > MAX_IMAGE_DIMENSION || !Number.isInteger(height) || height < 400 || height > 1600) {
      throw new Error("浏览器工作区视口尺寸超出允许范围。");
    }
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed) return null;
    signal?.throwIfAborted();
    return this.exclusive(session, async () => {
      const current = session.page.viewportSize();
      if (current?.width !== width || current?.height !== height) {
        await session.page.setViewportSize({ width, height });
        session.revision += 1;
      }
      this.touch(session);
      return this.observe(session, true);
    }, signal);
  }

  async getPanelRevision(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<BrowserRevision | null> {
    if (providerId === "tabbit-personal") return this.tabbit.getPanelRevision(ownerId, sourceSessionId, signal);
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed || session.page.isClosed()) return null;
    this.touch(session);
    return { revision: session.revision, url: session.page.url().slice(0, 2048), title: await session.page.title().catch(() => "") };
  }

  async navigate(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, value: string, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.navigate(ownerId, sourceSessionId, value, signal);
    const url = validateNavigationUrl(value);
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, async () => {
      const keepsProjectPreview = session.projectPreview !== null && url.origin === new URL(session.projectPreview.url).origin;
      if (keepsProjectPreview) session.allowedLocalOrigin = url.origin;
      else {
        await this.closeProjectPreview(session);
        session.allowedLocalOrigin = null;
      }
      await this.assertTarget(session, url, true);
      if (await this.isPrivateOrigin(url)) session.allowedLocalOrigin = url.origin;
      await session.page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
      this.touch(session);
      return this.observe(session, true);
    }, signal);
  }

  async navigateProjectPreview(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, preview: { url: string; close: () => Promise<void> }, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") throw new Error("工作区文件只能在 LFAA 隔离浏览器中预览，不会传给个人浏览器。");
    const url = validateNavigationUrl(preview.url);
    if (url.hostname !== "127.0.0.1" || typeof preview.close !== "function") throw new Error("项目预览源必须是受限的本机只读服务。");
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, async () => {
      await this.closeProjectPreview(session);
      session.allowedLocalOrigin = url.origin;
      session.projectPreview = preview;
      try {
        await this.assertTarget(session, url, true);
        await session.page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
        this.touch(session);
        return await this.observe(session, true);
      } catch (error) {
        await this.closeProjectPreview(session);
        session.allowedLocalOrigin = null;
        throw error;
      }
    }, signal);
  }

  async observeForRun(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.observe(ownerId, sourceSessionId, signal);
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, () => this.observe(session, true), signal);
  }

  async back(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "back", {}, signal);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.goBack({ waitUntil: "domcontentloaded", timeout: 10_000 }), signal);
  }

  async forward(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "forward", {}, signal);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.goForward({ waitUntil: "domcontentloaded", timeout: 10_000 }), signal);
  }

  async reload(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "reload", {}, signal);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }), signal);
  }

  async click(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, role: string, name: string, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "click", { role, name }, signal);
    const allowedRoles = new Set(["button", "link", "checkbox", "radio", "tab", "menuitem", "option"]);
    if (!allowedRoles.has(role) || !name.trim() || name.length > 160) throw new Error("点击目标必须来自页面快照中的可访问角色和名称。");
    return this.usePage(ownerId, sourceSessionId, providerId, async page => {
      const target = page.getByRole(role as "button", { name: name.trim(), exact: true }).first();
      await target.click({ timeout: PAGE_ACTION_TIMEOUT_MS });
    }, signal);
  }

  async fill(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, label: string, value: string, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "fill", { label, value }, signal);
    if (!label.trim() || label.length > 160 || value.length > 4000) throw new Error("输入目标或内容超出允许范围。");
    if (isSensitiveField(label)) throw new Error("密码、验证码、令牌和密钥需由用户在页面中自行输入，LFAA 不代填或读取。");
    return this.usePage(ownerId, sourceSessionId, providerId, async page => {
      const target = page.getByRole("textbox", { name: label.trim(), exact: true }).first();
      const type = await target.getAttribute("type", { timeout: PAGE_ACTION_TIMEOUT_MS }).catch(() => null);
      if (isSensitiveField(label, type ?? undefined)) throw new Error("密码、验证码、令牌和密钥需由用户在页面中自行输入，LFAA 不代填或读取。");
      await target.fill(value, { timeout: PAGE_ACTION_TIMEOUT_MS });
    }, signal);
  }

  async typeText(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, text: string, signal?: AbortSignal, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (!text || text.length > 2000) throw new Error("单次输入文字需在 1–2000 个字符内。");
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "type-text", { text }, signal, includeScreenshot);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.keyboard.insertText(text), signal, includeScreenshot);
  }

  async pressKey(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, key: string, signal?: AbortSignal, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "press-key", { key }, signal, includeScreenshot);
    if (!BROWSER_ALLOWED_KEY_SET.has(key)) throw new Error("此按键不在浏览器工具允许列表中。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.keyboard.press(key), signal, includeScreenshot);
  }

  async scroll(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, direction: "up" | "down", amount: number, signal?: AbortSignal, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "scroll", { direction, amount }, signal, includeScreenshot);
    if (!Number.isInteger(amount) || amount < 1 || amount > 600) throw new Error("滚动距离必须在 1–600 像素内。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.mouse.wheel(0, direction === "down" ? amount : -amount), signal, includeScreenshot);
  }

  async clickAt(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, x: number, y: number, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "clickAt", { x, y }, signal);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 4096 || y > 4096) throw new Error("坐标超出浏览器视口边界。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.mouse.click(x, y), signal);
  }

  async dragAt(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, x: number, y: number, points: readonly BrowserDragPoint[], signal?: AbortSignal): Promise<BrowserSnapshot> {
    const validPoint = (point: BrowserDragPoint) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0 && point.x <= 4096 && point.y <= 4096 && Number.isInteger(point.delayMs) && point.delayMs >= 0 && point.delayMs <= 1000;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 4096 || y > 4096 || points.length < 1 || points.length > 128 || points.some(point => !validPoint(point)) || points.reduce((total, point) => total + point.delayMs, 0) > 15_000) {
      throw new Error("网页拖动路径无效或超出长度、坐标与时间限制。");
    }
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "dragAt", { x, y, points }, signal);
    return this.usePage(ownerId, sourceSessionId, providerId, async page => {
      await page.mouse.move(x, y);
      await page.mouse.down();
      try {
        for (const point of points) {
          if (point.delayMs) await page.waitForTimeout(point.delayMs);
          await page.mouse.move(point.x, point.y);
        }
      } finally {
        if (!page.isClosed()) await page.mouse.up().catch(() => undefined);
      }
    }, signal);
  }

  async closeSession(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId): Promise<void> {
    if (providerId === "tabbit-personal") return this.tabbit.closeSession(ownerId, sourceSessionId);
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    if (!id) return;
    const session = this.sessions.get(id);
    if (session) await this.disposeSession(session);
  }

  async closeProviderSessions(ownerId: string, providerId: BrowserProviderId): Promise<void> {
    if (providerId === "tabbit-personal") {
      await this.tabbit.closeOwnerSessions(ownerId);
      return;
    }
    const owned = [...this.sessions.values()].filter(session => session.ownerId === ownerId && session.providerId === providerId);
    await Promise.all(owned.map(session => this.disposeSession(session)));
  }

  async closeAll(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.sweepTimer);
    for (const entry of this.runAdapters.values()) entry.dispose();
    this.runAdapters.clear();
    await this.tabbit.closeAll();
    await Promise.all([...this.sessions.values()].map(session => this.disposeSession(session)));
    const browsers = await Promise.all([...this.browsers.values()].map(browser => browser.catch(() => null)));
    this.browsers.clear();
    await Promise.all(browsers.map(browser => browser?.close().catch(() => undefined)));
  }

  private async getOrCreate(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId): Promise<BrowserSession> {
    if (this.disposed || !this.localHostExecution) throw new Error("LFAA 隔离浏览器只在本机 Web/Desktop Host 中可用。");
    if (sourceSessionId.length < 1 || sourceSessionId.length > 160) throw new Error("浏览器会话必须绑定当前 LFAA Session。");
    const isNativeProvider = providerId === "lfaa-native-browser";
    const provider = this.channels.find(item => item.id === providerId);
    if (!provider && !isNativeProvider) throw new Error("所选浏览器提供方不受当前 Host 支持。");
    if (provider && !provider.paths.some(path => existsSync(path))) throw new Error(`未发现 ${provider.name} 的已安装浏览器。`);
    if (isNativeProvider && this.readNativeCdpPort() === null) throw new Error("LFAA Electron 原生浏览器连接尚未就绪。");
    const key = sessionKey(ownerId, sourceSessionId, providerId), existingId = this.sessionKeys.get(key);
    const existing = existingId ? this.sessions.get(existingId) : undefined;
    if (existing && !existing.disposed && !existing.page.isClosed()) { this.touch(existing); return existing; }
    if (existing && !existing.disposed) await this.disposeSession(existing);
    if (this.sessions.size >= MAX_SESSIONS || [...this.sessions.values()].filter(session => session.ownerId === ownerId).length >= MAX_SESSIONS_PER_USER) {
      throw new Error("浏览器会话达到当前账户的并发上限；先关闭不再使用的浏览器会话。");
    }
    const browser = await this.getBrowser(isNativeProvider ? "native" : provider!.channel);
    const nativeTargetId = this.nativeActiveTargets.get(key) ?? "";
    if (isNativeProvider && !nativeTargetId) throw new Error("请在浏览器工作区选择要交给 Agent 操作的标签页。");
    let context: BrowserContext;
    let page: Page | null;
    if (isNativeProvider) {
      const match = await this.findNativePageInBrowser(browser, nativeTargetId);
      if (!match) throw new Error("当前活动的原生浏览器标签尚未出现在 Chromium 中；切回浏览器标签后重试。");
      context = match.context;
      page = match.page;
    } else {
      context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: "block" });
      page = await context.newPage();
    }
    if (!page) throw new Error("原生浏览器里没有可接管的网页标签；先在右侧工作区打开一个标签。");
    const session: BrowserSession = {
      id: randomUUID(), ownerId, sourceSessionId, providerId, browser, context,
      page, lastUsedAt: Date.now(), revision: 0,
      operationTail: Promise.resolve(), allowedLocalOrigin: null, projectPreview: null,
      ownsContext: !isNativeProvider, disposed: false
    };
    if (isNativeProvider) {
      session.nativePageHandlers = new Map();
      const watchPage = (watchedPage: Page) => this.watchNativePage(session, watchedPage);
      session.nativePageListener = watchedPage => watchPage(watchedPage);
      for (const watchedPage of context.pages()) watchPage(watchedPage);
      context.on("page", session.nativePageListener);
      this.sessions.set(session.id, session);
      this.sessionKeys.set(key, session.id);
      return session;
    }
    let lastChangeNotificationAt = 0;
    await context.exposeBinding("__lfaaBrowserChanged", () => {
      const now = Date.now();
      if (now - lastChangeNotificationAt < 250) return;
      lastChangeNotificationAt = now;
      session.revision += 1;
    });
    await context.addInitScript(`(() => { let queued = false; const observer = new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; void window.__lfaaBrowserChanged?.(); }); }); observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); window.addEventListener("pagehide", () => observer.disconnect(), { once: true }); })();`);
    await context.route("**/*", route => {
      const requestUrl = route.request().url();
      if (/^(?:about:|blob:|data:)/iu.test(requestUrl)) { void route.continue(); return; }
      void this.guardRequest(session, requestUrl).then(() => route.continue()).catch(() => route.abort("blockedbyclient"));
    });
    context.on("page", page => {
      if (context.pages().length > MAX_PAGE_COUNT) { void page.close().catch(() => undefined); return; }
      session.page = page;
      session.revision += 1;
      page.on("domcontentloaded", () => { session.revision += 1; });
      page.on("close", () => { session.revision += 1; });
    });
    session.page.on("domcontentloaded", () => { session.revision += 1; });
    session.page.on("close", () => { session.revision += 1; });
    this.sessions.set(session.id, session);
    this.sessionKeys.set(key, session.id);
    return session;
  }

  private async getBrowser(channel: "msedge" | "chrome" | "native"): Promise<Browser> {
    let browserPromise = this.browsers.get(channel);
    if (!browserPromise) {
      browserPromise = channel === "native"
        ? this.connectNativeBrowser()
        : chromium.launch({ channel, headless: true, timeout: 15_000 }).catch(error => {
        this.browsers.delete(channel);
        throw new Error(`隔离浏览器启动失败：${error instanceof Error ? error.message : "未知错误"}`);
      });
      this.browsers.set(channel, browserPromise);
    }
    return browserPromise;
  }

  private readNativeCdpPort(): number | null {
    if (!this.nativeCdpPortFile || !existsSync(this.nativeCdpPortFile)) return null;
    try {
      const port = Number(readFileSync(this.nativeCdpPortFile, "utf8").split(/\r?\n/u, 1)[0]);
      return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
    } catch { return null; }
  }

  private async connectNativeBrowser(): Promise<Browser> {
    const port = this.readNativeCdpPort();
    if (!port) throw new Error("LFAA Electron 原生浏览器调试端口尚未就绪。");
    try { return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 8_000 }); }
    catch (error) { throw new Error(`连接 LFAA 原生浏览器失败：${error instanceof Error ? error.message : "未知错误"}`); }
  }

  private watchNativePage(session: BrowserSession, page: Page): void {
    if (session.disposed || page.isClosed() || this.isNativeAppPage(page) || session.nativePageHandlers?.has(page)) return;
    const handlers = {
      domcontentloaded: () => { if (!session.disposed) session.revision += 1; },
      close: () => { if (!session.disposed) session.revision += 1; },
      framenavigated: (frame: import("playwright-core").Frame) => { if (!session.disposed && frame === page.mainFrame()) session.revision += 1; }
    };
    session.nativePageHandlers?.set(page, handlers);
    page.on("domcontentloaded", handlers.domcontentloaded);
    page.on("close", handlers.close);
    page.on("framenavigated", handlers.framenavigated);
  }

  private isNativeAppPage(page: Page): boolean {
    if (!this.nativeAppOrigin) return false;
    try { return new URL(page.url()).origin === this.nativeAppOrigin; } catch { return false; }
  }

  private async readPageTargetId(page: Page): Promise<string> {
    let client;
    try {
      client = await page.context().newCDPSession(page);
      const result = await client.send("Target.getTargetInfo");
      return typeof result?.targetInfo?.targetId === "string" ? result.targetInfo.targetId : "";
    } catch { return ""; }
    finally { await client?.detach().catch(() => undefined); }
  }

  private async findNativePage(context: BrowserContext, targetId: string): Promise<Page | null> {
    const pages = context.pages().filter(page => !page.isClosed() && !this.isNativeAppPage(page));
    for (const page of pages) if (await this.readPageTargetId(page) === targetId) return page;
    return null;
  }

  private async findNativePageInBrowser(browser: Browser, targetId: string): Promise<{ context: BrowserContext; page: Page } | null> {
    if (!targetId) return null;
    for (const context of browser.contexts()) {
      const page = await this.findNativePage(context, targetId);
      if (page) return { context, page };
    }
    return null;
  }

  private async isPrivateOrigin(url: URL): Promise<boolean> {
    const endpoint = await resolveMcpEndpoint(url, true);
    return endpoint.addresses.some(item => !isPublicMcpAddress(item.address));
  }

  private async assertTarget(session: BrowserSession, url: URL, explicitNavigation = false): Promise<void> {
    if (session.allowedLocalOrigin && url.origin === session.allowedLocalOrigin) return;
    try { await resolveMcpEndpoint(url, false); return; }
    catch {
      if (explicitNavigation) {
        try {
          const endpoint = await resolveMcpEndpoint(url, true);
          if (endpoint.addresses.length && endpoint.addresses.some(item => !isPublicMcpAddress(item.address))) return;
        } catch { /* 解析失败仍拒绝。 */ }
      }
      throw new Error("浏览器目标无法解析为公网地址；仅本轮直接指定的本机预览源可访问本机地址。");
    }
  }

  private async guardRequest(session: BrowserSession, input: string): Promise<void> {
    const url = validateNavigationUrl(input);
    if (session.projectPreview && url.origin !== new URL(session.projectPreview.url).origin) {
      throw new Error("工作区 HTML 预览只加载当前项目文件；打开外部网址需由 Agent 或用户明确导航。");
    }
    if (session.allowedLocalOrigin && url.origin === session.allowedLocalOrigin) return;
    await this.assertTarget(session, url);
  }

  private async usePage(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, action: (page: Page) => Promise<unknown>, signal?: AbortSignal, includeScreenshot = true): Promise<BrowserSnapshot> {
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, async () => {
      await action(session.page);
      this.touch(session);
      return this.observe(session, includeScreenshot);
    }, signal);
  }

  private async observe(session: BrowserSession, includeScreenshot: boolean): Promise<BrowserSnapshot> {
    this.touch(session);
    const page = session.page;
    if (page.isClosed()) throw new Error("当前浏览器标签已关闭；请重新打开 LFAA 隔离浏览器。");
    const [title, pageText, controls, screenshot, tabs] = await Promise.all([
      page.title().catch(() => ""),
      page.locator("body").innerText({ timeout: 4_000 }).catch(() => ""),
      page.locator("a,button,input,textarea,select,[role=button],[role=link],[role=textbox]").evaluateAll<BrowserSnapshot["controls"], number>((elements, limit) => elements.slice(0, limit).filter(node => node.getClientRects().length > 0 && !node.closest('[aria-hidden="true"]')).map(node => {
        const isInput = node.tagName === "INPUT";
        const innerText = (node as typeof node & { innerText?: string }).innerText;
        const label = node.getAttribute("aria-label") || innerText || (isInput ? node.getAttribute("placeholder") : null) || node.getAttribute("title") || "";
        const name = label.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 160);
        const type = isInput ? node.getAttribute("type") || "text" : undefined;
        const role = node.getAttribute("role") || (node.tagName === "A" ? "link" : node.tagName === "BUTTON" ? "button" : node.tagName === "INPUT" ? (type === "checkbox" ? "checkbox" : type === "radio" ? "radio" : "textbox") : node.tagName === "TEXTAREA" ? "textbox" : node.tagName === "SELECT" ? "combobox" : node.tagName.toLowerCase());
        return { role, name: type === "password" || /password|passcode|secret|token|api[\s_-]?key|authorization|验证码|密码|密钥|令牌/iu.test(name) ? "受保护的敏感字段" : name, ...(type && type !== "password" ? { type } : {}), disabled: node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true" };
      }).filter(item => item.name).slice(0, limit), MAX_INTERACTIVE_ITEMS).catch(() => [] as BrowserSnapshot["controls"]),
      includeScreenshot ? this.captureScreenshot(page) : Promise.resolve(null),
      Promise.all(session.context.pages().filter(tab => session.providerId !== "lfaa-native-browser" || !this.isNativeAppPage(tab)).slice(0, MAX_PAGE_COUNT).map(async (tab, index) => ({ id: String(index), title: await tab.title().catch(() => ""), url: tab.url().slice(0, 2048), active: tab === page })))
    ]);
    const normalizedText = pageText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").slice(0, MAX_PAGE_TEXT);
    return { sessionId: session.id, providerId: session.providerId, revision: session.revision, url: page.url().slice(0, 2048), title: title.slice(0, 300), pageText: normalizedText, controls, tabs, screenshot };
  }

  private async captureScreenshot(page: Page): Promise<BrowserSnapshot["screenshot"]> {
    try {
      let data = await page.screenshot({ type: "jpeg", quality: 68, animations: "disabled", fullPage: false, timeout: 5_000 });
      if (data.byteLength > MAX_SCREENSHOT_BYTES) data = await page.screenshot({ type: "jpeg", quality: 60, animations: "disabled", fullPage: false, timeout: 5_000 });
      if (!data.byteLength || data.byteLength > MAX_SCREENSHOT_BYTES) return null;
      const viewport = page.viewportSize() ?? { width: MAX_IMAGE_DIMENSION, height: 800 };
      return { mimeType: "image/jpeg", dataBase64: data.toString("base64"), width: Math.min(viewport.width, MAX_IMAGE_DIMENSION), height: viewport.height };
    } catch { return null; }
  }

  private async exclusive<T>(session: BrowserSession, operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    const pending = session.operationTail.then(async () => {
      if (session.disposed) throw new Error("浏览器会话已关闭。");
      return operation();
    });
    session.operationTail = pending.then(() => undefined, () => undefined);
    if (!signal) return pending;
    let abortListener: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      abortListener = () => {
        void this.disposeSession(session);
        reject(new Error("浏览器操作已取消。"));
      };
      signal.addEventListener("abort", abortListener, { once: true });
    });
    try { return await Promise.race([pending, aborted]); }
    finally { if (abortListener) signal.removeEventListener("abort", abortListener); }
  }

  private touch(session: BrowserSession): void { session.lastUsedAt = Date.now(); }

  private async closeProjectPreview(session: BrowserSession): Promise<void> {
    const preview = session.projectPreview;
    session.projectPreview = null;
    if (preview) await preview.close().catch(() => undefined);
  }

  private async sweepExpired(): Promise<void> {
    const now = Date.now();
    for (const session of this.sessions.values()) if (now - session.lastUsedAt > SESSION_IDLE_TTL_MS) await this.disposeSession(session);
  }

  private async disposeSession(session: BrowserSession): Promise<void> {
    if (session.disposed) return;
    session.disposed = true;
    this.sessions.delete(session.id);
    const key = sessionKey(session.ownerId, session.sourceSessionId, session.providerId);
    this.sessionKeys.delete(key);
    if (session.providerId === "lfaa-native-browser") this.nativeActiveTargets.delete(key);
    if (session.nativePageListener) session.context.off("page", session.nativePageListener);
    for (const [page, handlers] of session.nativePageHandlers ?? []) {
      page.off("domcontentloaded", handlers.domcontentloaded);
      page.off("close", handlers.close);
      page.off("framenavigated", handlers.framenavigated);
    }
    session.nativePageHandlers?.clear();
    if (session.ownsContext) await session.context.close().catch(() => undefined);
    await this.closeProjectPreview(session);
    await session.operationTail.catch(() => undefined);
  }
}
