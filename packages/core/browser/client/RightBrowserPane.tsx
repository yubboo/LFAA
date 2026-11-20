// 全高全宽内置浏览器视图：串联标签、工具栏、实时视口与 DevTools 抽屉，并同步 CDP 画面与视口尺寸。
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserDevToolsDrawer, type DevToolsTab } from "./BrowserDevToolsDrawer";
import { BrowserTabs } from "./BrowserTabs";
import { BrowserToolbar, type ViewportPreset } from "./BrowserToolbar";
import { BrowserViewport } from "./BrowserViewport";
import {
  clearBrowserLogs,
  controlBrowserNav,
  fetchBrowserConsole,
  fetchBrowserNetwork,
  fetchBrowserState,
  manageBrowserTab,
  navigateBrowser,
  readClientBrowserAppearance,
  setBrowserViewport,
  subscribeBrowserStream,
  toggleBrowserTakeover,
  type BrowserConsoleItem,
  type BrowserNetworkItem,
  type BrowserSessionSnapshot,
} from "./browser-client";
import styles from "./RightBrowserPane.module.css";

export function RightBrowserPane({
  sessionId,
  isZh,
  initialUrl,
  hideTabStrip = false,
  externalState,
  onSnapshotChange,
  onAttachPage,
}: {
  sessionId: string;
  isZh: boolean;
  initialUrl?: string | undefined;
  hideTabStrip?: boolean;
  externalState?: { snap: BrowserSessionSnapshot; nonce: number } | undefined;
  onSnapshotChange?: ((snap: BrowserSessionSnapshot) => void) | undefined;
  onAttachPage?: ((snap: BrowserSessionSnapshot) => void) | undefined;
}) {
  const [snap, setSnap] = useState<BrowserSessionSnapshot | null>(externalState?.snap ?? null);
  const [urlInput, setUrlInput] = useState(initialUrl ?? "");
  const [urlEditing, setUrlEditing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<ViewportPreset>("auto");
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsTab, setDevtoolsTab] = useState<DevToolsTab>("console");
  const [consoleItems, setConsoleItems] = useState<BrowserConsoleItem[]>([]);
  const [networkItems, setNetworkItems] = useState<BrowserNetworkItem[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const lastViewportRef = useRef<{ width: number; height: number } | null>(null);
  const lastNavInitRef = useRef<string | undefined>(undefined);

  const measureAutoViewport = useCallback((): { width: number; height: number } | undefined => {
    if (preset === "desktop") return { width: 1280, height: 800 };
    if (preset === "mobile") return { width: 390, height: 844 };
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 120 || rect.height < 120) return undefined;
    return { width: Math.max(360, Math.round(rect.width)), height: Math.max(280, Math.round(rect.height)) };
  }, [preset]);

  const applySnap = useCallback((next: BrowserSessionSnapshot) => {
    setSnap(next);
    if (!urlEditing) {
      setUrlInput(next.url && next.url !== "about:blank" ? next.url : "");
    }
    onSnapshotChange?.(next);
  }, [onSnapshotChange, urlEditing]);

  useEffect(() => {
    if (!externalState) return;
    const next = externalState.snap;
    setSnap(next);
    const isBlank = !next.url || next.url === "about:blank";
    setUrlEditing(false);
    setUrlInput(isBlank ? "" : next.url);
    if (isBlank) {
      urlInputRef.current?.focus();
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
    if (streamConnected && !devtoolsOpen) return;
    const timer = setInterval(() => void refresh(), 2200);
    return () => clearInterval(timer);
  }, [devtoolsOpen, refresh, streamConnected]);

  // 接入实时 CDP Screencast SSE 帧流，彻底替代 2.2s 轮询与阻塞截屏。
  useEffect(() => {
    if (!snap?.active) {
      setStreamConnected(false);
      return;
    }
    return subscribeBrowserStream(
      sessionId,
      (frame) => {
        setSnap((prev) => {
          if (!prev) return prev;
          const navChanged = prev.url !== frame.url || prev.title !== frame.title;
          const next: BrowserSessionSnapshot = {
            ...prev,
            activeTabId: frame.tabId,
            url: frame.url,
            title: frame.title,
            canGoBack: frame.canGoBack,
            canGoForward: frame.canGoForward,
            errorCount: frame.errorCount,
            consoleCount: frame.consoleCount,
            networkCount: frame.networkCount,
            viewport: frame.viewport,
            deviceScaleFactor: frame.deviceScaleFactor,
            colorScheme: frame.colorScheme,
            screenshotBase64: frame.data,
            screenshotMime: frame.mime,
            updatedAt: frame.updatedAt,
          };
          if (navChanged) onSnapshotChange?.(next);
          return next;
        });
        if (!urlEditing && frame.url && frame.url !== "about:blank") {
          setUrlInput(frame.url);
        }
      },
      setStreamConnected,
    );
  }, [onSnapshotChange, sessionId, snap?.active, urlEditing]);

  // 主题变化时同步更新内嵌浏览器 prefers-color-scheme，避免暗黑模式中刺眼发白。
  useEffect(() => {
    if (!snap?.active || typeof MutationObserver === "undefined") return;
    const syncTheme = () => {
      const { colorScheme } = readClientBrowserAppearance();
      if (snap.colorScheme === colorScheme) return;
      const vp = measureAutoViewport() ?? snap.viewport;
      void setBrowserViewport(sessionId, vp.width, vp.height).then((r) => applySnap(r.state)).catch(() => {});
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-resolved-theme"] });
    return () => observer.disconnect();
  }, [applySnap, measureAutoViewport, sessionId, snap?.active, snap?.colorScheme, snap?.viewport]);

  useEffect(() => {
    if (!initialUrl || initialUrl === lastNavInitRef.current) return;
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
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setNavigating(false));
  }, [applySnap, initialUrl, measureAutoViewport, sessionId, snap?.url]);

  // 动态同步 Playwright 视口尺寸以适配右侧面板实际宽高（首次展开即立即同步，消除上下黑边）。
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !snap?.active) return;

    const pushViewport = (width: number, height: number) => {
      const target = preset === "desktop"
        ? { width: 1280, height: 800 }
        : preset === "mobile"
          ? { width: 390, height: 844 }
          : { width: Math.max(360, Math.round(width)), height: Math.max(280, Math.round(height)) };
      const prev = lastViewportRef.current;
      const curSnapVp = snap.viewport;
      if (
        (prev && Math.abs(prev.width - target.width) < 8 && Math.abs(prev.height - target.height) < 8)
        || (curSnapVp && Math.abs(curSnapVp.width - target.width) < 8 && Math.abs(curSnapVp.height - target.height) < 8)
      ) {
        return;
      }
      lastViewportRef.current = target;
      void setBrowserViewport(sessionId, target.width, target.height)
        .then((res) => applySnap(res.state))
        .catch(() => {});
    };

    if (preset !== "auto") {
      pushViewport(0, 0);
      return;
    }

    const initialRect = el.getBoundingClientRect();
    if (initialRect.width >= 120 && initialRect.height >= 120) {
      pushViewport(initialRect.width, initialRect.height);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 120 || rect.height < 120) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => pushViewport(rect.width, rect.height), 180);
    });
    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [applySnap, preset, sessionId, snap?.active, snap?.viewport]);

  const runNav = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || navigating) return;
    setNavigating(true);
    setError("");
    setUrlEditing(false);
    try {
      const res = await navigateBrowser(sessionId, trimmed, measureAutoViewport());
      applySnap(res.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNavigating(false);
    }
  };

  const handleNavigate = (e: FormEvent) => {
    e.preventDefault();
    void runNav(urlInput);
  };

  const handleNavControl = (action: "back" | "forward" | "reload") => {
    setNavigating(true);
    void controlBrowserNav(sessionId, action).then((r) => applySnap(r.state)).finally(() => setNavigating(false));
  };

  const handleToggleDevtools = () => {
    const next = !devtoolsOpen;
    setDevtoolsOpen(next);
    if (next) {
      void Promise.all([fetchBrowserConsole(sessionId), fetchBrowserNetwork(sessionId)]).then(([c, n]) => {
        setConsoleItems(c.items);
        setNetworkItems(n.items);
      });
    }
  };

  const handleToggleTakeover = (paused: boolean, headed?: boolean) => {
    void toggleBrowserTakeover(sessionId, paused, headed).then((r) => applySnap(r.state));
  };

  const tabs = snap?.tabs ?? [];

  return (
    <div className={styles.panel}>
      {!hideTabStrip && tabs.length > 0 && (
        <BrowserTabs
          tabs={tabs}
          isZh={isZh}
          onActivate={(tabId) => void manageBrowserTab(sessionId, { action: "activate", tabId }).then((r) => applySnap(r.state))}
          onClose={(tabId) => void manageBrowserTab(sessionId, { action: "close", tabId }).then((r) => applySnap(r.state))}
          onNew={() => void manageBrowserTab(sessionId, { action: "new" }).then((r) => applySnap(r.state))}
        />
      )}

      <BrowserToolbar
        isZh={isZh}
        snap={snap}
        navigating={navigating}
        urlInput={urlInput}
        urlInputRef={urlInputRef}
        preset={preset}
        onSelectPreset={setPreset}
        devtoolsOpen={devtoolsOpen}
        onToggleDevtools={handleToggleDevtools}
        onNavigate={handleNavigate}
        onUrlFocus={() => setUrlEditing(true)}
        onUrlBlur={() => setUrlEditing(false)}
        onUrlChange={setUrlInput}
        onNavControl={handleNavControl}
        onToggleTakeover={handleToggleTakeover}
        onAttachPage={onAttachPage}
      />

      {error && <div className={styles.errorBanner} role="alert">{error}</div>}
      {snap?.takeoverPaused && (
        <div className={styles.takeoverBanner} role="status">
          <span>
            {isZh
              ? "人工接管模式：当前由你直接操控，小鱼 Agent 浏览器工具已暂停，完成后点「交还」恢复协同。"
              : "Takeover active: human control only, agent browser tools paused until resumed."}
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
        preset={preset}
        streamConnected={streamConnected}
        stageRef={stageRef}
        applySnap={applySnap}
        onError={setError}
        onOpenUrl={(url) => void runNav(url)}
      />

      {devtoolsOpen && (
        <BrowserDevToolsDrawer
          isZh={isZh}
          activeTab={devtoolsTab}
          onChangeTab={setDevtoolsTab}
          consoleItems={consoleItems}
          networkItems={networkItems}
          onClear={() => void clearBrowserLogs(sessionId).then(() => { setConsoleItems([]); setNetworkItems([]); })}
          onClose={() => setDevtoolsOpen(false)}
        />
      )}
    </div>
  );
}