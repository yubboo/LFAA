/**
 * 功能：持有 LFAA 隔离 Chromium BrowserContext 与内嵌页面状态。
 * 作用：Agent Tools 与右 Dock 读取/操控同一会话；不附着用户个人浏览器 Profile。
 * 关联文件：index.ts、packages/api/browser-controller、packages/client/ui-sidebar-browser。
 */
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { isPublicMcpAddress, resolveMcpEndpoint } from "lfaa-mcp-client/src/network.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { BUILTIN_BROWSER_WORKSPACE_ID, type BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";
import { TabbitBrowserProvider, type TabbitTabSummary } from "./tabbit-provider.js";

const SESSION_IDLE_TTL_MS = 30 * 60_000;
const SESSION_SWEEP_MS = 60_000;
const MAX_SESSIONS = 24;
const MAX_SESSIONS_PER_USER = 4;
const MAX_PAGE_COUNT = 8;
const MAX_PAGE_TEXT = 16_000;
const MAX_INTERACTIVE_ITEMS = 80;
const BROWSER_DOM_CHANGE_NOTIFICATION_INTERVAL_MS = 750;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const PAGE_ACTION_TIMEOUT_MS = 8_000;
const MAX_RECENT_SITES_PER_USER = 100;
const SENSITIVE_FIELD = /(?:password|passcode|secret|token|api[\s_-]?key|authorization|验证码|密码|密钥|令牌)/iu;
export const BROWSER_ALLOWED_KEYS = ["Enter", "Tab", "Shift+Tab", "Escape", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "PageDown", "PageUp", "Space", "Backspace", "Delete", "Control+A", "Meta+A", "Control+C", "Control+V", "Control+X", "Control+Z", "Control+Y", "Meta+C", "Meta+V", "Meta+X", "Meta+Z", "Meta+Y"] as const;
const BROWSER_ALLOWED_KEY_SET: ReadonlySet<string> = new Set(BROWSER_ALLOWED_KEYS);

export interface BrowserProviderSummary { id: BrowserProviderId; name: string; available: boolean; reason?: string; isolation: "app-session" | "new-profile" | "user-profile"; activeInWorkspace?: boolean }
export interface BrowserTabSummary { id: string; title: string; url: string; active: boolean }
export interface BrowserSnapshot {
  sessionId: string;
  providerId: BrowserProviderId;
  revision: number;
  url: string;
  title: string;
  loading: boolean;
  pageText: string;
  controls: Array<{ role: string; name: string; type?: string; disabled: boolean; occurrence?: number }>;
  tabs: BrowserTabSummary[];
  viewport?: { width: number; height: number } | null;
  screenshot: { mimeType: "image/jpeg"; dataBase64: string; width: number; height: number } | null;
}
export class BrowserNavigationTargetError extends Error {
  constructor() {
    super("浏览器目标无法安全解析为公网地址；只有明确指定的本机预览源可访问本机地址。");
    this.name = "BrowserNavigationTargetError";
  }
}
export interface BrowserRevision { revision: number; url: string; title: string }
export interface BrowserRecentSite { url: string; visitedAt: string }
export interface BrowserDragPoint { x: number; y: number; delayMs: number }
export interface BrowserRunAdapterContext {
  ownerId: string;
  sourceSessionId: string;
  runId: string;
  signal: AbortSignal;
  onRunDispose: (cleanup: () => void) => void;
}
interface BrowserSessionManagerOptions { headless?: boolean }
export interface BrowserRunAdapter {
  readonly runId: string;
  listTabs(): Promise<TabbitTabSummary[]>;
  claimTab(tabId: number): Promise<BrowserSnapshot>;
  navigate(providerId: BrowserProviderId, url: string): Promise<BrowserSnapshot>;
  navigateProjectPreview(providerId: BrowserProviderId, preview: { url: string; close: () => Promise<void> }): Promise<BrowserSnapshot>;
  observe(providerId: BrowserProviderId): Promise<BrowserSnapshot>;
  click(providerId: BrowserProviderId, role: string, name: string, occurrence?: number): Promise<BrowserSnapshot>;
  fill(providerId: BrowserProviderId, label: string, value: string): Promise<BrowserSnapshot>;
  pressKey(providerId: BrowserProviderId, key: string): Promise<BrowserSnapshot>;
  scroll(providerId: BrowserProviderId, direction: "up" | "down", amount: number): Promise<BrowserSnapshot>;
}

interface BrowserSession {
  id: string;
  ownerId: string;
  sourceSessionId: string;
  providerId: BrowserProviderId;
  browser: Browser | null;
  context: BrowserContext;
  page: Page;
  lastUsedAt: number;
  revision: number;
  revisionWaiters: Set<(revision: BrowserRevision | null) => void>;
  operationTail: Promise<void>;
  allowedLocalOrigin: string | null;
  projectPreview: { url: string; close: () => Promise<void> } | null;
  lastRecentUrl: string;
  userDataDir: string | null;
  ownsContext: boolean;
  dockFrameStreamActive: boolean;
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

function normalizeRecentSiteUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) return null;
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}

