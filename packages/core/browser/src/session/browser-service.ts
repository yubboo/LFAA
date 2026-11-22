// 基于 playwright-core 驱动本机 Edge/Chrome，支持会话多标签页、动态视口同步、真实键鼠操作及 Console/Network 采集。
import { randomUUID } from "node:crypto";
import { chromium, type Browser } from "playwright-core";
import { BrowserSettingsStore, clampDpr } from "../settings/browser-settings";
import {
  applyAppearance,
  buildScreencastMeta,
  captureState,
  inactiveSnapshot,
  takeoverSnapshot,
  type SnapshotRuntime,
} from "../snapshot/browser-snapshot";
import { attachTabListeners, openInternalPage } from "./browser-tabs";
import type { BrowserTabEntry, SessionBrowserState } from "./browser-session-types";
import { ScreencastManager, type StreamFrameListener } from "./screencast-manager";
import { clampViewport, detectLocalBrowserExecutable, validateBrowserUrl } from "../runtime-utils";
import type {
  BrowserConsoleItem,
  BrowserNetworkItem,
  BrowserSessionSnapshot,
  BrowserSettingsConfig,
} from "../types";

export { detectLocalBrowserExecutable, validateBrowserUrl };
export { BrowserSettingsStore, clampDpr } from "../settings/browser-settings";

