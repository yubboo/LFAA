/**
 * 功能：持有 LFAA 隔离 Chromium BrowserContext 与可见页面状态。
 * 作用：Agent Tools 与右 Dock 读取/操控同一会话；不附着用户个人浏览器 Profile。
 * 关联文件：index.ts、packages/api/browser-controller、packages/client/ui-sidebar-browser。
 */
import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
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

export interface BrowserProviderSummary { id: BrowserProviderId; name: string; available: boolean; reason?: string; isolation: "new-profile" | "user-profile" }
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
  private readonly channels = availableChannels();
  private readonly sweepTimer = setInterval(() => { void Promise.all([this.sweepExpired(), this.tabbit.sweepExpired()]).catch(() => undefined); }, SESSION_SWEEP_MS);
  private readonly browsers = new Map<"msedge" | "chrome", Promise<Browser>>();
  private readonly tabbit: TabbitBrowserProvider;
  private disposed = false;

  constructor(private readonly localHostExecution: boolean) {
    this.tabbit = new TabbitBrowserProvider(localHostExecution);
    this.sweepTimer.unref?.();
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
    providers.push({ id: "tabbit-personal", name: "Tabbit Browser · 个人会话", available: this.tabbit.isAvailable(), ...(!this.tabbit.isAvailable() ? { reason: "未在当前账户稳定启动器位置发现 Tabbit LocalAgent。" } : {}), isolation: "user-profile" as const });
    return providers;
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
    if (providerId === "tabbit-personal") return this.tabbit.getPanelSnapshot(ownerId, sourceSessionId);
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed) return null;
    return this.exclusive(session, () => this.observe(session, includeScreenshot));
  }

  async getPanelRevision(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<BrowserRevision | null> {
    if (providerId === "tabbit-personal") return this.tabbit.getPanelRevision(ownerId, sourceSessionId, signal);
    const key = sessionKey(ownerId, sourceSessionId, providerId), id = this.sessionKeys.get(key);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session || session.disposed || session.page.isClosed()) return null;
    this.touch(session);
    return { revision: session.revision, url: session.page.url().slice(0, 2048), title: "" };
  }

  async navigate(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, value: string, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.navigate(ownerId, sourceSessionId, value, signal);
    const url = validateNavigationUrl(value);
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, async () => {
      session.allowedLocalOrigin = null;
      await this.assertTarget(session, url, true);
      if (await this.isPrivateOrigin(url)) session.allowedLocalOrigin = url.origin;
      await session.page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
      this.touch(session);
      return this.observe(session, true);
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

  async pressKey(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, key: string, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "press-key", { key }, signal);
    const allowedKeys = new Set(["Enter", "Tab", "Escape", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Space", "Backspace", "Delete", "Control+A", "Meta+A"]);
    if (!allowedKeys.has(key)) throw new Error("此按键不在浏览器工具允许列表中。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.keyboard.press(key), signal);
  }

  async scroll(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, direction: "up" | "down", amount: number, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "scroll", { direction, amount }, signal);
    if (!Number.isInteger(amount) || amount < 1 || amount > 600) throw new Error("滚动距离必须在 1–600 像素内。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.mouse.wheel(0, direction === "down" ? amount : -amount), signal);
  }

  async clickAt(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, x: number, y: number, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (providerId === "tabbit-personal") return this.tabbit.action(ownerId, sourceSessionId, "clickAt", { x, y }, signal);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 4096 || y > 4096) throw new Error("坐标超出浏览器视口边界。");
    return this.usePage(ownerId, sourceSessionId, providerId, page => page.mouse.click(x, y), signal);
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
    await this.tabbit.closeAll();
    await Promise.all([...this.sessions.values()].map(session => this.disposeSession(session)));
    const browsers = await Promise.all([...this.browsers.values()].map(browser => browser.catch(() => null)));
    this.browsers.clear();
    await Promise.all(browsers.map(browser => browser?.close().catch(() => undefined)));
  }

  private async getOrCreate(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId): Promise<BrowserSession> {
    if (this.disposed || !this.localHostExecution) throw new Error("LFAA 隔离浏览器只在本机 Web/Desktop Host 中可用。");
    if (sourceSessionId.length < 1 || sourceSessionId.length > 160) throw new Error("浏览器会话必须绑定当前 LFAA Session。");
    const provider = this.channels.find(item => item.id === providerId);
    if (!provider) throw new Error("所选隔离浏览器提供方不受当前 Host 支持。");
    if (!provider.paths.some(path => existsSync(path))) throw new Error(`未发现 ${provider.name} 的已安装浏览器。`);
    const key = sessionKey(ownerId, sourceSessionId, providerId), existingId = this.sessionKeys.get(key);
    const existing = existingId ? this.sessions.get(existingId) : undefined;
    if (existing && !existing.disposed && !existing.page.isClosed()) { this.touch(existing); return existing; }
    if (existing && !existing.disposed) await this.disposeSession(existing);
    if (this.sessions.size >= MAX_SESSIONS || [...this.sessions.values()].filter(session => session.ownerId === ownerId).length >= MAX_SESSIONS_PER_USER) {
      throw new Error("浏览器会话达到当前账户的并发上限；先关闭不再使用的浏览器预览。");
    }
    const browser = await this.getBrowser(provider.channel);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: "block" });
    const session: BrowserSession = {
      id: randomUUID(), ownerId, sourceSessionId, providerId, browser, context,
      page: await context.newPage(), lastUsedAt: Date.now(), revision: 0,
      operationTail: Promise.resolve(), allowedLocalOrigin: null, disposed: false
    };
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

  private async getBrowser(channel: "msedge" | "chrome"): Promise<Browser> {
    let browserPromise = this.browsers.get(channel);
    if (!browserPromise) {
      browserPromise = chromium.launch({ channel, headless: true, timeout: 15_000 }).catch(error => {
        this.browsers.delete(channel);
        throw new Error(`隔离浏览器启动失败：${error instanceof Error ? error.message : "未知错误"}`);
      });
      this.browsers.set(channel, browserPromise);
    }
    return browserPromise;
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
    if (session.allowedLocalOrigin && url.origin === session.allowedLocalOrigin) return;
    await this.assertTarget(session, url);
  }

  private async usePage(ownerId: string, sourceSessionId: string, providerId: BrowserProviderId, action: (page: Page) => Promise<unknown>, signal?: AbortSignal): Promise<BrowserSnapshot> {
    const session = await this.getOrCreate(ownerId, sourceSessionId, providerId);
    signal?.throwIfAborted();
    return this.exclusive(session, async () => {
      await action(session.page);
      this.touch(session);
      return this.observe(session, true);
    }, signal);
  }

  private async observe(session: BrowserSession, includeScreenshot: boolean): Promise<BrowserSnapshot> {
    this.touch(session);
    const page = session.page;
    if (page.isClosed()) throw new Error("当前浏览器标签已关闭；请重新打开 LFAA 隔离浏览器。");
    const [title, pageText, controls, screenshot, tabs] = await Promise.all([
      page.title().catch(() => ""),
      page.locator("body").innerText({ timeout: 4_000 }).catch(() => ""),
      page.locator("a,button,input,textarea,select,[role=button],[role=link],[role=textbox]").evaluateAll<BrowserSnapshot["controls"], void>(`elements => elements.slice(0, ${MAX_INTERACTIVE_ITEMS}).map(node => { const input = node instanceof HTMLInputElement ? node : null; const label = node.getAttribute("aria-label") || node.innerText || input?.placeholder || node.getAttribute("title") || ""; const name = label.replace(/[\\u0000-\\u001f\\u007f]/gu, " ").trim().slice(0, 160); const type = input?.type; const role = node.getAttribute("role") || ({A:"link",BUTTON:"button",INPUT:input?.type === "checkbox" ? "checkbox" : input?.type === "radio" ? "radio" : "textbox",TEXTAREA:"textbox",SELECT:"combobox"})[node.tagName] || node.tagName.toLowerCase(); return { role, name: type === "password" || /password|passcode|secret|token|api[\\s_-]?key|authorization|验证码|密码|密钥|令牌/iu.test(name) ? "受保护的敏感字段" : name, ...(type && type !== "password" ? {type} : {}), disabled: node.disabled === true || node.getAttribute("aria-disabled") === "true" }; }).filter(item => item.name).slice(0, ${MAX_INTERACTIVE_ITEMS})`).then(items => items.slice(0, MAX_INTERACTIVE_ITEMS)).catch(() => [] as BrowserSnapshot["controls"]),
      includeScreenshot ? this.captureScreenshot(page) : Promise.resolve(null),
      Promise.all(session.context.pages().slice(0, MAX_PAGE_COUNT).map(async (tab, index) => ({ id: String(index), title: await tab.title().catch(() => ""), url: tab.url().slice(0, 2048), active: tab === page })))
    ]);
    const normalizedText = pageText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").slice(0, MAX_PAGE_TEXT);
    return { sessionId: session.id, providerId: session.providerId, revision: session.revision, url: page.url().slice(0, 2048), title: title.slice(0, 300), pageText: normalizedText, controls, tabs, screenshot };
  }

  private async captureScreenshot(page: Page): Promise<BrowserSnapshot["screenshot"]> {
    try {
      const data = await page.screenshot({ type: "jpeg", quality: 60, animations: "disabled", fullPage: false, timeout: 5_000 });
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

  private async sweepExpired(): Promise<void> {
    const now = Date.now();
    for (const session of this.sessions.values()) if (now - session.lastUsedAt > SESSION_IDLE_TTL_MS) await this.disposeSession(session);
  }

  private async disposeSession(session: BrowserSession): Promise<void> {
    if (session.disposed) return;
    session.disposed = true;
    this.sessions.delete(session.id);
    this.sessionKeys.delete(sessionKey(session.ownerId, session.sourceSessionId, session.providerId));
    await session.context.close().catch(() => undefined);
    await session.operationTail.catch(() => undefined);
  }
}