function isSensitiveField(label: string, type?: string): boolean {
  return type?.toLowerCase() === "password" || SENSITIVE_FIELD.test(label);
}

export class BrowserSessionManager {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly sessionKeys = new Map<string, string>();
  private readonly pendingSessions = new Map<string, { ownerId: string; promise: Promise<BrowserSession> }>();
  private readonly sessionCreationWaiters = new Map<string, Set<(revision: BrowserRevision | null) => void>>();
  private readonly runAdapters = new Map<string, { adapter: BrowserRunAdapter; signal: AbortSignal; dispose: () => void }>();
  private readonly channels = availableChannels();
  private readonly headless: boolean;
  private readonly sweepTimer = setInterval(() => { void Promise.all([this.sweepExpired(), this.tabbit.sweepExpired()]).catch(() => undefined); }, SESSION_SWEEP_MS);
  private readonly browsers = new Map<"msedge" | "chrome" | "native", Promise<Browser>>();
  private readonly nativeActiveTargets = new Map<string, string>();
  private readonly tabbit: TabbitBrowserProvider;
  private readonly nativeCdpPortFile = process.env.LFAA_ELECTRON_CDP_PORT_FILE?.trim() ?? "";
  private readonly nativeAppOrigin = process.env.LFAA_ELECTRON_BROWSER_APP_ORIGIN?.trim() ?? "";
  private disposed = false;

  constructor(
    private readonly localHostExecution: boolean,
    private readonly isRecentHistoryEnabled: (ownerId: string) => boolean = ownerId => getUserSettings(ownerId).browserUse.recordRecentSites,
    options: BrowserSessionManagerOptions = {}
  ) {
    this.headless = options.headless ?? true;
    this.tabbit = new TabbitBrowserProvider(localHostExecution);
    this.sweepTimer.unref?.();
  }

  getRecentSites(ownerId: string, limit = 12): BrowserRecentSite[] {
    if (!ownerId || !this.isRecentHistoryEnabled(ownerId)) return [];
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const rows = database.prepare("SELECT url, visited_at FROM browser_recent_sites WHERE user_id = ? ORDER BY visited_at DESC, url LIMIT ?").all(ownerId, safeLimit) as Array<{ url: string; visited_at: string }>;
    return rows.map(row => ({ url: row.url, visitedAt: row.visited_at }));
  }

  recordRecentSites(ownerId: string, urls: readonly string[]): number {
    if (!ownerId || !this.isRecentHistoryEnabled(ownerId)) return 0;
    if (!database.prepare("SELECT id FROM users WHERE id = ?").get(ownerId)) return 0;
    const record = database.prepare(`
      INSERT INTO browser_recent_sites(user_id, url, visited_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id, url) DO UPDATE SET visited_at = excluded.visited_at
    `);
    const prune = database.prepare(`
      DELETE FROM browser_recent_sites WHERE user_id = ? AND url NOT IN (
        SELECT url FROM browser_recent_sites WHERE user_id = ? ORDER BY visited_at DESC, url LIMIT ${MAX_RECENT_SITES_PER_USER}
      )
    `);
    let recorded = 0;
    for (const input of urls.slice(0, 64)) {
      const url = normalizeRecentSiteUrl(input);
      if (!url) continue;
      record.run(ownerId, url, new Date().toISOString());
      recorded += 1;
    }
    if (recorded) prune.run(ownerId, ownerId);
    return recorded;
  }