export class BrowserRuntime {
  private readonly settings: BrowserSettingsStore;
  private browser: Browser | null = null;
  private launchedHeadless: boolean | null = null;
  private executablePath: string | undefined;
  private readonly sessions = new Map<string, SessionBrowserState>();
  private readonly screencast = new ScreencastManager();

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
      args: ["--disable-gpu-sandbox", "--no-first-run", "--no-default-browser-check"],
    });
    return this.browser;
  }

  private async ensureSession(
    sessionId: string,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<{ state: SessionBrowserState; tab: BrowserTabEntry }> {
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
    const deviceScaleFactor = clampDpr(appearance?.deviceScaleFactor ?? existing?.deviceScaleFactor);
    const colorScheme: "dark" | "light" = appearance?.colorScheme ?? existing?.colorScheme ?? "dark";
    const context = await browser.newContext({ viewport, deviceScaleFactor, colorScheme });
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

    // 捕获网页内 window.open 或 target="_blank" 新开窗口，忽略内部 newPage 调用。
    context.on("page", (popup) => {
      if (state.internalPageOpening > 0) return;
      for (const item of state.tabs.values()) {
        if (item.page === popup) return;
      }
      const newTabId = `tab-${randomUUID().slice(0, 6)}`;
      void popup.setViewportSize(state.viewport).catch(() => {});
      attachTabListeners(state, popup, newTabId);
      state.activeTabId = newTabId;
      state.updatedAt = Date.now();
    });

    this.sessions.set(sessionId, state);
    return { state, tab };
  }

  private assertNotTakeoverPaused(state: SessionBrowserState, fromAgent: boolean): void {
    if (fromAgent && state.takeoverPaused) {
      throw new Error("用户已在右侧浏览器面板开启「人工接管」暂停，请等待用户在面板操作后点击继续。");
    }
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

  /** 组装快照时统一读取 headless 设置，调用点保持与拆分前一致。 */
  private async capture(
    state: SessionBrowserState,
    tab: BrowserTabEntry,
    withScreenshot = true,
    includeStructure = true,
  ): Promise<BrowserSessionSnapshot> {
    const { headless } = await this.getSettings();
    return captureState(this.snapshotRuntime, state, tab, headless, withScreenshot, includeStructure);
  }

  subscribeStream(
    sessionId: string,
    listener: StreamFrameListener,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): () => void {
    const off = this.screencast.subscribe(sessionId, listener);
    const existing = this.sessions.get(sessionId);
    if (existing) {
      void applyAppearance(existing, appearance).then((changed) =>
        this.screencast.ensureRunning(sessionId, existing.context, () => buildScreencastMeta(existing), changed),
      );
    }
    return off;
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

  async activateTab(sessionId: string, tabId: string): Promise<BrowserSessionSnapshot> {
    const { state } = await this.ensureSession(sessionId);
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

  async closeTab(sessionId: string, tabId: string): Promise<BrowserSessionSnapshot> {
    const { state } = await this.ensureSession(sessionId);
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

  async navigate(
    sessionId: string,
    rawUrl: string,
    fromAgent = false,
    viewport?: { width: number; height: number },
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<BrowserSessionSnapshot> {
    const { url } = validateBrowserUrl(rawUrl);
    const { state, tab } = await this.ensureSession(sessionId, appearance);
    this.assertNotTakeoverPaused(state, fromAgent);
    let vpChanged = false;
    if (viewport) {
      const nextVp = clampViewport(viewport.width, viewport.height);
      if (state.viewport.width !== nextVp.width || state.viewport.height !== nextVp.height) {
        state.viewport = nextVp;
        vpChanged = true;
        await tab.page.setViewportSize(nextVp).catch(() => {});
      }
    }
    delete state.lastError;
    await tab.page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await tab.page.waitForLoadState("networkidle", { timeout: fromAgent ? 2500 : 1000 }).catch(() => {});
    if (vpChanged && this.screencast.hasSubscribers(sessionId)) {
      await this.screencast.ensureRunning(sessionId, state.context, () => buildScreencastMeta(state), true);
    }
    return this.capture(state, tab, true, fromAgent);
  }

  async goBack(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    if (tab.historyIndex > 0) {
      await tab.page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      tab.historyIndex -= 1;
    }
    return this.capture(state, tab, true, false);
  }

  async goForward(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    if (tab.historyIndex < tab.history.length - 1) {
      await tab.page.goForward({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      tab.historyIndex += 1;
    }
    return this.capture(state, tab, true, false);
  }

  async reload(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    if (tab.page.url() && tab.page.url() !== "about:blank") {
      await tab.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
    }
    return this.capture(state, tab, true, false);
  }

  async snapshot(sessionId: string, withScreenshot = true): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    return this.capture(state, tab, withScreenshot, true);
  }

  /** 在当前页面上下文执行表达式，用于读取 DOM、computed style、尺寸与动画等文本模型看不到的状态。 */
  async evaluate(sessionId: string, expression: string, awaitPromise = false, fromAgent = false): Promise<unknown> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    const source = expression.trim();
    if (!source) throw new Error("要执行的表达式不能为空。");
    return tab.page.evaluate(
      async ({ source: code, awaitPromise: wait }) => {
        // 页面上下文里执行；不经过 Node，也不读取本机文件。
        const value = new Function(`return (${code})`)();
        return wait && value && typeof (value as Promise<unknown>).then === "function"
          ? await (value as Promise<unknown>)
          : value;
      },
      { source, awaitPromise },
    );
  }

  async click(
    sessionId: string,
    target: { ref?: string; selector?: string; x?: number; y?: number; button?: "left" | "right" | "middle"; clickCount?: number },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    if (typeof target.x === "number" && typeof target.y === "number") {
      await tab.page.mouse.click(target.x, target.y, {
        button: target.button ?? "left",
        clickCount: target.clickCount ?? 1,
      });
    } else if (target.ref) {
      await tab.page.locator(`[data-lfaa-ref="${target.ref}"]`).first().click({ timeout: 8000 });
    } else if (target.selector) {
      await tab.page.locator(target.selector).first().click({ timeout: 8000 });
    } else {
      throw new Error("请提供 ref、selector 或坐标 (x, y)。");
    }
    if (fromAgent) await tab.page.waitForTimeout(200);
    else if (!fast) await tab.page.waitForTimeout(25);
    const needShot = fromAgent || (!fast && !this.screencast.hasSubscribers(sessionId));
    return this.capture(state, tab, needShot, fromAgent);
  }

  async hover(
    sessionId: string,
    target: { ref?: string; selector?: string; x?: number; y?: number },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    if (typeof target.x === "number" && typeof target.y === "number") {
      await tab.page.mouse.move(target.x, target.y);
    } else if (target.ref) {
      await tab.page.locator(`[data-lfaa-ref="${target.ref}"]`).first().hover({ timeout: 8000 });
    } else if (target.selector) {
      await tab.page.locator(target.selector).first().hover({ timeout: 8000 });
    }
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.screencast.hasSubscribers(sessionId));
    return this.capture(state, tab, needShot, fromAgent);
  }

  async typeText(
    sessionId: string,
    target: { ref?: string; selector?: string; text: string; submit?: boolean },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    const locator = target.ref
      ? tab.page.locator(`[data-lfaa-ref="${target.ref}"]`).first()
      : target.selector
        ? tab.page.locator(target.selector).first()
        : null;
    if (locator) {
      await locator.fill(target.text, { timeout: 8000 });
      if (target.submit) await locator.press("Enter");
    } else {
      await tab.page.keyboard.type(target.text);
      if (target.submit) await tab.page.keyboard.press("Enter");
    }
    if (fromAgent) await tab.page.waitForTimeout(150);
    const needShot = fromAgent || (!fast && !this.screencast.hasSubscribers(sessionId));
    return this.capture(state, tab, needShot, fromAgent);
  }

  async scroll(sessionId: string, deltaY: number, deltaX = 0, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    await tab.page.mouse.wheel(deltaX, deltaY);
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.screencast.hasSubscribers(sessionId));
    return this.capture(state, tab, needShot, fromAgent);
  }

  async pressKey(sessionId: string, key: string, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    await tab.page.keyboard.press(key);
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.screencast.hasSubscribers(sessionId));
    return this.capture(state, tab, needShot, fromAgent);
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
    await this.screencast.stopSession(sessionId);
    const state = this.sessions.get(sessionId);
    if (!state) return;
    this.sessions.delete(sessionId);
    await state.context.close().catch(() => {});
  }

  async closeAll(): Promise<void> {
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