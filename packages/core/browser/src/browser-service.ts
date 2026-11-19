// 基于 playwright-core 驱动本机 Edge/Chrome，支持会话多标签页、动态视口同步、真实键鼠操作及 Console/Network 采集。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { clampViewport, detectLocalBrowserExecutable, extractPageStructure, validateBrowserUrl } from "./runtime-utils";
import { ScreencastManager, type ScreencastTabMeta, type StreamFrameListener } from "./screencast-manager";
import type {
  BrowserConsoleItem,
  BrowserNetworkItem,
  BrowserSessionSnapshot,
  BrowserSettingsConfig,
  BrowserTabItem,
} from "./types";

export { detectLocalBrowserExecutable, validateBrowserUrl };

const DEFAULT_SETTINGS_PATH = join(homedir(), ".lfaa", "browser-settings.json");
const MAX_LOG_ITEMS = 120;

function clampDpr(raw?: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 2;
  return Math.max(1, Math.min(2.5, Math.round(raw * 100) / 100));
}

const DEFAULT_SETTINGS: BrowserSettingsConfig = {
  preferredChannel: "auto",
  customExecutablePath: "",
  headless: true,
  autoApproveLocalhost: true,
};

interface BrowserTabEntry {
  tabId: string;
  page: Page;
  title: string;
  history: string[];
  historyIndex: number;
  lastScreenshotBase64?: string;
  lastScreenshotMime?: "image/png" | "image/jpeg";
}

interface SessionBrowserState {
  sessionId: string;
  context: BrowserContext;
  tabs: Map<string, BrowserTabEntry>;
  activeTabId: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  colorScheme: "dark" | "light";
  internalPageOpening: number;
  takeoverPaused: boolean;
  consoleItems: BrowserConsoleItem[];
  networkItems: BrowserNetworkItem[];
  lastError?: string;
  updatedAt: number;
}

export class BrowserRuntime {
  private readonly storeFilePath: string;
  private browser: Browser | null = null;
  private launchedHeadless: boolean | null = null;
  private executablePath: string | undefined;
  private readonly sessions = new Map<string, SessionBrowserState>();
  private readonly screencast = new ScreencastManager();
  private settingsCache: BrowserSettingsConfig | null = null;

  constructor(storeFilePath?: string) {
    this.storeFilePath = storeFilePath ? resolve(storeFilePath) : DEFAULT_SETTINGS_PATH;
  }

