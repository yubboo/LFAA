/**
 * 文件：useWorkbenchChrome.ts
 * 功能：维护 Workbench 尺寸、面板开合、快捷键与导航栏偏好。
 * 作用：沿用 DockKit 和 Settings 的布局配置，负责窗口订阅与卸载清理。
 * 关联文件：../../ApplicationWorkspace.tsx、../pure-utils.ts、packages/client/ui-dockkit。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import { readWorkbenchLeadingInsetWidth, useWorkbenchMetrics } from "lfaa-client-ui-dockkit/src/use-workbench-metrics.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "lfaa-client-ui-dockkit/src/workbench-preferences.js";
import { resolveShortcutSettings } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { sidebarRightRuntime } from "../../sidebar-right-runtime.js";
import { defaultChrome } from "../pure-utils.js";
import type { ApplicationId, ApplicationMode, UserSettings } from "lfaa-client-connection/src/api.js";
import type { ChromeState, ChromeStorageMetadata, NavigationLayout } from "../types.js";

const CHROME_KEY = "lfaa.module-workbench.chrome.v2";
const LEGACY_CHROME_KEY = "lfaa.module-workbench.chrome.v1";

function initialMetrics(responsiveRightDock = false): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1440 - GLOBAL_NAVIGATION_RAIL_WIDTH, 900, responsiveRightDock);
  const railWidth = window.innerWidth <= 420 ? GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH : GLOBAL_NAVIGATION_RAIL_WIDTH;
  return resolveWorkbenchLayoutMetrics(window.innerWidth - railWidth, window.innerHeight, responsiveRightDock);
}

function readChrome(mode: WorkbenchLayoutMode, responsiveRightDock = false): ChromeState {
  if (typeof window === "undefined") return defaultChrome(mode);
  try {
    const current = window.localStorage.getItem(CHROME_KEY);
    const usesPreviousDefaults = current === null;
    const value = JSON.parse(current ?? window.localStorage.getItem(LEGACY_CHROME_KEY) ?? "null") as Partial<ChromeState> | null;
    if (!value) return defaultChrome(mode);
    const stored = {
      leftCollapsed: Boolean(value.leftCollapsed),
      centerCollapsed: Boolean(value.centerCollapsed),
      rightCollapsed: usesPreviousDefaults ? true : Boolean(value.rightCollapsed),
      terminalOpen: Boolean(value.terminalOpen),
    };
    if (mode === "mobile") return { ...stored, leftCollapsed: true, rightCollapsed: responsiveRightDock ? stored.rightCollapsed : true, terminalOpen: false };
    if (mode === "compact" && !responsiveRightDock) return { ...stored, rightCollapsed: true };
    return stored;
  } catch {
    return defaultChrome(mode);
  }
}

function readChromeStorageMetadata(): ChromeStorageMetadata {
  if (typeof window === "undefined") return { hasSavedState: false, navigationLayout: null };
  try {
    const current = window.localStorage.getItem(CHROME_KEY);
    const legacy = window.localStorage.getItem(LEGACY_CHROME_KEY);
    const value = JSON.parse(current ?? legacy ?? "null") as { navigationLayout?: unknown } | null;
    const savedLayout = value?.navigationLayout;
    const navigationLayout = savedLayout === "left-two-column" || savedLayout === "three-column" || savedLayout === "right-tools" || savedLayout === "focus" ? savedLayout : null;
    const hasSavedState = value !== null && typeof value === "object" && (current !== null || legacy !== null);
    return { hasSavedState, navigationLayout };
  } catch {
    return { hasSavedState: false, navigationLayout: null };
  }
}

export interface UseWorkbenchChromeOptions {
  app: ApplicationId;
  mode: ApplicationMode;
  section: string;
  settings: UserSettings;
  onRightPanelSectionChange: (section: "context" | "applications") => void;
}

export function useWorkbenchChrome({ app, mode, section, settings, onRightPanelSectionChange }: UseWorkbenchChromeOptions) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const previewCloseTimer = useRef<number | null>(null);
  const leftPreviewTriggerRef = useRef<HTMLButtonElement>(null);
  const responsiveAppDock = true;
  const metrics = useWorkbenchMetrics(layoutRef, () => initialMetrics(responsiveAppDock), responsiveAppDock, readWorkbenchLeadingInsetWidth);
  const shortcuts = useMemo(() => resolveShortcutSettings(settings.shortcuts), [settings.shortcuts]);
  const leftPreviewContextRef = useRef({ app, mode, section, layoutMode: metrics.mode });
  const [chrome, setChrome] = useState(() => readChrome(metrics.mode, responsiveAppDock));
  const [chromeStorageMetadata] = useState(readChromeStorageMetadata);
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => readWorkbenchLeftWidth(metrics.left, metrics.containerWidth));
  const [leftPreviewOpen, setLeftPreviewOpen] = useState(false);
  const [centerCollapsePreview, setCenterCollapsePreview] = useState<boolean | null>(null);
  const appliedResponsiveLayout = useRef<string | null>(null);
  const responsiveLeftRestore = useRef<boolean | null>(null);
  const appliedNavigationLayout = useRef<NavigationLayout | null>(chromeStorageMetadata.navigationLayout);
  const centerCollapsed = chrome.centerCollapsed;
  const setCenterCollapsed = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    setChrome(current => ({ ...current, centerCollapsed: typeof next === "function" ? next(current.centerCollapsed) : next }));
  }, []);

  const showRightPanelSection = useCallback((nextSection: "context" | "applications") => {
    const sectionToShow = mode === "normal" ? "context" : nextSection;
    onRightPanelSectionChange(sectionToShow);
    sidebarRightRuntime.select(null);
    setChrome(current => ({ ...current, rightCollapsed: false, ...(metrics.mode !== "desktop" ? { leftCollapsed: true } : {}) }));
  }, [metrics.mode, mode, onRightPanelSectionChange]);

  const toggleLeft = useCallback(() => {
    responsiveLeftRestore.current = null;
    if (!chrome.leftCollapsed && centerCollapsed && chrome.rightCollapsed) setCenterCollapsed(false);
    setChrome(current => ({ ...current, leftCollapsed: !current.leftCollapsed, ...(metrics.mode !== "desktop" && current.leftCollapsed ? { rightCollapsed: true } : {}) }));
  }, [centerCollapsed, chrome.leftCollapsed, chrome.rightCollapsed, metrics.mode, setCenterCollapsed]);

  const toggleRight = useCallback(() => {
    if (chrome.rightCollapsed) showRightPanelSection("context");
    else setChrome(current => ({ ...current, rightCollapsed: true }));
  }, [chrome.rightCollapsed, showRightPanelSection]);

  const toggleTerminal = useCallback(() => {
    if (settings.general.terminalPosition === "right") showRightPanelSection("context");
    setChrome(current => ({ ...current, terminalOpen: !current.terminalOpen, ...(settings.general.terminalPosition === "right" ? { rightCollapsed: false } : {}) }));
  }, [settings.general.terminalPosition, showRightPanelSection]);

  const openTerminal = useCallback(() => {
    if (settings.general.terminalPosition === "right") showRightPanelSection("context");
    setChrome(current => ({ ...current, terminalOpen: true, ...(settings.general.terminalPosition === "right" ? { rightCollapsed: false } : {}) }));
  }, [settings.general.terminalPosition, showRightPanelSection]);

  const clearPreviewClose = useCallback(() => {
    if (previewCloseTimer.current !== null) {
      window.clearTimeout(previewCloseTimer.current);
      previewCloseTimer.current = null;
    }
  }, []);
  const openLeftPreview = useCallback(() => {
    if (!chrome.leftCollapsed || metrics.mode === "mobile") return;
    clearPreviewClose();
    setLeftPreviewOpen(true);
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);
  const closeLeftPreview = useCallback(() => {
    clearPreviewClose();
    if (!chrome.leftCollapsed || metrics.mode === "mobile") {
      setLeftPreviewOpen(false);
      return;
    }
    const closeTimer = window.setTimeout(() => {
      if (previewCloseTimer.current !== closeTimer) return;
      previewCloseTimer.current = null;
      const previewPane = layoutRef.current?.querySelector<HTMLElement>(".module-left-preview");
      if (leftPreviewTriggerRef.current?.matches(":hover, :focus-visible") || previewPane?.matches(":hover, :focus-within")) return;
      setLeftPreviewOpen(false);
    }, 160);
    previewCloseTimer.current = closeTimer;
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);

  useLayoutEffect(() => {
    const responsiveLayoutKey = `${metrics.mode}:${mode}`;
    if (appliedResponsiveLayout.current === responsiveLayoutKey) return;
    appliedResponsiveLayout.current = responsiveLayoutKey;
    if (metrics.mode === "desktop") {
      const previous = responsiveLeftRestore.current;
      responsiveLeftRestore.current = null;
      if (previous !== null) setChrome(current => ({ ...current, leftCollapsed: previous }));
      return;
    }
    setChrome(current => {
      const hideLeft = metrics.mode === "mobile" || metrics.mode === "compact" && (mode === "normal" || mode === "ai-work" && !current.rightCollapsed);
      if (hideLeft && responsiveLeftRestore.current === null) responsiveLeftRestore.current = current.leftCollapsed;
      const leftCollapsed = hideLeft || current.leftCollapsed;
      const terminalOpen = metrics.mode === "mobile" ? false : current.terminalOpen;
      if (leftCollapsed === current.leftCollapsed && terminalOpen === current.terminalOpen) return current;
      return { ...current, leftCollapsed, terminalOpen };
    });
  }, [metrics.mode, mode]);

  useEffect(() => {
    const previousNavigationLayout = appliedNavigationLayout.current;
    if (previousNavigationLayout === settings.general.navigationLayout) return;
    appliedNavigationLayout.current = settings.general.navigationLayout;
    if (previousNavigationLayout === null && chromeStorageMetadata.hasSavedState) return;
    const initialPreference = previousNavigationLayout === null;
    const mobile = metrics.mode === "mobile";
    const hidesLeft = settings.general.navigationLayout === "right-tools" || settings.general.navigationLayout === "focus";
    const hidesRight = settings.general.navigationLayout === "left-two-column" || settings.general.navigationLayout === "focus";
    const keepsThreeColumnDefaultClosed = initialPreference && settings.general.navigationLayout === "three-column";
    setChrome(current => {
      const responsiveLeftCollapsed = mobile || metrics.mode === "compact" && (mode === "normal" || mode === "ai-work" && !current.rightCollapsed);
      const leftCollapsed = responsiveLeftCollapsed || hidesLeft;
      const rightCollapsed = keepsThreeColumnDefaultClosed ? current.rightCollapsed : hidesRight;
      if (leftCollapsed === current.leftCollapsed && rightCollapsed === current.rightCollapsed) return current;
      return { ...current, leftCollapsed, rightCollapsed };
    });
  }, [chromeStorageMetadata.hasSavedState, metrics.mode, mode, settings.general.navigationLayout]);

  useEffect(() => {
    window.localStorage.setItem(CHROME_KEY, JSON.stringify({ ...chrome, leftCollapsed: responsiveLeftRestore.current ?? chrome.leftCollapsed, navigationLayout: settings.general.navigationLayout }));
  }, [chrome, settings.general.navigationLayout]);
  useEffect(() => { saveWorkbenchLeftWidth(leftPaneWidth, metrics.left); }, [leftPaneWidth, metrics.left.max, metrics.left.min]);
  useEffect(() => () => {
    if (previewCloseTimer.current !== null) {
      window.clearTimeout(previewCloseTimer.current);
      previewCloseTimer.current = null;
    }
  }, []);
  useEffect(() => {
    if (!chrome.leftCollapsed || metrics.mode === "mobile") {
      clearPreviewClose();
      setLeftPreviewOpen(false);
    }
  }, [chrome.leftCollapsed, clearPreviewClose, metrics.mode]);
  useLayoutEffect(() => {
    const previous = leftPreviewContextRef.current;
    if (previous.app === app && previous.mode === mode && previous.section === section && previous.layoutMode === metrics.mode) return;
    leftPreviewContextRef.current = { app, mode, section, layoutMode: metrics.mode };
    clearPreviewClose();
    setLeftPreviewOpen(false);
  }, [app, clearPreviewClose, metrics.mode, mode, section]);

  return {
    layoutRef,
    leftPreviewTriggerRef,
    responsiveAppDock,
    metrics,
    shortcuts,
    chrome,
    setChrome,
    chromeStorageMetadata,
    leftPaneWidth,
    setLeftPaneWidth,
    leftPreviewOpen,
    centerCollapsed,
    centerCollapsePreview,
    setCenterCollapsePreview,
    setCenterCollapsed,
    showRightPanelSection,
    toggleLeft,
    toggleRight,
    toggleTerminal,
    openTerminal,
    openLeftPreview,
    closeLeftPreview,
    clearPreviewClose,
    responsiveLeftRestore,
  };
}
