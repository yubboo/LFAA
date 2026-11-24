// 内置浏览器宿主同步 Hook：管理 2x 无损 PNG 帧流直通 Canvas、无回环抖动的视口尺寸同步与明暗主题同步。
import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  readClientBrowserAppearance,
  setBrowserViewport,
  subscribeBrowserStream,
  type BrowserSessionSnapshot,
} from "../api/browser-client";
import type { FrameDrawer } from "./BrowserCanvasViewport";
import type { EffectiveRenderMode } from "./browser-render-mode";

function isEmbeddedBrowserGuest(): boolean {
  return typeof window !== "undefined"
    && (window as unknown as { __LFAA_EMBEDDED_BROWSER__?: boolean }).__LFAA_EMBEDDED_BROWSER__ === true;
}

function isStageVisibleForViewport(el: HTMLElement): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  if (el.closest("[data-covered='true']")) return false;
  return true;
}

export function useBrowserSessionSync({
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
}: {
  sessionId: string;
  snap: BrowserSessionSnapshot | null;
  deviceBarOpen: boolean;
  customViewport: { width: number; height: number };
  effectiveMode: EffectiveRenderMode;
  stageRef: RefObject<HTMLDivElement | null>;
  urlEditingRef: RefObject<boolean>;
  effectiveModeRef: RefObject<EffectiveRenderMode>;
  frameDrawerRef: RefObject<FrameDrawer | null>;
  onSnapshotChangeRef: RefObject<((snap: BrowserSessionSnapshot) => void) | undefined>;
  measureAutoViewport: () => { width: number; height: number } | undefined;
  applySnap: (next: BrowserSessionSnapshot) => void;
  setSnap: Dispatch<SetStateAction<BrowserSessionSnapshot | null>>;
  setUrlInput: Dispatch<SetStateAction<string>>;
  setStreamConnected: Dispatch<SetStateAction<boolean>>;
  setZoomPercent: Dispatch<SetStateAction<number>>;
}) {
  const lastViewportRef = useRef<{ width: number; height: number } | null>(null);
  const viewportReqSeqRef = useRef(0);
  const snapVpRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  if (snap?.viewport) {
    snapVpRef.current = snap.viewport;
  }
  const snapActive = Boolean(snap?.active);
  const snapColorScheme = snap?.colorScheme;

  // 仅在协同视图（effectiveMode === "cdp"）订阅实时 CDP 帧流；原生 iframe 模式下完全停止后台截帧编码，释放 CPU。
  const streamEnabled = snapActive && effectiveMode === "cdp" && !isEmbeddedBrowserGuest();
  useEffect(() => {
    if (!streamEnabled) {
      setStreamConnected(false);
      return;
    }
    return subscribeBrowserStream(
      sessionId,
      (frame) => {
        if (effectiveModeRef.current === "cdp") {
          frameDrawerRef.current?.(frame.data, frame.mime, frame.updatedAt);
        }
        if (!urlEditingRef.current && frame.url && frame.url !== "about:blank" && !/^(?:chrome|edge)-error:/iu.test(frame.url)) {
          setUrlInput((prev) => (prev === frame.url ? prev : frame.url));
        }
        setSnap((prev) => {
          if (!prev) return prev;
          const metaChanged =
            prev.activeTabId !== frame.tabId
            || prev.url !== frame.url
            || prev.title !== frame.title
            || prev.canGoBack !== frame.canGoBack
            || prev.canGoForward !== frame.canGoForward
            || prev.errorCount !== frame.errorCount
            || prev.consoleCount !== frame.consoleCount
            || prev.networkCount !== frame.networkCount
            || prev.embeddable !== frame.embeddable
            || prev.lastActor !== frame.lastActor
            || prev.viewport.width !== frame.viewport.width
            || prev.viewport.height !== frame.viewport.height
            || prev.deviceScaleFactor !== frame.deviceScaleFactor
            || prev.colorScheme !== frame.colorScheme;
          if (!metaChanged) return prev;
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
            ...(frame.embeddable !== undefined ? { embeddable: frame.embeddable } : {}),
            ...(frame.lastActor ? { lastActor: frame.lastActor } : {}),
            screenshotBase64: frame.data,
            screenshotMime: frame.mime,
            updatedAt: frame.updatedAt,
          };
          // 避免在 setSnap 状态更新函数内部同步触发父组件 setState，延后到微任务通知顶栏标签同步。
          if (navChanged) queueMicrotask(() => onSnapshotChangeRef.current?.(next));
          return next;
        });
      },
      setStreamConnected,
    );
  }, [effectiveModeRef, frameDrawerRef, onSnapshotChangeRef, sessionId, setSnap, setStreamConnected, setUrlInput, streamEnabled, urlEditingRef]);

  // 主题变化时同步更新内嵌浏览器 prefers-color-scheme，仅依赖原始值避免帧刷新重建 Observer。
  useEffect(() => {
    if (!snapActive || typeof MutationObserver === "undefined") return;
    const syncTheme = () => {
      const { colorScheme } = readClientBrowserAppearance();
      if (snapColorScheme === colorScheme) return;
      const vp = measureAutoViewport() ?? {
        width: snapVpRef.current.width || 1024,
        height: snapVpRef.current.height || 768,
      };
      void setBrowserViewport(sessionId, vp.width, vp.height).then((r) => applySnap(r.state)).catch(() => {});
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-resolved-theme"] });
    return () => observer.disconnect();
  }, [applySnap, measureAutoViewport, sessionId, snapActive, snapColorScheme]);

  // 视口尺寸同步：关闭设备栏时严格铺满右侧面板（零上下黑边）；打开设备栏时下发自定义设备尺寸并计算缩放百分比。
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !snapActive || isEmbeddedBrowserGuest()) return;
    lastViewportRef.current = null;

    const syncZoom = (stageW: number, stageH: number) => {
      if (!deviceBarOpen) {
        setZoomPercent(100);
        return;
      }
      const availW = Math.max(120, stageW - 24);
      const availH = Math.max(120, stageH - 24);
      const scale = Math.min(1, availW / Math.max(1, customViewport.width), availH / Math.max(1, customViewport.height));
      setZoomPercent(Math.max(10, Math.round(scale * 100)));
    };

    const pushViewport = (width: number, height: number) => {
      if (!isStageVisibleForViewport(el)) return;
      const target = deviceBarOpen
        ? {
            width: Math.max(320, Math.min(2560, Math.round(customViewport.width))),
            height: Math.max(240, Math.min(2400, Math.round(customViewport.height))),
          }
        : {
            width: Math.max(320, Math.min(2560, Math.round(width))),
            height: Math.max(240, Math.min(2400, Math.round(height))),
          };
      const prev = lastViewportRef.current;
      const curSnap = snapVpRef.current;
      if (
        (prev && Math.abs(prev.width - target.width) < 4 && Math.abs(prev.height - target.height) < 4)
        && (curSnap.width > 0 && Math.abs(curSnap.width - target.width) < 4 && Math.abs(curSnap.height - target.height) < 4)
      ) {
        return;
      }
      lastViewportRef.current = target;
      const seq = ++viewportReqSeqRef.current;
      void setBrowserViewport(sessionId, target.width, target.height)
        .then((res) => {
          if (seq !== viewportReqSeqRef.current) return;
          applySnap(res.state);
        })
        .catch(() => {});
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleMeasure = (delayMs: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!isStageVisibleForViewport(el)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width >= 120 && rect.height >= 120) {
          syncZoom(rect.width, rect.height);
          pushViewport(rect.width, rect.height);
        }
      }, delayMs);
    };

    scheduleMeasure(deviceBarOpen ? 60 : 220);

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 120 || rect.height < 120) return;
      syncZoom(rect.width, rect.height);
      if (!deviceBarOpen) scheduleMeasure(160);
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleMeasure(120);
    };
    observer.observe(el);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [applySnap, customViewport.height, customViewport.width, deviceBarOpen, effectiveMode, sessionId, setZoomPercent, snapActive, stageRef]);
}
