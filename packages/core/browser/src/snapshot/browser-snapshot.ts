// 浏览器快照组装：外观/DPR 同步、CDP 帧元数据、活动会话快照、空闲快照与人工接管快照。
import type { ScreencastTabMeta } from "../session/screencast-manager";
import { clampDpr } from "../settings/browser-settings";
import type { BrowserTabEntry, SessionBrowserState } from "../session/browser-session-types";
import type { BrowserSessionSnapshot, BrowserTabItem } from "../types";
import { extractPageStructure } from "../runtime-utils";

export interface SnapshotRuntime {
  /** 当前浏览器可执行文件（用于快照回传展示）。 */
  executablePath: () => string | undefined;
  /** 当前会话是否有 SSE 帧流订阅者。 */
  hasStreamSubscribers: (sessionId: string) => boolean;
  /** 确保当前会话的 CDP 帧流在运行。 */
  ensureScreencast: (state: SessionBrowserState) => void;
}

/** 组装 screencast 需要的信息；无活动标签时返回 null。 */
export function buildScreencastMeta(state: SessionBrowserState): ScreencastTabMeta | null {
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
    ...(tab.embeddable !== undefined ? { embeddable: tab.embeddable } : {}),
    ...(state.lastActor ? { lastActor: state.lastActor } : {}),
    onFrameStored: (data, mime) => {
      tab.lastScreenshotBase64 = data;
      tab.lastScreenshotMime = mime;
      state.updatedAt = Date.now();
    },
  };
}

/** 同步会话主题与设备像素比；DPR 覆盖交由常驻 Screencast CDPSession 维护，不再建临时会话后立刻 detach 导致重置。 */
export async function applyAppearance(
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
    }
  }
  return changed;
}

/** 采集活动标签的页面信息、截图（可选）并序列化成前端契约快照。 */
export async function captureState(
  runtime: SnapshotRuntime,
  state: SessionBrowserState,
  tab: BrowserTabEntry,
  headless: boolean,
  withScreenshot = true,
  includeStructure = true,
): Promise<BrowserSessionSnapshot> {
  const url = tab.page.url();
  const title = await tab.page.title().catch(() => "");
  tab.title = title;
  const extracted = includeStructure
    ? await extractPageStructure(tab.page)
    : { elements: [], textExcerpt: "" };
  let screenshotBase64 = tab.lastScreenshotBase64;
  if (withScreenshot) {
    const buf = await tab.page.screenshot({ type: "png" }).catch(() => null);
    screenshotBase64 = buf?.toString("base64");
    if (screenshotBase64) {
      tab.lastScreenshotBase64 = screenshotBase64;
      tab.lastScreenshotMime = "image/png";
    }
  }
  if (runtime.hasStreamSubscribers(state.sessionId)) {
    runtime.ensureScreencast(state);
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
  const executablePath = runtime.executablePath();
  return {
    sessionId: state.sessionId,
    active: true,
    providerName: "playwright-local",
    ...(executablePath ? { executablePath } : {}),
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
    headless,
    elements: extracted.elements,
    textExcerpt: extracted.textExcerpt,
    consoleCount: state.consoleItems.length,
    networkCount: state.networkItems.length,
    errorCount,
    ...(tab.embeddable !== undefined ? { embeddable: tab.embeddable } : {}),
    ...(state.lastActor ? { lastActor: state.lastActor } : {}),
    ...(screenshotBase64 ? {
      screenshotBase64,
      screenshotMime: tab.lastScreenshotMime ?? "image/png",
    } : {}),
    updatedAt: state.updatedAt,
    ...(state.lastError ? { lastError: state.lastError } : {}),
  };
}

/** 会话不存在或标签已关闭时的空快照。 */
export function inactiveSnapshot(sessionId: string, state: SessionBrowserState | undefined, headless: boolean): BrowserSessionSnapshot {
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
    headless,
    elements: [],
    textExcerpt: "",
    consoleCount: state?.consoleItems.length ?? 0,
    networkCount: state?.networkItems.length ?? 0,
    errorCount: 0,
    updatedAt: Date.now(),
  };
}

/** 人工接管开关同步返回的快照：不等待页面读取，只反映会话当前状态。 */
export function takeoverSnapshot(state: SessionBrowserState, executablePath: string | undefined, headless: boolean): BrowserSessionSnapshot {
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
    ...(executablePath ? { executablePath } : {}),
    activeTabId: state.activeTabId,
    tabs,
    viewport: state.viewport,
    url: activeTab?.page.url() ?? "",
    title: activeTab?.title ?? "",
    canGoBack: Boolean(activeTab && activeTab.historyIndex > 0),
    canGoForward: Boolean(activeTab && activeTab.historyIndex >= 0 && activeTab.historyIndex < activeTab.history.length - 1),
    takeoverPaused: state.takeoverPaused,
    headless,
    elements: [],
    textExcerpt: "",
    consoleCount: state.consoleItems.length,
    networkCount: state.networkItems.length,
    errorCount: state.consoleItems.filter((c) => c.level === "error" || c.level === "network").length,
    ...(activeTab?.lastScreenshotBase64 ? { screenshotBase64: activeTab.lastScreenshotBase64 } : {}),
    updatedAt: state.updatedAt,
  };
}
