// 基于 playwright-core 驱动本机 Edge/Chrome，支持会话多标签页、动态视口同步、真实键鼠操作及 Console/Network 采集。
import { randomUUID } from "node:crypto";
import { chromium, type Browser } from "playwright-core";
import { BrowserSettingsStore } from "../settings/browser-settings";
import {
  applyAppearance,
  buildScreencastMeta,
  captureState,
  inactiveSnapshot,
  takeoverSnapshot,
  type SnapshotRuntime,
} from "../snapshot/browser-snapshot";
import { attachPopupHandler, attachTabListeners, openInternalPage } from "./browser-tabs";
import { SessionDriver, type SessionDriverHost } from "./session-driver";
import type { BrowserTabEntry, SessionBrowserState } from "./browser-session-types";
import { BrowserIdleThrottle } from "./browser-idle-throttle";
import { ScreencastManager, type StreamFrameListener } from "./screencast-manager";
import { clampViewport, detectLocalBrowserExecutable, validateBrowserUrl } from "../runtime-utils";
import type {
  BrowserConsoleItem,
  BrowserInputPayload,
  BrowserNetworkItem,
  BrowserSessionSnapshot,
  BrowserSettingsConfig,
} from "../types";

export { detectLocalBrowserExecutable, validateBrowserUrl };
export { BrowserSettingsStore, clampDpr } from "../settings/browser-settings";

/** 注入到受控页面的纯字符串初始化脚本：避免 tsdown/esbuild 插桩 __name 辅助函数导致页面报 ReferenceError。 */
const EMBEDDED_BROWSER_INIT_SCRIPT = [
  "window.__LFAA_EMBEDDED_BROWSER__ = true;",
  "(function () {",
  "  function applyOverscroll() {",
  "    if (document.getElementById('lfaa-browser-overscroll-guard')) return;",
  "    var style = document.createElement('style');",
  "    style.id = 'lfaa-browser-overscroll-guard';",
  "    style.textContent = 'html, body { overscroll-behavior: none !important; }';",
  "    var root = document.head || document.documentElement;",
  "    if (root) root.appendChild(style);",
  "  }",
  "  if (document.readyState === 'loading') {",
  "    document.addEventListener('DOMContentLoaded', applyOverscroll, { once: true });",
  "  } else {",
  "    applyOverscroll();",
  "  }",
  "})();",
].join("\n");

export class BrowserRuntime implements SessionDriverHost {
  private readonly settings: BrowserSettingsStore;
  private readonly driver = new SessionDriver(this);
  private browser: Browser | null = null;
  private launchedHeadless: boolean | null = null;
  private executablePath: string | undefined;
  private readonly sessions = new Map<string, SessionBrowserState>();
  private readonly screencast = new ScreencastManager();
  private readonly idleThrottle = new BrowserIdleThrottle();

  constructor(storeFilePath?: string) {
    this.settings = new BrowserSettingsStore(storeFilePath);
  }

  async getSettings(): Promise<BrowserSettingsConfig> {
    return this.settings.get();
  }

  async updateSettings(patch: Partial<BrowserSettingsConfig>): Promise<BrowserSettingsConfig> {
    const { config } = await this.settings.update(patch);
    if (this.launchedHeadless !== null && this.launchedHeadless !== config.headless) {
      await this.closeAll();
    }
    return config;
  }

  private async ensureBrowser(): Promise<Browser> {
    const settings = await this.getSettings();
    if (this.browser && this.browser.isConnected() && this.launchedHeadless === settings.headless) {
      return this.browser;
    }
    await this.closeAll();
    const executablePath = detectLocalBrowserExecutable(settings);
    if (!executablePath) {
      throw new Error("未检测到本机 Microsoft Edge 或 Chrome，请在「设置 → 浏览器」填写浏览器可执行文件路径。");
    }
    this.executablePath = executablePath;
    this.launchedHeadless = settings.headless;
    this.browser = await chromium.launch({
      executablePath,
      headless: settings.headless,
      // 锁定 2x 设备像素比并开启 GPU 光栅化加速（无显卡环境自动回退），确保兜底 CDP 视图同样清晰流畅。
      args: [
        "--disable-gpu-sandbox",
        "--enable-gpu-rasterization",
        "--ignore-gpu-blocklist",
        "--no-first-run",
        "--no-default-browser-check",
        "--force-device-scale-factor=2",
      ],
    });
    return this.browser;
  }

