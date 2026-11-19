// 全高全宽内置浏览器视图：支持多标签协同、动态视口适配、鼠标点击/滚轮/键盘直输及 DevTools 排错抽屉。
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconExternalLink,
  IconHandStop,
  IconLayoutColumns,
  IconMessagePlus,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconTerminal2,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { BrowserDevToolsDrawer, type DevToolsTab } from "./BrowserDevToolsDrawer";
import {
  clearBrowserLogs,
  controlBrowserNav,
  fetchBrowserConsole,
  fetchBrowserNetwork,
  fetchBrowserState,
  manageBrowserTab,
  navigateBrowser,
  performBrowserAction,
  readClientBrowserAppearance,
  setBrowserViewport,
  subscribeBrowserStream,
  toggleBrowserTakeover,
  type BrowserConsoleItem,
  type BrowserNetworkItem,
  type BrowserSessionSnapshot,
} from "./browser-client";
import styles from "./RightBrowserPane.module.css";

type ViewportPreset = "auto" | "desktop" | "mobile";

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
  const wheelBufferRef = useRef({ dx: 0, dy: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const composingRef = useRef(false);

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

  // 用户在视口内点击属于直接交互，不触发导航「加载中...」提示；HiDPI 下严格按 CSS viewport 映射坐标。
  const handleStageClick = async (event: MouseEvent<HTMLImageElement>) => {
    stageRef.current?.focus();
    if (!snap?.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const vw = snap.viewport?.width || event.currentTarget.naturalWidth || 1024;
    const vh = snap.viewport?.height || event.currentTarget.naturalHeight || 768;
    const x = Math.round(((event.clientX - rect.left) / rect.width) * vw);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * vh);
    setError("");
    try {
      const res = await performBrowserAction(sessionId, {
        kind: "click",
        x,
        y,
        button: event.button === 2 ? "right" : "left",
        clickCount: event.detail >= 2 ? 2 : 1,
        fast: streamConnected,
      });
      if (!streamConnected || res.state.url !== snap.url) applySnap(res.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStageWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!snap?.active) return;
    wheelBufferRef.current.dx += event.deltaX;
    wheelBufferRef.current.dy += event.deltaY;
    if (wheelBufferRef.current.timer) return;
    wheelBufferRef.current.timer = setTimeout(() => {
      const { dx, dy } = wheelBufferRef.current;
      wheelBufferRef.current = { dx: 0, dy: 0, timer: 0 };
      void performBrowserAction(sessionId, {
        kind: "scroll",
        deltaX: Math.round(dx),
        deltaY: Math.round(dy),
        fast: streamConnected,
      }).then((res) => {
        if (!streamConnected) applySnap(res.state);
      }).catch(() => {});
    }, streamConnected ? 32 : 90);
  };

  const handleStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!snap?.active || composingRef.current) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const navKeys = new Set([
      "Enter", "Backspace", "Tab", "Escape", "Delete",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown",
    ]);
    if (navKeys.has(event.key)) {
      event.preventDefault();
      void performBrowserAction(sessionId, { kind: "key", key: event.key, fast: streamConnected })
        .then((res) => { if (!streamConnected || res.state.url !== snap.url) applySnap(res.state); })
        .catch(() => {});
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      void performBrowserAction(sessionId, { kind: "type", text: event.key, fast: streamConnected })
        .then((res) => { if (!streamConnected) applySnap(res.state); })
        .catch(() => {});
    }
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>) => {
    composingRef.current = false;
    if (snap?.active && event.data) {
      void performBrowserAction(sessionId, { kind: "type", text: event.data, fast: streamConnected })
        .then((res) => { if (!streamConnected) applySnap(res.state); })
        .catch(() => {});
    }
  };

  const tabs = snap?.tabs ?? [];
  const quickPorts = ["http://127.0.0.1:5173/", "http://127.0.0.1:3000/"];

  return (
    <div className={styles.panel}>
      {!hideTabStrip && tabs.length > 0 && (
        <div className={styles.tabStrip} role="tablist" aria-label={isZh ? "浏览器标签页" : "Browser tabs"}>
          {tabs.map((tab) => (
            <div key={tab.tabId} className={`${styles.browserTab} ${tab.active ? styles.browserTabActive : ""}`}>
              <button
                type="button"
                role="tab"
                aria-selected={tab.active}
                className={styles.browserTabBtn}
                title={tab.url}
                onClick={() => void manageBrowserTab(sessionId, { action: "activate", tabId: tab.tabId }).then((r) => applySnap(r.state))}
              >
                <IconWorld size={12} aria-hidden="true" />
                <span>{tab.title || tab.url || (isZh ? "新标签页" : "New Tab")}</span>
              </button>
              <button
                type="button"
                className={styles.tabCloseBtn}
                aria-label={isZh ? "关闭标签" : "Close tab"}
                onClick={() => void manageBrowserTab(sessionId, { action: "close", tabId: tab.tabId }).then((r) => applySnap(r.state))}
              >
                <IconX size={11} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.newTabBtn}
            title={isZh ? "新建浏览器标签页" : "New browser tab"}
            onClick={() => void manageBrowserTab(sessionId, { action: "new" }).then((r) => applySnap(r.state))}
          >
            <IconPlus size={13} />
          </button>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.navButtons}>
          <button
            type="button"
            className={styles.navBtn}
            disabled={navigating || !snap?.canGoBack}
            title={isZh ? "后退" : "Back"}
            aria-label={isZh ? "后退" : "Back"}
            onClick={() => {
              setNavigating(true);
              void controlBrowserNav(sessionId, "back").then((r) => applySnap(r.state)).finally(() => setNavigating(false));
            }}
          >
            <IconArrowLeft size={14} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            disabled={navigating || !snap?.canGoForward}
            title={isZh ? "前进" : "Forward"}
            aria-label={isZh ? "前进" : "Forward"}
            onClick={() => {
              setNavigating(true);
              void controlBrowserNav(sessionId, "forward").then((r) => applySnap(r.state)).finally(() => setNavigating(false));
            }}
          >
            <IconArrowRight size={14} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            disabled={navigating || !snap?.active}
            title={isZh ? "刷新" : "Reload"}
            aria-label={isZh ? "刷新" : "Reload"}
            onClick={() => {
              setNavigating(true);
              void controlBrowserNav(sessionId, "reload").then((r) => applySnap(r.state)).finally(() => setNavigating(false));
            }}
          >
            <IconRefresh size={14} />
          </button>
        </div>

        <form className={styles.urlForm} onSubmit={handleNavigate}>
          <IconShieldCheck size={13} className={styles.urlIcon} aria-hidden="true" />
          <input
            ref={urlInputRef}
            className={styles.urlInput}
            value={urlInput}
            placeholder="http://127.0.0.1:5173/"
            aria-label={isZh ? "网址输入框" : "Browser URL"}
            onFocus={() => setUrlEditing(true)}
            onBlur={() => setUrlEditing(false)}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          {navigating && <span className={styles.loadingHint}>{isZh ? "加载中…" : "Loading"}</span>}
        </form>

        <div className={styles.toolGroup}>
          <button
            type="button"
            className={`${styles.navBtn} ${preset === "auto" ? styles.navBtnActive : ""}`}
            title={isZh ? "视口自适应面板宽高" : "Responsive viewport"}
            onClick={() => setPreset("auto")}
          >
            <IconLayoutColumns size={14} />
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${preset === "desktop" ? styles.navBtnActive : ""}`}
            title={isZh ? "桌面视口 (1280×800)" : "Desktop viewport"}
            onClick={() => setPreset("desktop")}
          >
            <IconDeviceDesktop size={14} />
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${preset === "mobile" ? styles.navBtnActive : ""}`}
            title={isZh ? "手机视口 (390×844)" : "Mobile viewport"}
            onClick={() => setPreset("mobile")}
          >
            <IconDeviceMobile size={14} />
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${devtoolsOpen ? styles.navBtnActive : ""}`}
            title={isZh ? "控制台与网络检查" : "Console & Network"}
            onClick={() => {
              const next = !devtoolsOpen;
              setDevtoolsOpen(next);
              if (next) {
                void Promise.all([fetchBrowserConsole(sessionId), fetchBrowserNetwork(sessionId)]).then(([c, n]) => {
                  setConsoleItems(c.items);
                  setNetworkItems(n.items);
                });
              }
            }}
          >
            <IconTerminal2 size={14} />
            {(snap?.errorCount ?? 0) > 0 && <span className={styles.badgeDot} />}
          </button>
          <button
            type="button"
            className={`${styles.pillBtn} ${snap?.takeoverPaused ? styles.pillBtnActive : ""}`}
            disabled={!snap?.active}
            title={isZh ? "开启后暂停 Agent 自动操作，改为人工接管" : "Toggle human takeover"}
            onClick={() => void toggleBrowserTakeover(sessionId, !snap?.takeoverPaused).then((r) => applySnap(r.state))}
          >
            {snap?.takeoverPaused ? <IconPlayerPlay size={13} /> : <IconHandStop size={13} />}
            <span>{snap?.takeoverPaused ? (isZh ? "恢复" : "Resume") : (isZh ? "接管" : "Takeover")}</span>
          </button>
          <button
            type="button"
            className={styles.navBtn}
            title={isZh ? "弹出桌面有头 Edge 窗口人工操作" : "Open visible desktop browser"}
            onClick={() => void toggleBrowserTakeover(sessionId, true, true).then((r) => applySnap(r.state))}
          >
            <IconExternalLink size={14} />
          </button>
          {onAttachPage && snap?.active && (
            <button
              type="button"
              className={styles.navBtn}
              title={isZh ? "附带当前页面到对话" : "Attach page to chat"}
              onClick={() => onAttachPage(snap)}
            >
              <IconMessagePlus size={14} />
            </button>
          )}
        </div>
      </div>

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
            onClick={() => void toggleBrowserTakeover(sessionId, false).then((r) => applySnap(r.state))}
          >
            {isZh ? "交还 Agent" : "Resume Agent"}
          </button>
        </div>
      )}

      <div
        ref={stageRef}
        tabIndex={0}
        className={styles.viewportStage}
        aria-label={isZh ? "内置浏览器实时操作画面（可直接点击、滚轮与键入）" : "Interactive built-in browser viewport"}
        onWheel={handleStageWheel}
        onKeyDown={handleStageKeyDown}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={handleCompositionEnd}
        onContextMenu={(e) => {
          if (snap?.active) e.preventDefault();
        }}
      >
        {snap?.screenshotBase64 && snap.url !== "about:blank" ? (
          <img
            src={`data:${snap.screenshotMime || "image/png"};base64,${snap.screenshotBase64}`}
            alt={snap.title || snap.url || "Browser Preview"}
            className={styles.viewportImg}
            data-preset={preset}
            draggable={false}
            onClick={(e) => void handleStageClick(e)}
          />
        ) : (
          <div className={styles.emptyStage}>
            <IconWorld size={34} stroke={1.4} aria-hidden="true" />
            <h4>{isZh ? "内置浏览器已就绪" : "Built-in Browser Ready"}</h4>
            <p>
              {isZh
                ? "直接输入网址回车打开，或由小鱼 Agent 自动访问本地开发服务并在界面实时点击、滚动与排错。"
                : "Enter a URL above or let the agent browse and inspect localhost or web apps live."}
            </p>
            <div className={styles.quickLinks}>
              {quickPorts.map((u) => (
                <button key={u} type="button" className={styles.quickBtn} onClick={() => void runNav(u)}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
