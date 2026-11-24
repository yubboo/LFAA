// 全高全宽内置浏览器视图：双引擎渲染（可嵌入页默认原生直连，拦截站与 Agent 实操自动切高清 Canvas 协同）。
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserDevToolsDrawer, type DevToolsTab } from "./BrowserDevToolsDrawer";
import { BrowserDeviceBar, BROWSER_DEVICE_PRESETS } from "./BrowserDeviceBar";
import { BrowserTabs } from "./BrowserTabs";
import { BrowserToolbar } from "./BrowserToolbar";
import { BrowserViewport } from "./BrowserViewport";
import { getDesktopBrowserBridge } from "../api/desktop-browser-bridge";
import type { FrameDrawer } from "./BrowserCanvasViewport";
import { resolveEffectiveRenderMode } from "./browser-render-mode";
import { useBrowserSessionSync } from "./useBrowserSessionSync";
import {
  clearBrowserLogs,
  controlBrowserNav,
  fetchBrowserConsole,
  fetchBrowserNetwork,
  fetchBrowserState,
  manageBrowserTab,
  navigateBrowser,
  toggleBrowserTakeover,
  type BrowserConsoleItem,
  type BrowserNetworkItem,
  type BrowserSessionSnapshot,
} from "../api/browser-client";
import styles from "./RightBrowserPane.module.css";

/** 过滤浏览器内部错误页地址（如 chrome-error://chromewebdata/），避免覆盖用户真实网址。 */
function isDisplayableBrowserUrl(url: string | undefined): url is string {
  return Boolean(url && url !== "about:blank" && !/^(?:chrome|edge)-error:/iu.test(url));
}

/** 清洗异常文本中的 ANSI 控制符与 Playwright Call log 尾巴，避免原始终端转义码直出界面。 */
function formatBrowserUiError(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err))
    .replace(/\u001b\[[0-9;]*m/gu, "")
    .split(/\bCall log:/u)[0]!
    .trim();
  return raw.replace(/^page\.goto:\s*/u, "") || "页面加载失败";
}