  /** @internal 由 SessionDriver 使用：准备（或复用）会话与活动标签。 */
  async ensureSession(
    sessionId: string,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<{ state: SessionBrowserState; tab: BrowserTabEntry }> {
    await this.idleThrottle.markActive(sessionId);
    const existing = this.sessions.get(sessionId);
    if (existing) {
      await applyAppearance(existing, appearance);
      const active = existing.tabs.get(existing.activeTabId);
      if (active && !active.page.isClosed()) {
        return { state: existing, tab: active };
      }
      const firstOpen = [...existing.tabs.values()].find((t) => !t.page.isClosed());
      if (firstOpen) {
        existing.activeTabId = firstOpen.tabId;
        return { state: existing, tab: firstOpen };
      }
      const page = await openInternalPage(existing).catch(() => null);
      if (page) {
        const tabId = `tab-${randomUUID().slice(0, 6)}`;
        const entry = attachTabListeners(existing, page, tabId);
        existing.activeTabId = tabId;
        return { state: existing, tab: entry };
      }
    }

    const browser = await this.ensureBrowser();
    const viewport = existing?.viewport ?? { width: 1024, height: 768 };
    // 与启动参数 --force-device-scale-factor=2 对齐，避免上下文与 Screencast DPR 不一致导致重采样模糊。
    const deviceScaleFactor = 2;
    const colorScheme: "dark" | "light" = appearance?.colorScheme ?? existing?.colorScheme ?? "dark";
    const context = await browser.newContext({ viewport, deviceScaleFactor, colorScheme });
    // 标记当前页面运行在内置浏览器内（防自嵌套互抢视口）并抑制根滚动越界；必须传纯字符串，避免打包器插桩 __name 报错。
    await context.addInitScript(EMBEDDED_BROWSER_INIT_SCRIPT).catch(() => {});
    const page = await context.newPage();
    const tabId = `tab-${randomUUID().slice(0, 6)}`;
    const state: SessionBrowserState = {
      sessionId,
      context,
      tabs: new Map(),
      activeTabId: tabId,
      viewport,
      deviceScaleFactor,
      colorScheme,
      internalPageOpening: 0,
      takeoverPaused: false,
      consoleItems: [],
      networkItems: [],
      updatedAt: Date.now(),
    };
    const tab = attachTabListeners(state, page, tabId);

    // 网页内 window.open / target="_blank" 的新标签由 browser-tabs 统一接管。
    attachPopupHandler(state);

    this.sessions.set(sessionId, state);
    return { state, tab };
  }

  /** @internal 由 SessionDriver 使用：Agent 操作前确认用户没有接管暂停。 */
  assertNotTakeoverPaused(state: SessionBrowserState, fromAgent: boolean): void {
    if (fromAgent && state.takeoverPaused) {
      const activeUrl = state.tabs.get(state.activeTabId)?.page.url() ?? "";
      throw new Error(
        `用户当前已开启「人工接管」亲自操控内置浏览器${activeUrl && activeUrl !== "about:blank" ? `（页面：${activeUrl}）` : ""}，Agent 浏览器操作已暂停。请勿重复调用浏览器工具，先向用户说明情况或等待用户点击「交还 Agent」后再继续。`,
      );
    }
  }

  /** 向 Agent 运行上下文提供当前会话的浏览器人工接管状态，确保用户接管后 Agent 立即知情。 */
  describeTakeoverHint(sessionId: string): string {
    const state = this.sessions.get(sessionId);
    if (!state || !state.takeoverPaused) return "";
    const activeTab = state.tabs.get(state.activeTabId);
    const url = activeTab && !activeTab.page.isClosed() ? activeTab.page.url() : "";
    const title = activeTab?.title?.trim() ?? "";
    const pageInfo = url && url !== "about:blank" ? `（当前页面：${title ? `${title} · ` : ""}${url}）` : "";
    return `【内置浏览器接管通知】用户当前已主动点击「接管」亲自操控内置浏览器${pageInfo}。浏览器控制权目前归用户所有，本轮请勿调用任何 browser_* 操控工具；如需用户协助或已完成其他工作，请明确告知用户并等待用户点击「交还 Agent」后再恢复浏览器自动化。`;
  }

  /** 快照组装所需的运行时依赖：可执行文件、SSE 订阅查询与帧流保活。 */
  private get snapshotRuntime(): SnapshotRuntime {
    return {
      executablePath: () => this.executablePath,
      hasStreamSubscribers: (sessionId) => this.screencast.hasSubscribers(sessionId),
      ensureScreencast: (state) => {
        void this.screencast.ensureRunning(state.sessionId, state.context, () => buildScreencastMeta(state), false);
      },
    };
  }

  /** @internal 由 SessionDriver 使用：按需截图并组装快照。 */
  async capture(
    state: SessionBrowserState,
    tab: BrowserTabEntry,
    withScreenshot = true,
    includeStructure = true,
  ): Promise<BrowserSessionSnapshot> {
    const { headless } = await this.getSettings();
    const snap = await captureState(this.snapshotRuntime, state, tab, headless, withScreenshot, includeStructure);
    if (headless && !this.screencast.hasSubscribers(state.sessionId)) {
      this.idleThrottle.schedule(
        state.sessionId,
        () => this.sessions.get(state.sessionId),
        () => this.screencast.hasSubscribers(state.sessionId),
      );
    }
    return snap;
  }

  /** @internal 由 SessionDriver 使用：当前会话是否有串流订阅者。 */
  hasStreamSubscribers(sessionId: string): boolean {
    return this.screencast.hasSubscribers(sessionId);
  }

  /** @internal 由 SessionDriver 使用：视口变化后重启串流，保持帧尺寸与新视口一致。 */
  async refreshStream(sessionId: string, state: SessionBrowserState): Promise<void> {
    await this.screencast.ensureRunning(sessionId, state.context, () => buildScreencastMeta(state), true);
  }

  subscribeStream(
    sessionId: string,
    listener: StreamFrameListener,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): () => void {
    void this.idleThrottle.markActive(sessionId);
    const off = this.screencast.subscribe(sessionId, listener);
    const existing = this.sessions.get(sessionId);
    if (existing) {
      void applyAppearance(existing, appearance).then((changed) =>
        this.screencast.ensureRunning(sessionId, existing.context, () => buildScreencastMeta(existing), changed),
      );
    }
    return () => {
      off();
      if (!this.screencast.hasSubscribers(sessionId) && this.launchedHeadless !== false) {
        this.idleThrottle.schedule(
          sessionId,
          () => this.sessions.get(sessionId),
          () => this.screencast.hasSubscribers(sessionId),
        );
      }
    };
  }

  async getSnapshot(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { headless } = await this.getSettings();
    const state = this.sessions.get(sessionId);
    const activeTab = state?.tabs.get(state.activeTabId);
    if (!state || !activeTab || activeTab.page.isClosed()) {
      return inactiveSnapshot(sessionId, state, headless);
    }
    return this.capture(state, activeTab, false, false);
  }

  async setViewport(
    sessionId: string,
    width: number,
    height: number,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<BrowserSessionSnapshot> {
    const next = clampViewport(width, height);
    const state = this.sessions.get(sessionId);
    if (!state) return this.getSnapshot(sessionId);
    const appearanceChanged = await applyAppearance(state, appearance);
    const sizeChanged = state.viewport.width !== next.width || state.viewport.height !== next.height;
    if (!sizeChanged && !appearanceChanged) {
      return this.getSnapshot(sessionId);
    }
    state.viewport = next;
    const activeTab = state.tabs.get(state.activeTabId);
    if (activeTab && !activeTab.page.isClosed()) {
      if (sizeChanged) {
        await activeTab.page.setViewportSize(next).catch(() => {});
      }
      await this.screencast.ensureRunning(sessionId, state.context, () => buildScreencastMeta(state), true);
      return this.capture(state, activeTab, !this.screencast.hasSubscribers(sessionId), false);
    }
    return this.getSnapshot(sessionId);
  }

  async createTab(
    sessionId: string,
    rawUrl?: string,
    fromAgent = false,
    viewport?: { width: number; height: number },
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<BrowserSessionSnapshot> {
    const { state } = await this.ensureSession(sessionId, appearance);
    this.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (viewport) {
      state.viewport = clampViewport(viewport.width, viewport.height);
    }
    const page = await openInternalPage(state);
    await page.setViewportSize(state.viewport).catch(() => {});
    const tabId = `tab-${randomUUID().slice(0, 6)}`;
    const entry = attachTabListeners(state, page, tabId);
    state.activeTabId = tabId;
    if (rawUrl?.trim()) {
      const { url } = validateBrowserUrl(rawUrl);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
    }
    return this.capture(state, entry, true, fromAgent);
  }

  async activateTab(sessionId: string, tabId: string, fromAgent = false): Promise<BrowserSessionSnapshot> {
    const { state } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    const target = state.tabs.get(tabId);
    if (!target || target.page.isClosed()) {
      throw new Error(`找不到目标标签页：${tabId}`);
    }
    state.activeTabId = tabId;
    await target.page.setViewportSize(state.viewport).catch(() => {});
    await target.page.bringToFront().catch(() => {});
    await this.screencast.ensureRunning(sessionId, state.context, () => buildScreencastMeta(state), true);
    return this.capture(state, target, !this.screencast.hasSubscribers(sessionId) || !target.lastScreenshotBase64, false);
  }

  async closeTab(sessionId: string, tabId: string, fromAgent = false): Promise<BrowserSessionSnapshot> {
    const { state } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    const target = state.tabs.get(tabId);
    if (target) {
      await target.page.close().catch(() => {});
      state.tabs.delete(tabId);
    }
    if (state.tabs.size === 0) {
      const page = await openInternalPage(state);
      await page.setViewportSize(state.viewport).catch(() => {});
      const nextId = `tab-${randomUUID().slice(0, 6)}`;
      const entry = attachTabListeners(state, page, nextId);
      state.activeTabId = nextId;
      await this.screencast.ensureRunning(sessionId, state.context, () => buildScreencastMeta(state), true);
      return this.capture(state, entry, !this.screencast.hasSubscribers(sessionId), false);
    }
    const nextTab = state.tabs.get(state.activeTabId) ?? state.tabs.values().next().value!;
    state.activeTabId = nextTab.tabId;
    await this.screencast.ensureRunning(sessionId, state.context, () => buildScreencastMeta(state), true);
    return this.capture(state, nextTab, !this.screencast.hasSubscribers(sessionId) || !nextTab.lastScreenshotBase64, false);
  }

  // 页面交互方法统一委托给 SessionDriver；host 只需提供会话准备、截图与串流能力。
  async navigate(sessionId: string, rawUrl: string, fromAgent = false, viewport?: { width: number; height: number }, appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" }): Promise<BrowserSessionSnapshot> {
    return this.driver.navigate(sessionId, rawUrl, fromAgent, viewport, appearance);
  }

  async goBack(sessionId: string): Promise<BrowserSessionSnapshot> { return this.driver.goBack(sessionId); }
  async goForward(sessionId: string): Promise<BrowserSessionSnapshot> { return this.driver.goForward(sessionId); }
  async reload(sessionId: string): Promise<BrowserSessionSnapshot> { return this.driver.reload(sessionId); }
  async snapshot(sessionId: string, withScreenshot = true): Promise<BrowserSessionSnapshot> { return this.driver.snapshot(sessionId, withScreenshot); }
  async evaluate(sessionId: string, expression: string, awaitPromise = false, fromAgent = false): Promise<unknown> { return this.driver.evaluate(sessionId, expression, awaitPromise, fromAgent); }
  async click(sessionId: string, target: { ref?: string; selector?: string; x?: number; y?: number; button?: "left" | "right" | "middle"; clickCount?: number }, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> { return this.driver.click(sessionId, target, fromAgent, fast); }
  async hover(sessionId: string, target: { ref?: string; selector?: string; x?: number; y?: number }, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> { return this.driver.hover(sessionId, target, fromAgent, fast); }
  async typeText(sessionId: string, target: { ref?: string; selector?: string; text: string; submit?: boolean }, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> { return this.driver.typeText(sessionId, target, fromAgent, fast); }
  async pressKey(sessionId: string, key: string, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> { return this.driver.pressKey(sessionId, key, fromAgent, fast); }
  async scroll(sessionId: string, deltaY: number, deltaX = 0, fromAgent = false, fast = false, point?: { x?: number; y?: number }): Promise<BrowserSessionSnapshot> { return this.driver.scroll(sessionId, deltaY, deltaX, fromAgent, fast, point); }

  /** 超轻量键鼠输入直通：仅在用户点击「接管」后才允许转发人工键鼠输入，彻底防止误触打断 Agent。 */
  async dispatchInput(sessionId: string, payload: BrowserInputPayload): Promise<void> {
    const state = this.sessions.get(sessionId);
    const activeTab = state?.tabs.get(state.activeTabId);
    if (!state || !state.takeoverPaused || !activeTab || activeTab.page.isClosed()) return;
    state.lastActor = "user";
    const handled = await this.screencast.dispatchInput(sessionId, activeTab.tabId, payload);
    if (handled) return;
    const { page } = activeTab;
    if (payload.kind === "wheel") {
      await page.mouse.move(payload.x, payload.y);
      await page.mouse.wheel(payload.deltaX, payload.deltaY);
    } else if (payload.kind === "mousemove") {
      await page.mouse.move(payload.x, payload.y);
    } else if (payload.kind === "mousedown") {
      await page.mouse.move(payload.x, payload.y);
      await page.mouse.down({ button: payload.button ?? "left", clickCount: payload.clickCount ?? 1 });
    } else if (payload.kind === "mouseup") {
      await page.mouse.move(payload.x, payload.y);
      await page.mouse.up({ button: payload.button ?? "left", clickCount: payload.clickCount ?? 1 });
    } else if (payload.kind === "keydown") {
      await page.keyboard.down(payload.key).catch(() => {});
    } else if (payload.kind === "keyup") {
      await page.keyboard.up(payload.key).catch(() => {});
    } else if (payload.kind === "text" && payload.text) {
      await page.keyboard.insertText(payload.text);
    }
  }

  setTakeover(sessionId: string, paused: boolean): BrowserSessionSnapshot | null {
    const state = this.sessions.get(sessionId);
    if (!state) return null;
    state.takeoverPaused = paused;
    state.updatedAt = Date.now();
    return takeoverSnapshot(state, this.executablePath, Boolean(this.launchedHeadless ?? true));
  }

  async setTakeoverAndSnapshot(sessionId: string, paused: boolean): Promise<BrowserSessionSnapshot> {
    const state = this.sessions.get(sessionId);
    if (state) state.takeoverPaused = paused;
    return this.getSnapshot(sessionId);
  }

  /** 将当前浏览模式切换为桌面有头 Edge（保留当前 URL）便于用户直接登录或扫码操作。 */
  async openDesktopTakeoverWindow(sessionId: string): Promise<BrowserSessionSnapshot> {
    const state = this.sessions.get(sessionId);
    const activeUrl = state?.tabs.get(state.activeTabId)?.page.url() ?? "";
    await this.updateSettings({ headless: false });
    const { state: nextState, tab } = await this.ensureSession(sessionId);
    nextState.takeoverPaused = true;
    if (activeUrl && activeUrl !== "about:blank") {
      await tab.page.goto(activeUrl, { waitUntil: "domcontentloaded", timeout: 25_000 }).catch(() => {});
    }
    return this.capture(nextState, tab, true);
  }

  getConsole(sessionId: string): BrowserConsoleItem[] {
    return this.sessions.get(sessionId)?.consoleItems.slice() ?? [];
  }

  getNetwork(sessionId: string): BrowserNetworkItem[] {
    return this.sessions.get(sessionId)?.networkItems.slice() ?? [];
  }

  clearLogs(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    state.consoleItems = [];
    state.networkItems = [];
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.idleThrottle.clear(sessionId);
    await this.screencast.stopSession(sessionId);
    const state = this.sessions.get(sessionId);
    if (!state) return;
    this.sessions.delete(sessionId);
    await state.context.close().catch(() => {});
  }

  async closeAll(): Promise<void> {
    await this.idleThrottle.disposeAll();
    await this.screencast.stopAll();
    const contexts = [...this.sessions.values()];
    this.sessions.clear();
    for (const s of contexts) {
      await s.context.close().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.launchedHeadless = null;
  }
}