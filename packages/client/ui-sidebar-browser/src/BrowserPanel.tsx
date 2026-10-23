/**
 * 功能：只在 AI Work 当前新标签页内容区域显示网页并转发页面交互。
 * 作用：浏览器地址栏、工作区标签与导航动作统一由 ApplicationWorkspace 提供；Browser Owner 保存真实页面状态。
 * 关联文件：packages/client/connection/src/api.ts、packages/browser-use/browser-use、packages/client/ui-workspace。
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { actOnBrowserDock, getErrorMessage, loadBrowserDockSession, loadBrowserProviders, navigateBrowserDock, prewarmBrowserDock, resizeBrowserDockViewport, waitForBrowserDockRevision, type BrowserProviderId, type BrowserProviderSummary, type BrowserSessionSnapshot, type UserSettings } from "lfaa-client-connection/src/api.js";
import { NativeBrowserPanel } from "./NativeBrowserPanel.js";
import { resolveBrowserAddress } from "./browser-address.js";
import { browserScreenshotWaitMs } from "./browser-frame-interval.js";
import "./browser-panel.css";

const BROWSER_SCROLL_INPUT_DELAY_MS = 60;
const BROWSER_VISUAL_REFRESH_DELAY_MS = 40;

type BrowserNavigationRequest = { id: string; url: string };
type BrowserDockActionRequest = { id: string; action: "back" | "forward" | "reload" };
type BrowserPanelProps = {
  sessionId: string | null;
  settings: UserSettings;
  hidden?: boolean;
  navigationRequest?: BrowserNavigationRequest | null;
  onNavigationRequestHandled?: (requestId: string) => void;
  actionRequest?: BrowserDockActionRequest | null;
  onActionRequestHandled?: (requestId: string) => void;
  onOpenTabsChange?: (tabs: Array<{ id: string; title: string; url: string; active: boolean }>) => void;
};
type BrowserViewport = { width: number; height: number };
type BrowserPagePoint = { x: number; y: number };
type BrowserGesture = { pointerId: number; pointerType: string; start: BrowserPagePoint; startClientX: number; startClientY: number; points: Array<BrowserPagePoint & { delayMs: number }>; lastPage: BrowserPagePoint; lastClientX: number; lastClientY: number; lastAt: number; mode: "pending" | "drag" | "scroll" };

function pagePoint(image: HTMLImageElement, width: number, height: number, clientX: number, clientY: number, clampToPage = false): BrowserPagePoint | null {
  const bounds = image.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;
  const scale = Math.min(bounds.width / width, bounds.height / height);
  const renderedWidth = width * scale, renderedHeight = height * scale;
  const localX = clientX - bounds.left - (bounds.width - renderedWidth) / 2;
  const localY = clientY - bounds.top - (bounds.height - renderedHeight) / 2;
  if (!clampToPage && (localX < 0 || localX >= renderedWidth || localY < 0 || localY >= renderedHeight)) return null;
  return {
    x: Math.max(0, Math.min(width - 1, Math.floor(localX / scale))),
    y: Math.max(0, Math.min(height - 1, Math.floor(localY / scale)))
  };
}

function waitForScreenshotFrameSlot(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    signal?.throwIfAborted();
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("浏览器画面更新已取消。"));
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

function BrowserUsePanel({ sessionId, settings, hidden = false, navigationRequest, onNavigationRequestHandled, actionRequest, onActionRequestHandled, onOpenTabsChange }: BrowserPanelProps) {
  const [providers, setProviders] = useState<BrowserProviderSummary[]>([]);
  const [providerId, setProviderId] = useState<BrowserProviderId | "">("");
  const [snapshot, setSnapshot] = useState<BrowserSessionSnapshot | null>(null);
  const snapshotRef = useRef<BrowserSessionSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState(true);
  const actionInFlight = useRef(false);
  const handledNavigationRequestRef = useRef("");
  const handledActionRequestRef = useRef("");
  const actionEpochRef = useRef(0);
  const actionTailRef = useRef<Promise<void>>(Promise.resolve());
  const queuedActionCountRef = useRef(0);
  const snapshotRequestInFlight = useRef(false);
  const snapshotRequestCountRef = useRef(0);
  const snapshotScopeRef = useRef("");
  const snapshotRefreshPromiseRef = useRef<{ scope: string; promise: Promise<BrowserSessionSnapshot | null> } | null>(null);
  const lastScreenshotRequestAtRef = useRef(0);
  const viewportSyncInFlight = useRef(false);
  const lastViewportAttempt = useRef<string | null>(null);
  const viewportSizeRef = useRef<BrowserViewport | null>(null);
  const [viewportSize, setViewportSize] = useState<BrowserViewport | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const viewportWrapRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const keyboardCaptureRef = useRef<HTMLTextAreaElement | null>(null);
  const pointerGestureRef = useRef<BrowserGesture | null>(null);
  const pendingTextRef = useRef("");
  const composingRef = useRef(false);
  const textFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelFlushRef = useRef<(() => void) | null>(null);
  const visualRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsVisualRefreshRef = useRef(false);
  const browserProviderReady = Boolean(providerId && providers.some(provider => provider.id === providerId && provider.available));

  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  useEffect(() => {
    onOpenTabsChange?.(snapshot?.tabs ?? []);
  }, [onOpenTabsChange, snapshot?.tabs]);

  useEffect(() => {
    const content = contentRef.current;
    if (hidden || !browserProviderReady || !content || typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: BrowserViewport | null = null;
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect;
      if (!bounds || bounds.width < 1 || bounds.height < 1) return;
      const next = {
        width: Math.min(1280, Math.max(320, Math.round(bounds.width))),
        height: Math.min(1600, Math.max(400, Math.round(bounds.height)))
      };
      const current = pending ?? viewportSizeRef.current;
      if (current && Math.abs(current.width - next.width) < 8 && Math.abs(current.height - next.height) < 8) return;
      pending = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!pending) return;
        viewportSizeRef.current = pending;
        setViewportSize(pending);
        pending = null;
      }, 220);
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [browserProviderReady, hidden, providerId, sessionId]);

  const refreshSnapshot = useCallback((selectedProvider: BrowserProviderId, sourceSession: string, signal?: AbortSignal) => {
    const requestScope = `${sourceSession}:${selectedProvider}`;
    if (snapshotScopeRef.current !== requestScope) {
      snapshotScopeRef.current = requestScope;
      lastScreenshotRequestAtRef.current = 0;
      snapshotRefreshPromiseRef.current = null;
    }
    const pending = snapshotRefreshPromiseRef.current;
    if (pending?.scope === requestScope) return pending.promise;
    snapshotRequestCountRef.current += 1;
    snapshotRequestInFlight.current = true;
    let request: Promise<BrowserSessionSnapshot | null>;
    request = Promise.resolve().then(async () => {
      try {
        const lastRequestAt = lastScreenshotRequestAtRef.current;
        const waitMs = browserScreenshotWaitMs(lastRequestAt, performance.now());
        await waitForScreenshotFrameSlot(waitMs, signal);
        signal?.throwIfAborted();
        if (snapshotScopeRef.current !== requestScope) return null;
        lastScreenshotRequestAtRef.current = performance.now();
        const result = await loadBrowserDockSession(sourceSession, selectedProvider, signal);
        if (snapshotScopeRef.current === requestScope && result.session) {
          setSnapshot(current => {
            if (snapshotScopeRef.current !== requestScope) return current;
            const next = result.session!;
            if (current && next.revision < current.revision) return current;
            if (current?.screenshot && !next.screenshot) return { ...next, screenshot: current.screenshot };
            return next;
          });
          if (result.session.screenshot) needsVisualRefreshRef.current = false;
        } else if (snapshotScopeRef.current === requestScope) setSnapshot(null);
        return result.session;
      } finally {
        snapshotRequestCountRef.current = Math.max(0, snapshotRequestCountRef.current - 1);
        snapshotRequestInFlight.current = snapshotRequestCountRef.current > 0;
        if (snapshotRefreshPromiseRef.current?.promise === request) snapshotRefreshPromiseRef.current = null;
      }
    });
    snapshotRefreshPromiseRef.current = { scope: requestScope, promise: request };
    return request;
  }, []);

  useEffect(() => {
    if (!providers.length) return;
    setProviderId(current => {
      if (current && providers.some(provider => provider.id === current && provider.available)) return current;
      return providers.find(provider => provider.id === "lfaa-managed-edge" && provider.available)?.id ?? providers.find(provider => provider.available)?.id ?? "";
    });
  }, [providers]);

  useEffect(() => {
    if (!providerId || !browserProviderReady) return;
    const controller = new AbortController();
    void prewarmBrowserDock(providerId, controller.signal).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    });
    return () => controller.abort();
  }, [browserProviderReady, providerId]);

  useEffect(() => {
    const controller = new AbortController();
    setProviderLoading(true);
    void loadBrowserProviders(controller.signal).then(browserResult => {
      if (controller.signal.aborted) return;
      const localProviders = browserResult.providers.filter(item => item.id === "lfaa-managed-edge" || item.id === "lfaa-managed-chrome");
      setProviders(localProviders);
      setProviderId(current => current && localProviders.some(item => item.id === current && item.available)
        ? current
        : localProviders.find(item => item.id === "lfaa-managed-edge" && item.available)?.id
          ?? localProviders.find(item => item.available)?.id ?? "");
      setError("");
    }).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    }).finally(() => { if (!controller.signal.aborted) setProviderLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setSnapshot(null);
    if (!sessionId || !providerId || !browserProviderReady) return;
    const controller = new AbortController();
    void refreshSnapshot(providerId, sessionId, controller.signal).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    });
    return () => controller.abort();
  }, [browserProviderReady, providerId, refreshSnapshot, sessionId]);

  useEffect(() => {
    if (hidden || !sessionId || !providerId || !browserProviderReady || !snapshot || !viewportSize) return;
    const { width, height } = viewportSize;
    const requestKey = `${sessionId}:${providerId}:${width}x${height}`;
    if (lastViewportAttempt.current === requestKey) return;
    if (snapshot.screenshot?.width === width && snapshot.screenshot.height === height) {
      lastViewportAttempt.current = requestKey;
      return;
    }
    if (loading || actionInFlight.current || snapshotRequestInFlight.current || viewportSyncInFlight.current) return;

    lastViewportAttempt.current = requestKey;
    viewportSyncInFlight.current = true;
    setLoading(true);
    void resizeBrowserDockViewport(sessionId, providerId, width, height).then(result => {
      const resized = result.session;
      if (resized) setSnapshot(current => {
        if (current && resized.revision < current.revision) return current;
        if (current?.screenshot && !resized.screenshot) return { ...resized, screenshot: current.screenshot };
        return resized;
      });
    }).catch(reason => {
      setError(getErrorMessage(reason));
    }).finally(() => {
      viewportSyncInFlight.current = false;
      setLoading(false);
    });
  }, [hidden, loading, viewportSize, browserProviderReady, providerId, sessionId, snapshot]);

  useEffect(() => {
    if (hidden || !sessionId || !providerId || !browserProviderReady || !snapshot) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let activeRequest: AbortController | null = null;
    const isPageVisible = () => !hidden && document.visibilityState !== "hidden";
    const poll = async () => {
      if (cancelled || !isPageVisible() || activeRequest || actionInFlight.current || viewportSyncInFlight.current) return;
      const current = snapshotRef.current;
      if (!current) return;
      const request = new AbortController();
      activeRequest = request;
      try {
        const response = await waitForBrowserDockRevision(sessionId, providerId, current.revision, request.signal);
        const latest = snapshotRef.current;
        if (!cancelled && response.session && latest && response.session.revision !== latest.revision) {
          await refreshSnapshot(providerId, sessionId, request.signal);
        } else if (!cancelled && !response.session) {
          setSnapshot(null);
        }
      } catch (reason) {
        if (!cancelled && !request.signal.aborted) setError(getErrorMessage(reason));
      } finally {
        activeRequest = null;
        if (!cancelled && isPageVisible()) timer = setTimeout(() => { void poll(); }, 120);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (timer) clearTimeout(timer);
        timer = undefined;
        activeRequest?.abort();
      } else if (!activeRequest) void poll();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void poll();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      activeRequest?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [browserProviderReady, hidden, providerId, refreshSnapshot, sessionId, Boolean(snapshot)]);

  const runAction = useCallback((operation: () => Promise<{ session: BrowserSessionSnapshot }>): Promise<boolean> => {
    if (queuedActionCountRef.current >= 256) {
      setError("浏览器操作队列已满，请稍等片刻再继续。");
      return Promise.resolve(false);
    }
    const epoch = actionEpochRef.current;
    queuedActionCountRef.current += 1;
    actionInFlight.current = true;
    setLoading(true);
    setError("");
    if (visualRefreshTimerRef.current) clearTimeout(visualRefreshTimerRef.current);
    visualRefreshTimerRef.current = null;
    const task = actionTailRef.current.catch(() => undefined).then(async () => {
      if (epoch !== actionEpochRef.current) return false;
      try {
        const result = await operation();
        if (epoch === actionEpochRef.current) {
          needsVisualRefreshRef.current = !result.session.screenshot;
          setSnapshot(current => {
            const next = result.session;
            if (!next.screenshot && current?.screenshot) return { ...next, screenshot: current.screenshot };
            return next;
          });
        }
        return true;
      } catch (reason) {
        if (epoch === actionEpochRef.current) setError(getErrorMessage(reason));
        return false;
      } finally {
        if (epoch === actionEpochRef.current) {
          queuedActionCountRef.current = Math.max(0, queuedActionCountRef.current - 1);
          if (queuedActionCountRef.current === 0) {
            actionInFlight.current = false;
            setLoading(false);
            const wheelPending = Math.abs(wheelDeltaRef.current) >= 1;
            if (wheelPending) {
              if (wheelFlushTimerRef.current) clearTimeout(wheelFlushTimerRef.current);
              wheelFlushTimerRef.current = setTimeout(() => wheelFlushRef.current?.(), 0);
            } else if (needsVisualRefreshRef.current && sessionId && providerId && browserProviderReady) {
              visualRefreshTimerRef.current = setTimeout(() => {
                visualRefreshTimerRef.current = null;
                if (epoch !== actionEpochRef.current || actionInFlight.current) return;
                void refreshSnapshot(providerId, sessionId).catch(reason => {
                  if (epoch === actionEpochRef.current) setError(getErrorMessage(reason));
                });
              }, BROWSER_VISUAL_REFRESH_DELAY_MS);
            }
          }
        }
      }
    });
    actionTailRef.current = task.then(() => undefined);
    return task;
  }, [browserProviderReady, providerId, refreshSnapshot, sessionId]);

  useEffect(() => {
    actionEpochRef.current += 1;
    const clearPending = () => {
      actionEpochRef.current += 1;
      queuedActionCountRef.current = 0;
      actionInFlight.current = false;
      pendingTextRef.current = "";
      wheelDeltaRef.current = 0;
      pointerGestureRef.current = null;
      for (const timer of [textFlushTimerRef.current, wheelFlushTimerRef.current, visualRefreshTimerRef.current]) {
        if (timer) clearTimeout(timer);
      }
      textFlushTimerRef.current = null;
      wheelFlushTimerRef.current = null;
      visualRefreshTimerRef.current = null;
    };
    return clearPending;
  }, [providerId, sessionId]);

  useEffect(() => {
    if (!navigationRequest) return;
    if (!sessionId || !providerId || !browserProviderReady || handledNavigationRequestRef.current === navigationRequest.id) return;
    handledNavigationRequestRef.current = navigationRequest.id;
    try {
      const target = resolveBrowserAddress(navigationRequest.url, settings.browserUse.searchEngine);
      void runAction(() => navigateBrowserDock(sessionId, providerId, target)).finally(() => onNavigationRequestHandled?.(navigationRequest.id));
    } catch (reason) {
      setError(getErrorMessage(reason));
      onNavigationRequestHandled?.(navigationRequest.id);
    }
  }, [browserProviderReady, navigationRequest?.id, navigationRequest?.url, onNavigationRequestHandled, providerId, runAction, sessionId, settings.browserUse.searchEngine]);

  useEffect(() => {
    if (!actionRequest || navigationRequest || !sessionId || !providerId || !browserProviderReady || handledActionRequestRef.current === actionRequest.id) return;
    handledActionRequestRef.current = actionRequest.id;
    void runAction(() => actOnBrowserDock(sessionId, providerId, { action: actionRequest.action })).finally(() => onActionRequestHandled?.(actionRequest.id));
  }, [actionRequest?.action, actionRequest?.id, browserProviderReady, navigationRequest, onActionRequestHandled, providerId, runAction, sessionId]);

  const onViewportPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!sessionId || !providerId || !snapshot?.screenshot || !imageRef.current || !event.isPrimary || event.button !== 0) return;
    const point = pagePoint(imageRef.current, snapshot.screenshot.width, snapshot.screenshot.height, event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    keyboardCaptureRef.current?.focus({ preventScroll: true });
    pointerGestureRef.current = { pointerId: event.pointerId, pointerType: event.pointerType, start: point, startClientX: event.clientX, startClientY: event.clientY, points: [], lastPage: point, lastClientX: event.clientX, lastClientY: event.clientY, lastAt: event.timeStamp, mode: "pending" };
  }, [providerId, sessionId, snapshot]);

  const onViewportPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !snapshot?.screenshot || !imageRef.current) return;
    const clientDeltaX = event.clientX - gesture.lastClientX, clientDeltaY = event.clientY - gesture.lastClientY;
    if (Math.hypot(clientDeltaX, clientDeltaY) < 1.5) return;
    if (gesture.mode === "pending") {
      const totalX = event.clientX - gesture.startClientX, totalY = event.clientY - gesture.startClientY;
      if (Math.hypot(totalX, totalY) >= (gesture.pointerType === "touch" ? 7 : 4)) {
        gesture.mode = gesture.pointerType === "touch" && Math.abs(totalY) > Math.abs(totalX) * 1.2 ? "scroll" : "drag";
      }
    }
    if (gesture.mode === "drag") {
      const point = pagePoint(imageRef.current, snapshot.screenshot.width, snapshot.screenshot.height, event.clientX, event.clientY, true);
      if (point && (point.x !== gesture.lastPage.x || point.y !== gesture.lastPage.y)) {
        const elapsed = Math.max(0, Math.round(event.timeStamp - gesture.lastAt));
        const recordedDelay = gesture.points.reduce((total, item) => total + item.delayMs, 0);
        const delayMs = Math.min(1000, elapsed, Math.max(0, 15_000 - recordedDelay));
        if (gesture.points.length >= 128) {
          const compacted = [] as BrowserGesture["points"];
          for (let index = 1; index < gesture.points.length; index += 2) {
            const current = gesture.points[index], next = gesture.points[index + 1];
            compacted.push(next ? { ...next, delayMs: Math.min(1000, current.delayMs + next.delayMs) } : current);
          }
          gesture.points.splice(0, gesture.points.length, ...compacted);
        }
        gesture.points.push({ ...point, delayMs });
        gesture.lastPage = point;
        gesture.lastAt = event.timeStamp;
      }
    }
    gesture.lastClientX = event.clientX;
    gesture.lastClientY = event.clientY;
    event.preventDefault();
  }, [snapshot]);

  const onViewportPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !snapshot?.screenshot || !imageRef.current) return;
    event.preventDefault();
    pointerGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!sessionId || !providerId) return;
    if (gesture.mode === "drag") {
      const point = pagePoint(imageRef.current, snapshot.screenshot.width, snapshot.screenshot.height, event.clientX, event.clientY, true);
      if (point && (point.x !== gesture.lastPage.x || point.y !== gesture.lastPage.y)) {
        const elapsed = Math.max(0, Math.round(event.timeStamp - gesture.lastAt));
        const recordedDelay = gesture.points.reduce((total, item) => total + item.delayMs, 0);
        const lastPoint = { ...point, delayMs: Math.min(1000, elapsed, Math.max(0, 15_000 - recordedDelay)) };
        if (gesture.points.length >= 128) gesture.points[127] = lastPoint;
        else gesture.points.push(lastPoint);
      }
      if (gesture.points.length) void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "dragAt", x: gesture.start.x, y: gesture.start.y, points: gesture.points }));
      else void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "clickAt", x: gesture.start.x, y: gesture.start.y }));
    } else if (gesture.mode === "scroll") {
      const amount = Math.max(-12_000, Math.min(12_000, Math.round(gesture.startClientY - event.clientY)));
      wheelDeltaRef.current = Math.max(-12_000, Math.min(12_000, wheelDeltaRef.current + amount));
      if (!wheelFlushTimerRef.current) wheelFlushTimerRef.current = setTimeout(() => wheelFlushRef.current?.(), 0);
    } else {
      void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "clickAt", x: gesture.start.x, y: gesture.start.y }));
    }
  }, [providerId, runAction, sessionId, snapshot]);

  const onViewportPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (pointerGestureRef.current?.pointerId !== event.pointerId) return;
    pointerGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const flushText = useCallback(() => {
    textFlushTimerRef.current = null;
    if (composingRef.current || !pendingTextRef.current || !sessionId || !providerId) return;
    if (queuedActionCountRef.current >= 250) {
      textFlushTimerRef.current = setTimeout(flushText, 240);
      return;
    }
    const text = pendingTextRef.current.slice(0, 2000);
    pendingTextRef.current = pendingTextRef.current.slice(text.length);
    void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "typeText", text, includeScreenshot: false }));
    if (pendingTextRef.current) textFlushTimerRef.current = setTimeout(flushText, 120);
  }, [providerId, runAction, sessionId]);

  const appendUserText = useCallback((text: string) => {
    if (!text) return;
    if (pendingTextRef.current.length + text.length > 8000) {
      setError("页面输入缓存达到上限，超出部分未发送。");
      return;
    }
    pendingTextRef.current += text;
    if (textFlushTimerRef.current) clearTimeout(textFlushTimerRef.current);
    textFlushTimerRef.current = setTimeout(flushText, 240);
  }, [flushText]);

  const onViewportInput = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (composingRef.current || nativeEvent.isComposing) return;
    const target = event.currentTarget;
    const text = target.value;
    target.value = "";
    appendUserText(text);
  }, [appendUserText]);

  const onViewportKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    const key = event.key;
    if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Process", "Dead"].includes(key)) return;
    const altGraph = event.getModifierState("AltGraph");
    const modifier = !altGraph && (event.ctrlKey || event.metaKey);
    const shortcut = modifier ? `${event.ctrlKey ? "Control" : "Meta"}+${key.toUpperCase()}` : "";
    const keyMap: Record<string, string> = {
      Enter: "Enter", Tab: event.shiftKey ? "Shift+Tab" : "Tab", Escape: "Escape", ArrowDown: "ArrowDown", ArrowUp: "ArrowUp",
      ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Home: "Home", End: "End", PageDown: "PageDown", PageUp: "PageUp",
      " ": "Space", Backspace: "Backspace", Delete: "Delete"
    };
    const forwarded = modifier ? shortcut : keyMap[key];
    if (forwarded) {
      event.preventDefault();
      event.stopPropagation();
      if (sessionId && providerId) void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "pressKey", key: forwarded, includeScreenshot: false }));
    } else if (!altGraph && (modifier || event.altKey)) {
      event.preventDefault();
      event.stopPropagation();
      setError("这个快捷键暂不转发到网页。");
    }
  }, [providerId, runAction, sessionId]);

  const flushWheel = useCallback(() => {
    wheelFlushTimerRef.current = null;
    if (!sessionId || !providerId || Math.abs(wheelDeltaRef.current) < 1) return;
    if (actionInFlight.current) {
      wheelFlushTimerRef.current = setTimeout(flushWheel, BROWSER_SCROLL_INPUT_DELAY_MS);
      return;
    }
    if (queuedActionCountRef.current >= 250) {
      wheelFlushTimerRef.current = setTimeout(flushWheel, BROWSER_SCROLL_INPUT_DELAY_MS);
      return;
    }
    const delta = wheelDeltaRef.current;
    const amount = Math.min(600, Math.max(1, Math.round(Math.abs(delta))));
    wheelDeltaRef.current -= Math.sign(delta) * amount;
    void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "scroll", direction: delta > 0 ? "down" : "up", amount, includeScreenshot: false }));
    if (Math.abs(wheelDeltaRef.current) >= 1) wheelFlushTimerRef.current = setTimeout(flushWheel, BROWSER_SCROLL_INPUT_DELAY_MS);
  }, [providerId, runAction, sessionId]);

  useEffect(() => { wheelFlushRef.current = flushWheel; }, [flushWheel]);

  useEffect(() => {
    const viewport = viewportWrapRef.current;
    if (!snapshot?.screenshot || !viewport) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      if (!sessionId || !providerId || !snapshotRef.current?.screenshot) return;
      event.preventDefault();
      event.stopPropagation();
      const factor = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? Math.max(400, contentRef.current?.clientHeight ?? 800) : 1;
      wheelDeltaRef.current = Math.max(-12000, Math.min(12000, wheelDeltaRef.current + event.deltaY * factor));
      if (visualRefreshTimerRef.current) clearTimeout(visualRefreshTimerRef.current);
      visualRefreshTimerRef.current = null;
      if (!wheelFlushTimerRef.current) wheelFlushTimerRef.current = setTimeout(() => wheelFlushRef.current?.(), BROWSER_SCROLL_INPUT_DELAY_MS);
    };
    viewport.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => viewport.removeEventListener("wheel", onWheel, true);
  }, [providerId, sessionId, Boolean(snapshot?.screenshot)]);

  const currentProvider = providers.find(item => item.id === providerId && item.available);
  const providerReason = providers.map(provider => provider.reason).filter(Boolean).join(" ");
  const emptyText = !sessionId
    ? "当前没有可用的 AI 会话。"
    : providerLoading
      ? "正在准备网页…"
      : !currentProvider
        ? providerReason || "当前 Host 没有可用的 LFAA 浏览器。"
        : snapshot
          ? "网页正在加载，或当前页面暂时无法显示。"
          : "正在当前区域打开网页…";
  return <section className="lfaa-browser-panel" aria-label="网页内容" hidden={hidden}>
    {error ? <div className="lfaa-browser-panel__error" role="alert">{error}</div> : null}
    <div ref={contentRef} className="lfaa-browser-panel__content">
      {snapshot?.screenshot ? <div ref={viewportWrapRef} className="lfaa-browser-panel__viewport-wrap" onPointerDown={onViewportPointerDown} onPointerMove={onViewportPointerMove} onPointerUp={onViewportPointerUp} onPointerCancel={onViewportPointerCancel}>
        <img ref={imageRef} className="lfaa-browser-panel__viewport" src={`data:${snapshot.screenshot.mimeType};base64,${snapshot.screenshot.dataBase64}`} alt={`${snapshot.title || snapshot.url} 页面；点击可操作，滚轮可滚动`} />
        <textarea ref={keyboardCaptureRef} className="lfaa-browser-panel__input-capture" aria-label="网页交互区；点击后可输入，按住并拖动可操作页面" autoCapitalize="off" autoCorrect="off" spellCheck={false} onInput={onViewportInput} onKeyDown={onViewportKeyDown} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} />
        {loading || snapshot.loading ? <span className="lfaa-browser-panel__busy" role="status">网页加载中…</span> : null}
      </div> : <div className="lfaa-browser-panel__empty" role={providerLoading || loading ? "status" : undefined}>{emptyText}</div>}
    </div>
  </section>;
}

export function BrowserPanel(props: BrowserPanelProps) {
  if (typeof window !== "undefined" && window.lfaaDesktop?.nativeBrowser) {
    return <NativeBrowserPanel {...props} />;
  }
  return <BrowserUsePanel {...props} />;
}