  async getSettings(): Promise<BrowserSettingsConfig> {
    if (this.settingsCache) return this.settingsCache;
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<BrowserSettingsConfig>;
      this.settingsCache = {
        preferredChannel: parsed.preferredChannel === "msedge" || parsed.preferredChannel === "chrome" ? parsed.preferredChannel : "auto",
        customExecutablePath: typeof parsed.customExecutablePath === "string" ? parsed.customExecutablePath : "",
        headless: typeof parsed.headless === "boolean" ? parsed.headless : true,
        autoApproveLocalhost: typeof parsed.autoApproveLocalhost === "boolean" ? parsed.autoApproveLocalhost : true,
      };
    } catch {
      this.settingsCache = { ...DEFAULT_SETTINGS };
    }
    return this.settingsCache;
  }

  async updateSettings(patch: Partial<BrowserSettingsConfig>): Promise<BrowserSettingsConfig> {
    const current = await this.getSettings();
    const next: BrowserSettingsConfig = {
      preferredChannel: patch.preferredChannel ?? current.preferredChannel,
      customExecutablePath: typeof patch.customExecutablePath === "string" ? patch.customExecutablePath.trim() : current.customExecutablePath,
      headless: typeof patch.headless === "boolean" ? patch.headless : current.headless,
      autoApproveLocalhost: typeof patch.autoApproveLocalhost === "boolean" ? patch.autoApproveLocalhost : current.autoApproveLocalhost,
    };
    this.settingsCache = next;
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(next, null, 2), "utf8");
    if (this.launchedHeadless !== null && this.launchedHeadless !== next.headless) {
      await this.closeAll();
    }
    return next;
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

  private attachTabListeners(state: SessionBrowserState, page: Page, tabId: string): BrowserTabEntry {
    const entry: BrowserTabEntry = {
      tabId,
      page,
      title: "",
      history: [],
      historyIndex: -1,
    };
    const pushConsole = (item: BrowserConsoleItem) => {
      state.consoleItems.push(item);
      if (state.consoleItems.length > MAX_LOG_ITEMS) {
        state.consoleItems.splice(0, state.consoleItems.length - MAX_LOG_ITEMS);
      }
      state.updatedAt = Date.now();
    };
    const pushNetwork = (item: BrowserNetworkItem) => {
      state.networkItems.push(item);
      if (state.networkItems.length > MAX_LOG_ITEMS) {
        state.networkItems.splice(0, state.networkItems.length - MAX_LOG_ITEMS);
      }
      state.updatedAt = Date.now();
    };

    page.on("console", (msg) => {
      const type = msg.type();
      const level = type === "error" ? "error" : type === "warning" ? "warning" : "log";
      pushConsole({ level, text: msg.text().slice(0, 500), timestamp: Date.now() });
    });
    page.on("pageerror", (err) => {
      pushConsole({ level: "error", text: err.message.slice(0, 500), timestamp: Date.now() });
    });
    page.on("response", (res) => {
      const url = res.url();
      const status = res.status();
      pushNetwork({
        id: randomUUID(),
        method: res.request().method(),
        status,
        url,
        failed: status >= 400,
        timestamp: Date.now(),
      });
      if (status >= 400) {
        pushConsole({ level: "network", text: `HTTP ${status} ${url}`, url, timestamp: Date.now() });
      }
    });
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        const landed = frame.url();
        if (landed && landed !== "about:blank" && entry.history[entry.historyIndex] !== landed) {
          entry.history = entry.history.slice(0, entry.historyIndex + 1);
          entry.history.push(landed);
          entry.historyIndex = entry.history.length - 1;
        }
      }
    });
    page.on("close", () => {
      state.tabs.delete(tabId);
      if (state.activeTabId === tabId) {
        const next = state.tabs.keys().next().value;
        state.activeTabId = typeof next === "string" ? next : "";
      }
    });
    state.tabs.set(tabId, entry);
    return entry;
  }

  private async openInternalPage(state: SessionBrowserState): Promise<Page> {
    state.internalPageOpening += 1;
    try {
      return await state.context.newPage();
    } finally {
      state.internalPageOpening -= 1;
    }
  }

  private async ensureSession(
    sessionId: string,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<{ state: SessionBrowserState; tab: BrowserTabEntry }> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      await this.applyAppearance(existing, appearance);
      const active = existing.tabs.get(existing.activeTabId);
      if (active && !active.page.isClosed()) {
        return { state: existing, tab: active };
      }
      const firstOpen = [...existing.tabs.values()].find((t) => !t.page.isClosed());
      if (firstOpen) {
        existing.activeTabId = firstOpen.tabId;
        return { state: existing, tab: firstOpen };
      }
      const page = await this.openInternalPage(existing).catch(() => null);
      if (page) {
        const tabId = `tab-${randomUUID().slice(0, 6)}`;
        const entry = this.attachTabListeners(existing, page, tabId);
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
    const tab = this.attachTabListeners(state, page, tabId);

    // 捕获网页内 window.open 或 target="_blank" 新开窗口，忽略内部 newPage 调用。
    context.on("page", (popup) => {
      if (state.internalPageOpening > 0) return;
      for (const item of state.tabs.values()) {
        if (item.page === popup) return;
      }
      const newTabId = `tab-${randomUUID().slice(0, 6)}`;
      void popup.setViewportSize(state.viewport).catch(() => {});
      this.attachTabListeners(state, popup, newTabId);
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

  private buildScreencastMeta(state: SessionBrowserState): ScreencastTabMeta | null {
    const tab = state.tabs.get(state.activeTabId);
    if (!tab || tab.page.isClosed()) return null;
    return {
      tabId: tab.tabId,
      page: tab.page,
      title: tab.title,
      canGoBack: tab.historyIndex > 0,
      canGoForward: tab.historyIndex >= 0 && tab.historyIndex < tab.history.length - 1,
      errorCount: state.consoleItems.filter((c) => c.level === "error" || c.level === "network").length,
      consoleCount: state.consoleItems.length,
      networkCount: state.networkItems.length,
      viewport: state.viewport,
      deviceScaleFactor: state.deviceScaleFactor,
      colorScheme: state.colorScheme,
      onFrameStored: (data) => {
        tab.lastScreenshotBase64 = data;
        tab.lastScreenshotMime = "image/jpeg";
        state.updatedAt = Date.now();
      },
    };
  }

  private async applyAppearance(
    state: SessionBrowserState,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<boolean> {
    let changed = false;
    if (appearance?.colorScheme && appearance.colorScheme !== state.colorScheme) {
      state.colorScheme = appearance.colorScheme;
      changed = true;
      await Promise.all(
        [...state.tabs.values()]
          .filter((t) => !t.page.isClosed())
          .map((t) => t.page.emulateMedia({ colorScheme: appearance.colorScheme! }).catch(() => {})),
      );
    }
    if (typeof appearance?.deviceScaleFactor === "number") {
      const nextDpr = clampDpr(appearance.deviceScaleFactor);
      if (Math.abs(nextDpr - state.deviceScaleFactor) > 0.05) {
        state.deviceScaleFactor = nextDpr;
        changed = true;
        const activeTab = state.tabs.get(state.activeTabId);
        if (activeTab && !activeTab.page.isClosed()) {
          try {
            const cdp = await state.context.newCDPSession(activeTab.page);
            await cdp.send("Emulation.setDeviceMetricsOverride", {
              width: state.viewport.width,
              height: state.viewport.height,
              deviceScaleFactor: nextDpr,
              mobile: false,
            });
            await cdp.detach().catch(() => {});
          } catch {
            // 忽略非 CDP 上下文
          }
        }
      }
    }
    return changed;
  }

  subscribeStream(
    sessionId: string,
    listener: StreamFrameListener,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): () => void {
    const off = this.screencast.subscribe(sessionId, listener);
    const existing = this.sessions.get(sessionId);
    if (existing) {
      void this.applyAppearance(existing, appearance).then((changed) =>
        this.screencast.ensureRunning(sessionId, existing.context, () => this.buildScreencastMeta(existing), changed),
      );
    }
    return off;
  }

  private async captureState(
    state: SessionBrowserState,
    tab: BrowserTabEntry,
    withScreenshot = true,
    includeStructure = true,
  ): Promise<BrowserSessionSnapshot> {
    const settings = await this.getSettings();
    const url = tab.page.url();
    const title = await tab.page.title().catch(() => "");
    tab.title = title;
    const extracted = includeStructure
      ? await extractPageStructure(tab.page)
      : { elements: [], textExcerpt: "" };
    if (withScreenshot) {
      const useJpeg = !includeStructure;
      const buf = await tab.page.screenshot(useJpeg ? { type: "jpeg", quality: 90 } : { type: "png" }).catch(() => null);
      if (buf) {
        tab.lastScreenshotBase64 = buf.toString("base64");
        tab.lastScreenshotMime = useJpeg ? "image/jpeg" : "image/png";
      }
    }
    if (this.screencast.hasSubscribers(state.sessionId)) {
      void this.screencast.ensureRunning(state.sessionId, state.context, () => this.buildScreencastMeta(state), false);
    }
    state.updatedAt = Date.now();
    const tabs: BrowserTabItem[] = [...state.tabs.values()]
      .filter((t) => !t.page.isClosed())
      .map((t) => ({
        tabId: t.tabId,
        title: t.title || t.page.url() || "新标签页",
        url: t.page.url(),
        active: t.tabId === state.activeTabId,
      }));
    const errorCount = state.consoleItems.filter((c) => c.level === "error" || c.level === "network").length;
    return {
      sessionId: state.sessionId,
      active: true,
      providerName: "playwright-local",
      ...(this.executablePath ? { executablePath: this.executablePath } : {}),
      activeTabId: tab.tabId,
      tabs,
      viewport: state.viewport,
      deviceScaleFactor: state.deviceScaleFactor,
      colorScheme: state.colorScheme,
      url,
      title,
      canGoBack: tab.historyIndex > 0,
      canGoForward: tab.historyIndex >= 0 && tab.historyIndex < tab.history.length - 1,
      takeoverPaused: state.takeoverPaused,
      headless: settings.headless,
      elements: extracted.elements,
      textExcerpt: extracted.textExcerpt,
      consoleCount: state.consoleItems.length,
      networkCount: state.networkItems.length,
      errorCount,
      ...(tab.lastScreenshotBase64 ? {
        screenshotBase64: tab.lastScreenshotBase64,
        screenshotMime: tab.lastScreenshotMime ?? "image/png",
      } : {}),
      updatedAt: state.updatedAt,
      ...(state.lastError ? { lastError: state.lastError } : {}),
    };
  }

  async getSnapshot(sessionId: string): Promise<BrowserSessionSnapshot> {
    const settings = await this.getSettings();
    const state = this.sessions.get(sessionId);
    const activeTab = state?.tabs.get(state.activeTabId);
    if (!state || !activeTab || activeTab.page.isClosed()) {
      return {
        sessionId,
        active: false,
        activeTabId: "",
        tabs: [],
        viewport: state?.viewport ?? { width: 1024, height: 768 },
        deviceScaleFactor: state?.deviceScaleFactor ?? 2,
        colorScheme: state?.colorScheme ?? "dark",
        url: "",
        title: "",
        canGoBack: false,
        canGoForward: false,
        takeoverPaused: false,
        headless: settings.headless,
        elements: [],
        textExcerpt: "",
        consoleCount: state?.consoleItems.length ?? 0,
        networkCount: state?.networkItems.length ?? 0,
        errorCount: 0,
        updatedAt: Date.now(),
      };
    }
    return this.captureState(state, activeTab, false, false);
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
    const appearanceChanged = await this.applyAppearance(state, appearance);
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
      await this.screencast.ensureRunning(sessionId, state.context, () => this.buildScreencastMeta(state), true);
      return this.captureState(state, activeTab, !this.screencast.hasSubscribers(sessionId), false);
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
    const page = await this.openInternalPage(state);
    await page.setViewportSize(state.viewport).catch(() => {});
    const tabId = `tab-${randomUUID().slice(0, 6)}`;
    const entry = this.attachTabListeners(state, page, tabId);
    state.activeTabId = tabId;
    if (rawUrl?.trim()) {
      const { url } = validateBrowserUrl(rawUrl);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
    }
    return this.captureState(state, entry, true, fromAgent);
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
    await this.screencast.ensureRunning(sessionId, state.context, () => this.buildScreencastMeta(state), true);
    return this.captureState(state, target, !this.screencast.hasSubscribers(sessionId) || !target.lastScreenshotBase64, false);
  }

  async closeTab(sessionId: string, tabId: string): Promise<BrowserSessionSnapshot> {
    const { state } = await this.ensureSession(sessionId);
    const target = state.tabs.get(tabId);
    if (target) {
      await target.page.close().catch(() => {});
      state.tabs.delete(tabId);
    }
    if (state.tabs.size === 0) {
      const page = await this.openInternalPage(state);
      await page.setViewportSize(state.viewport).catch(() => {});
      const nextId = `tab-${randomUUID().slice(0, 6)}`;
      const entry = this.attachTabListeners(state, page, nextId);
      state.activeTabId = nextId;
      await this.screencast.ensureRunning(sessionId, state.context, () => this.buildScreencastMeta(state), true);
      return this.captureState(state, entry, !this.screencast.hasSubscribers(sessionId), false);
    }
    const nextTab = state.tabs.get(state.activeTabId) ?? state.tabs.values().next().value!;
    state.activeTabId = nextTab.tabId;
    await this.screencast.ensureRunning(sessionId, state.context, () => this.buildScreencastMeta(state), true);
    return this.captureState(state, nextTab, !this.screencast.hasSubscribers(sessionId) || !nextTab.lastScreenshotBase64, false);
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
      await this.screencast.ensureRunning(sessionId, state.context, () => this.buildScreencastMeta(state), true);
    }
    return this.captureState(state, tab, true, fromAgent);
  }

  async goBack(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    if (tab.historyIndex > 0) {
      await tab.page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      tab.historyIndex -= 1;
    }
    return this.captureState(state, tab, true, false);
  }

  async goForward(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    if (tab.historyIndex < tab.history.length - 1) {
      await tab.page.goForward({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      tab.historyIndex += 1;
    }
    return this.captureState(state, tab, true, false);
  }

  async reload(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    if (tab.page.url() && tab.page.url() !== "about:blank") {
      await tab.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
    }
    return this.captureState(state, tab, true, false);
  }

  async snapshot(sessionId: string, withScreenshot = true): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    return this.captureState(state, tab, withScreenshot, true);
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
    return this.captureState(state, tab, needShot, fromAgent);
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
    return this.captureState(state, tab, needShot, fromAgent);
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
    return this.captureState(state, tab, needShot, fromAgent);
  }

  async scroll(sessionId: string, deltaY: number, deltaX = 0, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    await tab.page.mouse.wheel(deltaX, deltaY);
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.screencast.hasSubscribers(sessionId));
    return this.captureState(state, tab, needShot, fromAgent);
  }

  async pressKey(sessionId: string, key: string, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.ensureSession(sessionId);
    this.assertNotTakeoverPaused(state, fromAgent);
    await tab.page.keyboard.press(key);
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.screencast.hasSubscribers(sessionId));
    return this.captureState(state, tab, needShot, fromAgent);
  }

  setTakeover(sessionId: string, paused: boolean): BrowserSessionSnapshot | null {
    const state = this.sessions.get(sessionId);
    if (!state) return null;
    state.takeoverPaused = paused;
    state.updatedAt = Date.now();
    const activeTab = state.tabs.get(state.activeTabId);
    const tabs: BrowserTabItem[] = [...state.tabs.values()]
      .filter((t) => !t.page.isClosed())
      .map((t) => ({
        tabId: t.tabId,
        title: t.title || t.page.url() || "新标签页",
        url: t.page.url(),
        active: t.tabId === state.activeTabId,
      }));
    return {
      sessionId: state.sessionId,
      active: Boolean(activeTab && !activeTab.page.isClosed()),
      ...(this.executablePath ? { executablePath: this.executablePath } : {}),
      activeTabId: state.activeTabId,
      tabs,
      viewport: state.viewport,
      url: activeTab?.page.url() ?? "",
      title: activeTab?.title ?? "",
      canGoBack: Boolean(activeTab && activeTab.historyIndex > 0),
      canGoForward: Boolean(activeTab && activeTab.historyIndex >= 0 && activeTab.historyIndex < activeTab.history.length - 1),
      takeoverPaused: state.takeoverPaused,
      headless: Boolean(this.launchedHeadless ?? true),
      elements: [],
      textExcerpt: "",
      consoleCount: state.consoleItems.length,
      networkCount: state.networkItems.length,
      errorCount: state.consoleItems.filter((c) => c.level === "error" || c.level === "network").length,
      ...(activeTab?.lastScreenshotBase64 ? { screenshotBase64: activeTab.lastScreenshotBase64 } : {}),
      updatedAt: state.updatedAt,
    };
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
    return this.captureState(nextState, tab, true);
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