export function RightBrowserPane({
  sessionId,
  isZh,
  initialUrl,
  hideTabStrip = false,
  agentRunning = false,
  browserAutomationActive = false,
  browserActivity,
  externalState,
  devtoolsRequest,
  onSnapshotChange,
  onAttachPage,
}: {
  sessionId: string;
  isZh: boolean;
  initialUrl?: string | undefined;
  hideTabStrip?: boolean;
  /** 会话运行状态用于空白标签轮询。 */
  agentRunning?: boolean;
  browserAutomationActive?: boolean;
  browserActivity?: string | undefined;
  externalState?: { snap: BrowserSessionSnapshot; nonce: number } | undefined;
  /** Agent 调用 browser_console / browser_network 时自动展开对应 DevTools 页签。 */
  devtoolsRequest?: { tab: DevToolsTab; nonce: number } | undefined;
  onSnapshotChange?: ((snap: BrowserSessionSnapshot) => void) | undefined;
  onAttachPage?: ((snap: BrowserSessionSnapshot) => void) | undefined;
}) {
  const [snap, setSnap] = useState<BrowserSessionSnapshot | null>(externalState?.snap ?? null);
  const [urlInput, setUrlInput] = useState(isDisplayableBrowserUrl(initialUrl) ? initialUrl : "");
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState("");
  const [deviceBarOpen, setDeviceBarOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("responsive");
  const [customViewport, setCustomViewport] = useState<{ width: number; height: number }>({ width: 1196, height: 873 });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [nativeReloadNonce, setNativeReloadNonce] = useState(0);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsTab, setDevtoolsTab] = useState<DevToolsTab>("console");
  const [consoleItems, setConsoleItems] = useState<BrowserConsoleItem[]>([]);
  const [networkItems, setNetworkItems] = useState<BrowserNetworkItem[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const urlEditingRef = useRef(false);
  const onSnapshotChangeRef = useRef(onSnapshotChange);
  onSnapshotChangeRef.current = onSnapshotChange;
  const frameDrawerRef = useRef<FrameDrawer | null>(null);
  const lastNavInitRef = useRef<string | undefined>(undefined);

  const hostOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const effectiveMode = resolveEffectiveRenderMode(snap, hostOrigin, browserAutomationActive);
  const effectiveModeRef = useRef(effectiveMode);
  effectiveModeRef.current = effectiveMode;

  const measureAutoViewport = useCallback((): { width: number; height: number } | undefined => {
    if (deviceBarOpen) return customViewport;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 120 || rect.height < 120) return undefined;
    return { width: Math.max(320, Math.round(rect.width)), height: Math.max(240, Math.round(rect.height)) };
  }, [customViewport, deviceBarOpen]);

  const applySnap = useCallback((next: BrowserSessionSnapshot) => {
    setSnap(next);
    if (!urlEditingRef.current && isDisplayableBrowserUrl(next.url)) {
      setUrlInput(next.url);
    }
    onSnapshotChangeRef.current?.(next);
  }, []);

  useBrowserSessionSync({
    sessionId,
    snap,
    deviceBarOpen,
    customViewport,
    effectiveMode,
    stageRef,
    urlEditingRef,
    effectiveModeRef,
    frameDrawerRef,
    onSnapshotChangeRef,
    measureAutoViewport,
    applySnap,
    setSnap,
    setUrlInput,
    setStreamConnected,
    setZoomPercent,
  });

  useEffect(() => {
    if (!devtoolsRequest) return;
    setDevtoolsOpen(true);
    setDevtoolsTab(devtoolsRequest.tab);
    void Promise.all([fetchBrowserConsole(sessionId), fetchBrowserNetwork(sessionId)]).then(([c, n]) => {
      setConsoleItems(c.items);
      setNetworkItems(n.items);
    }).catch(() => {});
  }, [devtoolsRequest, sessionId]);

  useEffect(() => {
    if (!externalState) return;
    setSnap(externalState.snap);
    if (!urlEditingRef.current && isDisplayableBrowserUrl(externalState.snap.url)) {
      setUrlInput(externalState.snap.url);
    }
  }, [externalState]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchBrowserState(sessionId);
      applySnap(res.state);
      if (devtoolsOpen) {
        const [logs, nets] = await Promise.all([
          fetchBrowserConsole(sessionId),
          fetchBrowserNetwork(sessionId),
        ]);
        setConsoleItems(logs.items);
        setNetworkItems(nets.items);
      }
    } catch {
      // 忽略定时刷新偶发失败
    }
  }, [applySnap, devtoolsOpen, sessionId]);

  useEffect(() => {
    void refresh();
    // 原生直连且无 DevTools 打开且 Agent 未运行时无需每 2.2s 轮询，减少无谓请求与状态抖动。
    if ((streamConnected || (effectiveMode === "native" && !agentRunning)) && !devtoolsOpen) return;
    const timer = setInterval(() => void refresh(), 2200);
    return () => clearInterval(timer);
  }, [agentRunning, devtoolsOpen, effectiveMode, refresh, streamConnected]);

  useEffect(() => {
    if (snap === null || !isDisplayableBrowserUrl(initialUrl) || !/^https?:\/\//iu.test(initialUrl) || initialUrl === lastNavInitRef.current) return;
    if (snap?.url === initialUrl) {
      lastNavInitRef.current = initialUrl;
      return;
    }
    lastNavInitRef.current = initialUrl;
    setUrlInput(initialUrl);
    setNavigating(true);
    setError("");
    const vp = measureAutoViewport();
    void navigateBrowser(sessionId, initialUrl, vp)
      .then((res) => applySnap(res.state))
      .catch((err) => setError(formatBrowserUiError(err)))
      .finally(() => setNavigating(false));
  }, [applySnap, initialUrl, measureAutoViewport, sessionId, snap?.url]);

  const runNav = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || navigating) return;
    setNavigating(true);
    setError("");
    urlEditingRef.current = false;
    try {
      const bridge = getDesktopBrowserBridge();
      if (bridge) void bridge.navigate(trimmed).catch(() => {});
      const res = await navigateBrowser(sessionId, trimmed, measureAutoViewport());
      applySnap(res.state);
    } catch (err) {
      setError(formatBrowserUiError(err));
    } finally {
      setNavigating(false);
    }
  };

  const handleNavigate = (e: FormEvent) => {
    e.preventDefault();
    void runNav(urlInput);
  };

  const handleNavControl = (action: "back" | "forward" | "reload") => {
    const bridge = getDesktopBrowserBridge();
    if (bridge) void bridge.nav(action).catch(() => {});
    if (action === "reload" && effectiveMode === "native") {
      setNativeReloadNonce((n) => n + 1);
    }
    setNavigating(true);
    setError("");
    void controlBrowserNav(sessionId, action)
      .then((r) => applySnap(r.state))
      .catch((err) => setError(formatBrowserUiError(err)))
      .finally(() => setNavigating(false));
  };

  const handleToggleDevtools = () => {
    const next = !devtoolsOpen;
    setDevtoolsOpen(next);
    if (next) {
      void Promise.all([fetchBrowserConsole(sessionId), fetchBrowserNetwork(sessionId)])
        .then(([c, n]) => {
          setConsoleItems(c.items);
          setNetworkItems(n.items);
        })
        .catch(() => {});
    }
  };

  const handleToggleTakeover = (paused: boolean, headed?: boolean) => {
    setError("");
    void toggleBrowserTakeover(sessionId, paused, headed)
      .then((r) => applySnap(r.state))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const tabs = snap?.tabs ?? [];

  return (
    <div className={styles.panel}>
      {!hideTabStrip && tabs.length > 0 && (
        <BrowserTabs
          tabs={tabs}
          isZh={isZh}
          onActivate={(tabId) => void manageBrowserTab(sessionId, { action: "activate", tabId }).then((r) => applySnap(r.state)).catch((err) => setError(err instanceof Error ? err.message : String(err)))}
          onClose={(tabId) => void manageBrowserTab(sessionId, { action: "close", tabId }).then((r) => applySnap(r.state)).catch((err) => setError(err instanceof Error ? err.message : String(err)))}
          onNew={() => void manageBrowserTab(sessionId, { action: "new" }).then((r) => applySnap(r.state)).catch((err) => setError(err instanceof Error ? err.message : String(err)))}
        />
      )}

      <BrowserToolbar
        isZh={isZh}
        snap={snap}
        navigating={navigating}
        urlInput={urlInput}
        urlInputRef={urlInputRef}
        deviceBarOpen={deviceBarOpen}
        onToggleDeviceBar={() => setDeviceBarOpen((prev) => !prev)}
        onResetFullFill={() => setDeviceBarOpen(false)}
        userControl={Boolean(snap?.takeoverPaused)}
        devtoolsOpen={devtoolsOpen}
        onToggleDevtools={handleToggleDevtools}
        onNavigate={handleNavigate}
        onUrlFocus={() => { urlEditingRef.current = true; }}
        onUrlBlur={() => { urlEditingRef.current = false; }}
        onUrlChange={setUrlInput}
        onNavControl={handleNavControl}
        onToggleTakeover={handleToggleTakeover}
        onAttachPage={onAttachPage}
      />

      {deviceBarOpen && (
        <BrowserDeviceBar
          isZh={isZh}
          deviceId={deviceId}
          width={customViewport.width}
          height={customViewport.height}
          zoomPercent={zoomPercent}
          onSelectDevice={(presetItem) => {
            setDeviceId(presetItem.id);
            setCustomViewport({ width: presetItem.width, height: presetItem.height });
          }}
          onChangeSize={(width, height) => {
            const matched = BROWSER_DEVICE_PRESETS.find((item) => item.id !== "responsive" && item.width === width && item.height === height);
            setDeviceId(matched?.id ?? "responsive");
            setCustomViewport({ width, height });
          }}
          onRotate={() => {
            setDeviceId("responsive");
            setCustomViewport((prev) => ({ width: prev.height, height: prev.width }));
          }}
          onClose={() => setDeviceBarOpen(false)}
        />
      )}

      {error && <div className={styles.errorBanner} role="alert">{error}</div>}
      {snap?.takeoverPaused && (
        <div className={styles.takeoverBanner} role="status">
          <span>
            {isZh
              ? "你已接管浏览器 · Agent 已收到通知并暂停浏览器操作，完成后点「交还 Agent」恢复协同。"
              : "Takeover active — Agent has been notified and paused browser tools until you hand control back."}
          </span>
          <button
            type="button"
            className={styles.takeoverResumeBtn}
            onClick={() => handleToggleTakeover(false)}
          >
            {isZh ? "交还 Agent" : "Resume Agent"}
          </button>
        </div>
      )}

      <BrowserViewport
        sessionId={sessionId}
        isZh={isZh}
        snap={snap}
        customViewport={deviceBarOpen ? customViewport : null}
        effectiveMode={effectiveMode}
        browserAutomationActive={browserAutomationActive}
        browserActivity={browserActivity}
        userControl={Boolean(snap?.takeoverPaused)}
        nativeReloadNonce={nativeReloadNonce}
        stageRef={stageRef}
        frameDrawerRef={frameDrawerRef}
        onOpenUrl={(url) => void runNav(url)}
        onRequestTakeover={() => handleToggleTakeover(true)}
      />

      {devtoolsOpen && (
        <BrowserDevToolsDrawer
          isZh={isZh}
          activeTab={devtoolsTab}
          onChangeTab={setDevtoolsTab}
          consoleItems={consoleItems}
          networkItems={networkItems}
          onClear={() => void clearBrowserLogs(sessionId).then(() => { setConsoleItems([]); setNetworkItems([]); }).catch(() => {})}
          onClose={() => setDevtoolsOpen(false)}
        />
      )}
    </div>
  );
}