  clearRecentSites(ownerId: string): void {
    if (!ownerId) return;
    database.prepare("DELETE FROM browser_recent_sites WHERE user_id = ?").run(ownerId);
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
    const browserWorkspaceId = (providerId: BrowserProviderId) => providerId === "tabbit-personal" ? sourceSessionId : BUILTIN_BROWSER_WORKSPACE_ID;
    const adapter: BrowserRunAdapter = Object.freeze({
      runId,
      listTabs: (): Promise<TabbitTabSummary[]> => invoke(() => this.listTabs(ownerId, sourceSessionId, "tabbit-personal", signal)),
      claimTab: (tabId: number): Promise<BrowserSnapshot> => invoke(() => this.claimTab(ownerId, sourceSessionId, "tabbit-personal", tabId, signal)),
      navigate: (providerId: BrowserProviderId, url: string): Promise<BrowserSnapshot> => invoke(() => this.navigate(ownerId, browserWorkspaceId(providerId), providerId, url, signal, true, false)),
      navigateProjectPreview: (providerId: BrowserProviderId, preview: { url: string; close: () => Promise<void> }): Promise<BrowserSnapshot> => invoke(() => this.navigateProjectPreview(ownerId, browserWorkspaceId(providerId), providerId, preview, signal, false)),
      observe: (providerId: BrowserProviderId): Promise<BrowserSnapshot> => invoke(() => this.observeForRun(ownerId, browserWorkspaceId(providerId), providerId, signal, false)),
      click: (providerId: BrowserProviderId, role: string, name: string, occurrence?: number): Promise<BrowserSnapshot> => invoke(() => this.click(ownerId, browserWorkspaceId(providerId), providerId, role, name, signal, true, false, occurrence)),
      fill: (providerId: BrowserProviderId, label: string, value: string): Promise<BrowserSnapshot> => invoke(() => this.fill(ownerId, browserWorkspaceId(providerId), providerId, label, value, signal, true, false)),
      pressKey: (providerId: BrowserProviderId, key: string): Promise<BrowserSnapshot> => invoke(() => this.pressKey(ownerId, browserWorkspaceId(providerId), providerId, key, signal, false)),
      scroll: (providerId: BrowserProviderId, direction: "up" | "down", amount: number): Promise<BrowserSnapshot> => invoke(() => this.scroll(ownerId, browserWorkspaceId(providerId), providerId, direction, amount, signal, false))
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

  listProviders(ownerId?: string): BrowserProviderSummary[] {
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
    return ownerId ? providers.map(provider => ({
      ...provider,
      activeInWorkspace: provider.id !== "tabbit-personal" && (this.sessionKeys.has(sessionKey(ownerId, BUILTIN_BROWSER_WORKSPACE_ID, provider.id))
        || provider.id === "lfaa-native-browser" && this.nativeActiveTargets.has(sessionKey(ownerId, BUILTIN_BROWSER_WORKSPACE_ID, provider.id)))
    })) : providers;
  }

  async setNativeActiveTarget(ownerId: string, sourceSessionId: string, targetId: string): Promise<void> {
    if (!this.nativeCdpPortFile || !/^[a-zA-Z0-9_-]{1,128}$/u.test(targetId)) throw new Error("原生浏览器标签标识无效。");
    const key = sessionKey(ownerId, sourceSessionId, "lfaa-native-browser");
    const existingId = this.sessionKeys.get(key);
    const existing = existingId ? this.sessions.get(existingId) : undefined;
    if (existing && !existing.disposed) {
      await this.exclusive(existing, async () => {
        const browser = existing.browser ?? await this.getBrowser("native");
        const match = await this.findNativePageInBrowser(browser, targetId);
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
        this.bumpRevision(existing);
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

  async getPanelSnapshot(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, includeScreenshot = true, includePageDetails = true): Promise<BrowserSnapshot | null> {
    if (providerId === "tabbit-personal") return this.tabbit.getPanelSnapshot(ownerId, sourceSessionId, includeScreenshot);
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed) return null;
    return this.exclusive(session, () => this.observe(session, providerId === "lfaa-native-browser" ? false : includeScreenshot, includePageDetails));
  }

  async streamDockFrames(
    ownerId: string,
    sourceSessionId: string,
    providerId: BrowserProviderId,
    signal: AbortSignal,
    onFrame: (frame: { dataBase64: string; width: number; height: number }) => Promise<void>
  ): Promise<void> {
    if (providerId !== "lfaa-managed-edge" && providerId !== "lfaa-managed-chrome") throw new Error("当前浏览器来源不支持内嵌实时画面。");
    const key = sessionKey(ownerId, sourceSessionId, providerId);
    const id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed || session.page.isClosed()) throw new Error("当前没有可显示的浏览器页面。");
    if (session.dockFrameStreamActive) throw new Error("当前浏览器页面已经连接到右侧栏。");
    if (signal.aborted) return;

    const page = session.page;
    session.dockFrameStreamActive = true;
    let client: Awaited<ReturnType<BrowserContext["newCDPSession"]>>;
    try { client = await session.context.newCDPSession(page); }
    catch (error) { session.dockFrameStreamActive = false; throw error; }
    type ScreencastFrame = { data: string; sessionId: number; metadata?: { deviceWidth?: number; deviceHeight?: number } };
    const pending: { frame: ScreencastFrame | null } = { frame: null };
    let wake: (() => void) | null = null;
    let started = false;
    const notify = () => { const callback = wake; wake = null; callback?.(); };
    const acknowledge = (frame: ScreencastFrame) => client.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
    const onScreencastFrame = (frame: ScreencastFrame) => {
      if (signal.aborted || page.isClosed()) { void acknowledge(frame); return; }
      if (pending.frame) void acknowledge(pending.frame);
      pending.frame = frame;
      notify();
    };
    const onPageClose = () => notify();
    const onAbort = () => notify();
    client.on("Page.screencastFrame", onScreencastFrame);
    page.once("close", onPageClose);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      await client.send("Page.startScreencast", { format: "jpeg", quality: 62, maxWidth: 1280, maxHeight: 1600, everyNthFrame: 1 });
      started = true;
      this.touch(session);
      while (!signal.aborted && !page.isClosed()) {
        if (!pending.frame) await new Promise<void>(resolve => { wake = resolve; });
        const frame = pending.frame;
        pending.frame = null;
        if (!frame || signal.aborted || page.isClosed()) continue;
        const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
        const width = Math.max(1, Math.min(1280, Math.floor(frame.metadata?.deviceWidth ?? viewport.width)));
        const height = Math.max(1, Math.min(1600, Math.floor(frame.metadata?.deviceHeight ?? viewport.height)));
        if (frame.data.length <= 4_000_000) {
          await onFrame({ dataBase64: frame.data, width, height });
          this.touch(session);
        }
        await acknowledge(frame);
      }
    } finally {
      session.dockFrameStreamActive = false;
      client.off("Page.screencastFrame", onScreencastFrame);
      page.off("close", onPageClose);
      signal.removeEventListener("abort", onAbort);
      notify();
      if (pending.frame) await acknowledge(pending.frame);
      if (started) await client.send("Page.stopScreencast").catch(() => undefined);
      await client.detach().catch(() => undefined);
    }
  }

  async resizeViewport(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, width: number, height: number, signal?: AbortSignal, includeScreenshot = true): Promise<BrowserSnapshot | null> {
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
        this.bumpRevision(session);
      }
      this.touch(session);
      return this.observe(session, includeScreenshot, false);
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

  async waitForPanelRevision(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, afterRevision: number, signal?: AbortSignal): Promise<BrowserRevision | null> {
    if (providerId === "tabbit-personal") return this.tabbit.getPanelRevision(ownerId, sourceSessionId, signal);
    if (!Number.isSafeInteger(afterRevision) || afterRevision < 0) throw new Error("浏览器页面修订号无效。");
    signal?.throwIfAborted();
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed || session.page.isClosed()) return new Promise((resolve, reject) => {
      let settled = false;
      if (!this.sessionCreationWaiters.has(key) && this.sessionCreationWaiters.size >= 128) { reject(new Error("浏览器更新等待数量已达上限。")); return; }
      const waiters = this.sessionCreationWaiters.get(key) ?? new Set<(revision: BrowserRevision | null) => void>();
      if (waiters.size >= 16) { reject(new Error("当前浏览器工作区更新等待数量已达上限。")); return; }
      this.sessionCreationWaiters.set(key, waiters);
      const cleanup = () => {
        clearTimeout(timer);
        waiters.delete(onCreated);
        if (!waiters.size) this.sessionCreationWaiters.delete(key);
        signal?.removeEventListener("abort", onAbort);
      };
      const onCreated = (revision: BrowserRevision | null) => { if (!settled) { settled = true; cleanup(); resolve(revision); } };
      const onAbort = () => { if (!settled) { settled = true; cleanup(); reject(new Error("浏览器页面更新等待已取消。")); } };
      const timer = setTimeout(() => onCreated(null), 15_000);
      waiters.add(onCreated);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
      else if (this.sessionKeys.has(key)) void this.getPanelRevision(ownerId, sourceSessionId, providerId).then(onCreated, error => { cleanup(); reject(error); });
    });
    this.touch(session);
    if (session.revision !== afterRevision) return this.getPanelRevision(ownerId, sourceSessionId, providerId, signal);
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        session.revisionWaiters.delete(onRevision);
        signal?.removeEventListener("abort", onAbort);
      };
      const finish = (revision: BrowserRevision | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(revision);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onRevision = (revision: BrowserRevision | null) => finish(revision);
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("浏览器页面更新等待已取消。"));
      };
      session.revisionWaiters.add(onRevision);
      signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        void this.getPanelRevision(ownerId, sourceSessionId, providerId).then(finish, fail);
      }, 15_000);
      if (signal?.aborted) { onAbort(); return; }
      if (session.disposed) finish(null);
      else if (session.revision !== afterRevision) void this.getPanelRevision(ownerId, sourceSessionId, providerId).then(finish, fail);
    });
  }

  async navigate(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, value: string, signal?: AbortSignal, includePageDetails = true, includeScreenshot = true): Promise<BrowserSnapshot> {
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
      await session.page.goto(url.toString(), { waitUntil: "commit", timeout: 20_000 });
      this.touch(session);
      this.bumpRevision(session);
      return this.observe(session, includeScreenshot, includePageDetails);
    }, signal);
  }

  async navigateProjectPreview(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, preview: { url: string; close: () => Promise<void> }, signal?: AbortSignal, includeScreenshot = true): Promise<BrowserSnapshot> {
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
        await session.page.goto(url.toString(), { waitUntil: "commit", timeout: 20_000 });
        this.touch(session);
        return await this.observe(session, includeScreenshot);
      } catch (error) {
        await this.closeProjectPreview(session);
        session.allowedLocalOrigin = null;
        throw error;
      }
    }, signal);
  }

  async observeForRun(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal, includeScreenshot = false): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.observe(ownerId, sourceSessionId, signal);
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, () => this.observe(session, includeScreenshot), signal);
  }

  async back(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal, includePageDetails = true, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "back", {}, signal);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.goBack({ waitUntil: "commit", timeout: 10_000 }), signal, includeScreenshot, includePageDetails);
  }

  async forward(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal, includePageDetails = true, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "forward", {}, signal);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.goForward({ waitUntil: "commit", timeout: 10_000 }), signal, includeScreenshot, includePageDetails);
  }

  async reload(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal, includePageDetails = true, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "reload", {}, signal);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.reload({ waitUntil: "commit", timeout: 15_000 }), signal, includeScreenshot, includePageDetails);
  }

  async click(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, role: string, name: string, signal?: AbortSignal, includePageDetails = true, includeScreenshot = true, occurrence?: number): Promise<BrowserSnapshot> {
    if (occurrence !== undefined && (!Number.isInteger(occurrence) || occurrence < 0 || occurrence >= MAX_INTERACTIVE_ITEMS)) throw new Error("网页控件序号无效。");
    if (providerId === "tabbit-personal") {
      if (occurrence !== undefined) throw new Error("Tabbit 当前不支持按同名控件序号点击。");
      return this.tabbit.action(ownerId, sourceSessionId, "click", { role, name }, signal);
    }
    const allowedRoles = new Set(["button", "link", "checkbox", "radio", "tab", "menuitem", "option"]);
    if (!allowedRoles.has(role) || !name.trim() || name.length > 160) throw new Error("点击目标必须来自页面快照中的可访问角色和名称。");
    return this.usePage(ownerId, sourceSessionId, providerId, async page => {
      const matches = page.getByRole(role as "button", { name: name.trim(), exact: true });
      const count = await matches.count();
      if (count === 0) throw new Error("当前网页已找不到此控件，请重新观察页面。");
      if (occurrence === undefined && count !== 1) throw new Error("当前网页有多个同名控件，请使用页面快照中的 occurrence 序号。");
      if ((occurrence ?? 0) >= count) throw new Error("网页控件序号已失效，请重新观察页面。");
      await matches.nth(occurrence ?? 0).click({ timeout: PAGE_ACTION_TIMEOUT_MS });
    }, signal, includeScreenshot, includePageDetails);
  }

  async fill(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, label: string, value: string, signal?: AbortSignal, includePageDetails = true, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "fill", { label, value }, signal);
    if (!label.trim() || label.length > 160 || value.length > 4000) throw new Error("输入目标或内容超出允许范围。");
    if (isSensitiveField(label)) throw new Error("密码、验证码、令牌和密钥需由用户在页面中自行输入，LFAA 不代填或读取。");
    return this.usePage(ownerId, sourceSessionId, providerId, async page => {
      const matches = page.getByRole("textbox", { name: label.trim(), exact: true });
      if (await matches.count() !== 1) throw new Error("网页文本框不存在或名称重复，请重新观察页面。");
      const target = matches.first();
      const type = await target.getAttribute("type", { timeout: PAGE_ACTION_TIMEOUT_MS }).catch(() => null);
      if (isSensitiveField(label, type ?? undefined)) throw new Error("密码、验证码、令牌和密钥需由用户在页面中自行输入，LFAA 不代填或读取。");
      await target.fill(value, { timeout: PAGE_ACTION_TIMEOUT_MS });
    }, signal, includeScreenshot, includePageDetails);
  }

  async typeText(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, text: string, signal?: AbortSignal, includeScreenshot = true, includePageDetails = true): Promise<BrowserSnapshot> {
    if (!text || text.length > 2000) throw new Error("单次输入文字需在 1–2000 个字符内。");
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "type-text", { text }, signal, includeScreenshot);
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.keyboard.insertText(text), signal, includeScreenshot, includePageDetails);
  }

  async pressKey(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, key: string, signal?: AbortSignal, includeScreenshot = true, includePageDetails = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "press-key", { key }, signal, includeScreenshot);
    if (!BROWSER_ALLOWED_KEY_SET.has(key)) throw new Error("此按键不在浏览器工具允许列表中。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.keyboard.press(key), signal, includeScreenshot, includePageDetails);
  }

  async scroll(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, direction: "up" | "down", amount: number, signal?: AbortSignal, includeScreenshot = true, includePageDetails = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "scroll", { direction, amount }, signal, includeScreenshot);
    if (!Number.isInteger(amount) || amount < 1 || amount > 600) throw new Error("滚动距离必须在 1–600 像素内。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.mouse.wheel(0, direction === "down" ? amount : -amount), signal, includeScreenshot, includePageDetails);
  }

  async clickAt(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, x: number, y: number, signal?: AbortSignal, includePageDetails = true, includeScreenshot = true): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "clickAt", { x, y }, signal);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 4096 || y > 4096) throw new Error("坐标超出浏览器视口边界。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.mouse.click(x, y), signal, includeScreenshot, includePageDetails);
  }

  async dragAt(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, x: number, y: number, points: readonly BrowserDragPoint[], signal?: AbortSignal, includePageDetails = true, includeScreenshot = true): Promise<BrowserSnapshot> {
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
    }, signal, includeScreenshot, includePageDetails);
  }

  async closeSession(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId): Promise<void> {
    if (providerId === "tabbit-personal") return this.tabbit.closeSession(ownerId, sourceSessionId);
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const pending = this.pendingSessions.get(key)?.promise;
    if (pending) {
      try { await this.disposeSession(await pending); } catch { /* The session failed to start and owns no live page. */ }
      return;
    }
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
    for (const waiters of [...this.sessionCreationWaiters.values()]) for (const waiter of [...waiters]) waiter(null);
    this.sessionCreationWaiters.clear();
    clearInterval(this.sweepTimer);
    for (const entry of this.runAdapters.values()) entry.dispose();
    this.runAdapters.clear();
    await this.tabbit.closeAll();
    await Promise.all([...this.pendingSessions.values()].map(entry => entry.promise.catch(() => null)));
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
    const pending = this.pendingSessions.get(key);
    if (pending) return pending.promise;
    const accountSessions = [...this.sessions.values()].filter(session => session.ownerId === ownerId).length
      + [...this.pendingSessions.values()].filter(session => session.ownerId === ownerId).length;
    if (this.sessions.size + this.pendingSessions.size >= MAX_SESSIONS || accountSessions >= MAX_SESSIONS_PER_USER) {
      throw new Error("浏览器会话达到当前账户的并发上限；先关闭不再使用的浏览器会话。");
    }
    const creation = this.createSession(ownerId, sourceSessionId, providerId, key, provider?.channel);
    this.pendingSessions.set(key, { ownerId, promise: creation });
    try { return await creation; }
    finally { if (this.pendingSessions.get(key)?.promise === creation) this.pendingSessions.delete(key); }
  }

  private async createSession(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, key: string, channel?: "msedge" | "chrome"): Promise<BrowserSession> {
    const isNativeProvider = providerId === "lfaa-native-browser";
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let userDataDir: string | null = null;
    try {
      if (isNativeProvider) {
        const nativeTargetId = this.nativeActiveTargets.get(key) ?? "";
        if (!nativeTargetId) throw new Error("请在浏览器工作区选择要交给 Agent 操作的标签页。");
        browser = await this.getBrowser("native");
        const match = await this.findNativePageInBrowser(browser, nativeTargetId);
        if (!match) throw new Error("当前活动的原生浏览器标签尚未出现在 Chromium 中；切回浏览器标签后重试。");
        context = match.context;
        page = match.page;
      } else {
        if (!channel) throw new Error("所选浏览器提供方不受当前 Host 支持。");
        if (this.headless) {
          browser = await this.getBrowser(channel);
          context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
          page = await context.newPage();
        } else {
          userDataDir = await mkdtemp(join(tmpdir(), "lfaa-browser-profile-"));
          context = await chromium.launchPersistentContext(userDataDir, {
            channel, headless: false, timeout: 15_000, viewport: null, serviceWorkers: "block"
          });
          page = context.pages()[0] ?? await context.newPage();
        }
      }
      if (!context || !page) throw new Error("原生浏览器里没有可接管的网页标签；先在右侧工作区打开一个标签。");
      if (this.disposed) throw new Error("Browser Owner 已关闭。");
      const activeContext = context;
      const session: BrowserSession = {
        id: randomUUID(), ownerId, sourceSessionId, providerId, browser, context: activeContext,
        page, lastUsedAt: Date.now(), revision: 0,
        revisionWaiters: new Set(),
        operationTail: Promise.resolve(), allowedLocalOrigin: null, projectPreview: null, lastRecentUrl: "",
        ownsContext: !isNativeProvider, dockFrameStreamActive: false, userDataDir, disposed: false
      };
      if (isNativeProvider) {
        session.nativePageHandlers = new Map();
        const watchPage = (watchedPage: Page) => this.watchNativePage(session, watchedPage);
        session.nativePageListener = watchedPage => watchPage(watchedPage);
        for (const watchedPage of context.pages()) watchPage(watchedPage);
        context.on("page", session.nativePageListener);
        this.sessions.set(session.id, session);
        this.sessionKeys.set(key, session.id);
        this.notifySessionCreated(key, session);
        return session;
      }
      let lastChangeNotificationAt = 0;
      await activeContext.exposeBinding("__lfaaBrowserChanged", () => {
        const now = Date.now();
        if (now - lastChangeNotificationAt < BROWSER_DOM_CHANGE_NOTIFICATION_INTERVAL_MS) return;
        lastChangeNotificationAt = now;
        this.bumpRevision(session);
      });
      await activeContext.addInitScript("(() => { let queued = false; const notify = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; void window.__lfaaBrowserChanged?.(); }); }; const observer = new MutationObserver(notify); observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); window.addEventListener(\"resize\", notify, { passive: true }); window.addEventListener(\"pagehide\", () => { observer.disconnect(); window.removeEventListener(\"resize\", notify); }, { once: true }); })();");
      await activeContext.route("**/*", route => {
        const requestUrl = route.request().url();
        if (/^(?:about:|blob:|data:)/iu.test(requestUrl)) { void route.continue(); return; }
        void this.guardRequest(session, requestUrl).then(() => route.continue()).catch(() => route.abort("blockedbyclient"));
      });
      activeContext.on("page", nextPage => {
        if (activeContext.pages().length > MAX_PAGE_COUNT) { void nextPage.close().catch(() => undefined); return; }
        session.page = nextPage;
        this.bumpRevision(session);
        nextPage.on("domcontentloaded", () => { this.bumpRevision(session); });
        nextPage.on("load", () => { this.bumpRevision(session); });
        nextPage.on("close", () => { this.bumpRevision(session); });
      });
      session.page.on("domcontentloaded", () => { this.bumpRevision(session); });
      session.page.on("load", () => { this.bumpRevision(session); });
      session.page.on("close", () => { this.bumpRevision(session); });
      if (this.disposed) throw new Error("Browser Owner 已关闭。");
      this.sessions.set(session.id, session);
      this.sessionKeys.set(key, session.id);
      this.notifySessionCreated(key, session);
      return session;
    } catch (error) {
      if (context && !isNativeProvider) await context.close().catch(() => undefined);
      if (userDataDir) await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => undefined);
      throw error;
    }
  }

  private async getBrowser(channel: "msedge" | "chrome" | "native"): Promise<Browser> {
    let browserPromise = this.browsers.get(channel);
    if (!browserPromise) {
      browserPromise = channel === "native"
        ? this.connectNativeBrowser()
        : chromium.launch({ channel, headless: this.headless, timeout: 15_000 }).catch(error => {
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
      domcontentloaded: () => { if (!session.disposed) this.bumpRevision(session); },
      close: () => { if (!session.disposed) this.bumpRevision(session); },
      framenavigated: (frame: import("playwright-core").Frame) => { if (!session.disposed && frame === page.mainFrame()) this.bumpRevision(session); }
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
    return endpoint.addresses.length > 0 && endpoint.addresses.every(item => !isPublicMcpAddress(item.address));
  }

  private async assertTarget(session: BrowserSession, url: URL, explicitNavigation = false): Promise<void> {
    if (session.allowedLocalOrigin && url.origin === session.allowedLocalOrigin) return;
    try { await resolveMcpEndpoint(url, false); return; }
    catch {
      if (explicitNavigation) {
        try {
          const endpoint = await resolveMcpEndpoint(url, true);
          if (endpoint.addresses.length && endpoint.addresses.every(item => !isPublicMcpAddress(item.address))) return;
        } catch { /* 解析失败仍拒绝。 */ }
      }
      throw new BrowserNavigationTargetError();
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

  private async usePage(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, action: (page: Page) => Promise<unknown>, signal?: AbortSignal, includeScreenshot = true, includePageDetails = true): Promise<BrowserSnapshot> {
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, async () => {
      await action(session.page);
      this.touch(session);
      this.bumpRevision(session);
      return this.observe(session, includeScreenshot, includePageDetails);
    }, signal);
  }

  private async observe(session: BrowserSession, includeScreenshot: boolean, includePageDetails = true): Promise<BrowserSnapshot> {
    this.touch(session);
    const page = session.page;
    if (page.isClosed()) throw new Error("当前浏览器标签已关闭；请重新打开 LFAA 隔离浏览器。");
    const recentUrl = normalizeRecentSiteUrl(page.url());
    if (recentUrl && recentUrl !== session.lastRecentUrl) {
      session.lastRecentUrl = recentUrl;
      this.recordRecentSites(session.ownerId, [recentUrl]);
    }
      const documentState = await page.evaluate(() => {
      const runtimeDocument = (globalThis as typeof globalThis & { document?: { readyState?: string; body?: { textContent?: string; querySelector?: (selector: string) => unknown } } }).document;
      const body = runtimeDocument?.body;
      return {
        loading: runtimeDocument?.readyState === "loading",
        hasRenderableContent: Boolean(body && ((body.textContent ?? "").trim() || body.querySelector?.("img,svg,canvas,video,iframe"))),
        viewport: (() => {
          const pageWindow = globalThis as typeof globalThis & { innerWidth?: number; innerHeight?: number };
          return { width: pageWindow.innerWidth ?? 0, height: pageWindow.innerHeight ?? 0 };
        })()
      };
    }).catch(() => ({ loading: false, hasRenderableContent: false, viewport: page.viewportSize() }));
    const [title, pageText, rawControls, screenshot, tabs] = await Promise.all([
      page.title().catch(() => ""),
      includePageDetails && !documentState.loading ? page.locator("body").innerText({ timeout: 4_000 }).catch(() => "") : Promise.resolve(""),
      includePageDetails && !documentState.loading ? page.locator("a,button,input,textarea,select,[role=button],[role=link],[role=textbox]").evaluateAll<BrowserSnapshot["controls"], number>((elements, limit) => elements.slice(0, limit).filter(node => node.getClientRects().length > 0 && !node.closest('[aria-hidden="true"]')).map(node => {
        const isInput = node.tagName === "INPUT";
        const innerText = (node as typeof node & { innerText?: string }).innerText;
        const label = node.getAttribute("aria-label") || (["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName) ? (node as typeof node & { labels?: ArrayLike<{ textContent?: string | null }> }).labels?.[0]?.textContent : null) || innerText || (isInput ? node.getAttribute("placeholder") : null) || node.getAttribute("title") || "";
        const name = label.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, 160);
        const type = isInput ? node.getAttribute("type") || "text" : undefined;
        const role = node.getAttribute("role") || (node.tagName === "A" ? "link" : node.tagName === "BUTTON" ? "button" : node.tagName === "INPUT" ? (type === "checkbox" ? "checkbox" : type === "radio" ? "radio" : "textbox") : node.tagName === "TEXTAREA" ? "textbox" : node.tagName === "SELECT" ? "combobox" : node.tagName.toLowerCase());
        return { role, name: type === "password" || /password|passcode|secret|token|api[\s_-]?key|authorization|验证码|密码|密钥|令牌/iu.test(name) ? "受保护的敏感字段" : name, ...(type && type !== "password" ? { type } : {}), disabled: node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true" };
      }).filter(item => item.name).slice(0, limit), MAX_INTERACTIVE_ITEMS).catch(() => [] as BrowserSnapshot["controls"]) : Promise.resolve([] as BrowserSnapshot["controls"]),
      includeScreenshot ? this.captureScreenshot(page, documentState.hasRenderableContent && !documentState.loading) : Promise.resolve(null),
      Promise.all(session.context.pages().filter(tab => session.providerId !== "lfaa-native-browser" || !this.isNativeAppPage(tab)).slice(0, MAX_PAGE_COUNT).map(async (tab, index) => ({ id: String(index), title: await tab.title().catch(() => ""), url: tab.url().slice(0, 2048), active: tab === page })))
    ]);
    const occurrences = new Map<string, number>();
    const controls = rawControls.map(control => {
      const key = `${control.role}\0${control.name}`;
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      return { ...control, occurrence };
    });
    const normalizedText = pageText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").slice(0, MAX_PAGE_TEXT);
    return { sessionId: session.id, providerId: session.providerId, revision: session.revision, url: page.url().slice(0, 2048), title: title.slice(0, 300), loading: documentState.loading, pageText: normalizedText, controls, tabs, viewport: documentState.viewport, screenshot };
  }

  private async captureScreenshot(page: Page, hasRenderableContent: boolean): Promise<BrowserSnapshot["screenshot"]> {
    try {
      if (!hasRenderableContent) return null;
      let data = await page.screenshot({ type: "jpeg", quality: 68, animations: "allow", fullPage: false, timeout: 5_000 });
      if (data.byteLength > MAX_SCREENSHOT_BYTES) data = await page.screenshot({ type: "jpeg", quality: 60, animations: "allow", fullPage: false, timeout: 5_000 });
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
        void this.stopPageLoading(session);
        reject(new Error("浏览器操作已取消。"));
      };
      signal.addEventListener("abort", abortListener, { once: true });
    });
    try { return await Promise.race([pending, aborted]); }
    finally { if (abortListener) signal.removeEventListener("abort", abortListener); }
  }

  private async stopPageLoading(session: BrowserSession): Promise<void> {
    if (session.disposed || session.page.isClosed()) return;
    let client: Awaited<ReturnType<BrowserContext["newCDPSession"]>> | undefined;
    try {
      client = await session.context.newCDPSession(session.page);
      await client.send("Page.stopLoading");
    } catch { /* Unsupported providers may not expose CDP; keep the session alive. */ }
    finally { await client?.detach().catch(() => undefined); }
  }

  private touch(session: BrowserSession): void { session.lastUsedAt = Date.now(); }

  private notifySessionCreated(key: string, session: BrowserSession): void {
    const revision = { revision: session.revision, url: session.page.url().slice(0, 2048), title: "" };
    for (const waiter of [...this.sessionCreationWaiters.get(key) ?? []]) waiter(revision);
  }

  private bumpRevision(session: BrowserSession): void {
    session.revision += 1;
    if (!session.revisionWaiters.size) return;
    const revision = { revision: session.revision, url: session.page.url().slice(0, 2048), title: "" };
    for (const waiter of [...session.revisionWaiters]) waiter(revision);
  }

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
    for (const waiter of [...session.revisionWaiters]) waiter(null);
    session.revisionWaiters.clear();
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
    if (session.userDataDir) await rm(session.userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
