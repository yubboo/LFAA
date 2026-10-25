/**
 * 功能：在 AI Work 右侧 Dock 展示 Browser Owner 的真实网页；Web 使用认证实时帧流，Electron 使用原生 WebContentsView。
 * 作用：地址、标签与导航操作仍由 ApplicationWorkspace 统一提供；Agent 与用户共用同一 Browser Owner Page。
 * 关联文件：NativeBrowserPanel.tsx、packages/browser-use/browser-use、packages/client/ui-workspace。
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { actOnBrowserDock, getErrorMessage, loadBrowserDockSession, loadBrowserProviders, navigateBrowserDock, resizeBrowserDockViewport, streamBrowserDockFrames, waitForBrowserDockRevision, type BrowserDockFrame, type BrowserProviderId, type BrowserProviderSummary, type BrowserSessionSnapshot, type UserSettings } from "lfaa-client-connection/src/api.js";
import { NativeBrowserPanel } from "./NativeBrowserPanel.js";
import { resolveBrowserAddress } from "./browser-address.js";
import { preferCurrentBrowserSnapshot, shouldRestoreBrowserDockPage } from "./browser-snapshot.js";
import "./browser-panel.css";

type BrowserNavigationRequest = { id: string; url: string };
type BrowserDockActionRequest = { id: string; action: "back" | "forward" | "reload" };
type BrowserPoint = { x: number; y: number };
type BrowserGesture = { pointerId: number; pointerType: string; start: BrowserPoint; points: Array<BrowserPoint & { delayMs: number }>; last: BrowserPoint; startClientX: number; startClientY: number; lastAt: number };
type BrowserPanelProps = {
  sessionId: string | null;
  settings: UserSettings;
  browserUrl?: string;
  preferredProviderId?: BrowserProviderId | null;
  providerSelectionRequestId?: number;
  hidden?: boolean;
  navigationRequest?: BrowserNavigationRequest | null;
  onNavigationRequestHandled?: (requestId: string) => void;
  actionRequest?: BrowserDockActionRequest | null;
  onActionRequestHandled?: (requestId: string) => void;
  onOpenTabsChange?: (tabs: Array<{ id: string; title: string; url: string; active: boolean }>) => void;
};

function displayAddress(value: string, showFullUrl: boolean): string {
  if (showFullUrl) return value;
  try { return new URL(value).host; } catch { return value; }
}

function BrowserUsePanel({ sessionId, settings, browserUrl, preferredProviderId = null, providerSelectionRequestId, hidden = false, navigationRequest, onNavigationRequestHandled, actionRequest, onActionRequestHandled, onOpenTabsChange }: BrowserPanelProps) {
  const [providers, setProviders] = useState<BrowserProviderSummary[]>([]);
  const [providerId, setProviderId] = useState<BrowserProviderId | "">("");
  const [snapshot, setSnapshot] = useState<BrowserSessionSnapshot | null>(null);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const snapshotRef = useRef<BrowserSessionSnapshot | null>(null);
  const snapshotBindingRef = useRef("");
  const snapshotWriteRef = useRef(0);
  const [liveStream, setLiveStream] = useState(false);
  const [liveStreamConnecting, setLiveStreamConnecting] = useState(false);
  const [liveStreamError, setLiveStreamError] = useState("");
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const liveStreamRef = useRef(false);
  const liveStreamControllerRef = useRef<AbortController | null>(null);
  const liveStreamBindingRef = useRef("");
  const liveStreamPageRef = useRef("");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const streamRequestIdRef = useRef(0);
  const streamPendingRef = useRef(false);
  const pendingFrameRef = useRef<BrowserDockFrame | null>(null);
  const frameDecodingRef = useRef(false);
  const drainFramesRef = useRef<() => void>(() => undefined);
  const scopeRef = useRef({ sessionId, providerId, hidden });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keyboardCaptureRef = useRef<HTMLTextAreaElement | null>(null);
  const browserGestureRef = useRef<BrowserGesture | null>(null);
  const pendingTextRef = useRef("");
  const composingRef = useRef(false);
  const textFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState("");
  const [providerLoading, setProviderLoading] = useState(true);
  const actionTailRef = useRef<Promise<void>>(Promise.resolve());
  const actionCountRef = useRef(0);
  const handledNavigationRequestRef = useRef("");
  const handledActionRequestRef = useRef("");
  const restoreNavigationRef = useRef("");
  const snapshotRefreshRef = useRef<{ scope: string; promise: Promise<BrowserSessionSnapshot | null> } | null>(null);
  const liveViewRef = useRef<HTMLDivElement | null>(null);
  const providerReady = Boolean(providerId && providers.some(provider => provider.id === providerId && provider.available));

  scopeRef.current = { sessionId, providerId, hidden };
  snapshotRef.current = snapshot;

  useEffect(() => {
    onOpenTabsChange?.(snapshot?.tabs ?? []);
  }, [onOpenTabsChange, snapshot?.tabs]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBrowserProviders(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const localProviders = result.providers.filter(item => item.id === "lfaa-managed-edge" || item.id === "lfaa-managed-chrome");
      setProviders(localProviders);
      setProviderId(current => current && localProviders.some(item => item.id === current && item.available)
        ? current
        : localProviders.find(item => item.id === "lfaa-managed-edge" && item.available)?.id
          ?? localProviders.find(item => item.available)?.id ?? "");
      setError("");
    }).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    }).finally(() => {
      if (!controller.signal.aborted) setProviderLoading(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (preferredProviderId !== "lfaa-managed-edge" && preferredProviderId !== "lfaa-managed-chrome") return;
    if (providers.some(provider => provider.id === preferredProviderId && provider.available)) setProviderId(preferredProviderId);
  }, [preferredProviderId, providerSelectionRequestId, providers]);

  const refreshSnapshot = useCallback((selectedProvider: BrowserProviderId, sourceSession: string, signal?: AbortSignal) => {
    const scope = `${sourceSession}:${selectedProvider}`;
    const existing = snapshotRefreshRef.current;
    if (existing?.scope === scope) return existing.promise;
    if (existing) snapshotRefreshRef.current = null;
    const writeAtStart = snapshotWriteRef.current;
    const request = loadBrowserDockSession(sourceSession, selectedProvider, signal).then(result => {
      if (snapshotRefreshRef.current?.scope !== scope) return null;
      setSnapshotReady(true);
      if (snapshotWriteRef.current !== writeAtStart) return snapshotRef.current;
      const next = result.session;
      if (next) {
        snapshotBindingRef.current = scope;
        snapshotWriteRef.current += 1;
        setSnapshot(current => preferCurrentBrowserSnapshot(current, next));
      } else {
        snapshotBindingRef.current = "";
        setSnapshot(null);
        snapshotWriteRef.current += 1;
      }
      return next;
    }).finally(() => {
      if (snapshotRefreshRef.current?.promise === request) snapshotRefreshRef.current = null;
    });
    snapshotRefreshRef.current = { scope, promise: request };
    return request;
  }, []);

  useEffect(() => {
    snapshotBindingRef.current = "";
    setSnapshot(null);
    setSnapshotReady(false);
    snapshotWriteRef.current += 1;
    snapshotRefreshRef.current = null;
    if (!sessionId || !providerId || !providerReady) return;
    const controller = new AbortController();
    void refreshSnapshot(providerId, sessionId, controller.signal).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    });
    return () => controller.abort();
  }, [providerId, providerReady, refreshSnapshot, sessionId]);

  const activePageId = snapshot?.tabs.find(tab => tab.active)?.id ?? "";
  useEffect(() => {
    const hasOpenedPage = snapshot?.tabs.some(tab => tab.active && /^https?:/u.test(tab.url)) ?? false;
    if (!sessionId || !providerId || !providerReady || hidden && hasOpenedPage) return;
    let cancelled = false;
    let activeRequest: AbortController | null = null;
    const poll = async () => {
      while (!cancelled && document.visibilityState !== "hidden") {
        const current = snapshotRef.current;
        if (hidden && current?.tabs.some(tab => tab.active && /^https?:/u.test(tab.url))) return;
        const request = new AbortController();
        activeRequest = request;
        try {
          const response = await waitForBrowserDockRevision(sessionId, providerId, current?.revision ?? 0, request.signal);
          if (cancelled) return;
          if (!response.session) {
            const refreshed = await refreshSnapshot(providerId, sessionId, request.signal);
            if (!refreshed) return;
            continue;
          }
          if (!current || response.session.revision !== current.revision) {
            await refreshSnapshot(providerId, sessionId, request.signal);
          }
        } catch (reason) {
          if (!cancelled && !request.signal.aborted) setError(getErrorMessage(reason));
          if (!request.signal.aborted) return;
        } finally {
          if (activeRequest === request) activeRequest = null;
        }
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") activeRequest?.abort();
      else if (!activeRequest) void poll();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void poll();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      activeRequest?.abort();
    };
  }, [hidden, providerId, providerReady, refreshSnapshot, sessionId, Boolean(snapshot)]);

  useEffect(() => {
    const element = liveViewRef.current;
    if (!element || hidden || !sessionId || !providerId || !providerReady || !snapshot) return;
    const binding = `${sessionId}:${providerId}`;
    let disposed = false;
    let inFlight = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;
    let pendingSize: { width: number; height: number } | null = null;
    let lastAppliedSize = snapshot.viewport?.width && snapshot.viewport.height ? { width: snapshot.viewport.width, height: snapshot.viewport.height } : null;
    const sizesMatch = (left: { width: number; height: number } | null, right: { width: number; height: number }) =>
      Boolean(left && Math.abs(left.width - right.width) <= 1 && Math.abs(left.height - right.height) <= 1);
    const flushResize = async () => {
      resizeTimer = null;
      if (disposed || inFlight || !pendingSize) return;
      const nextSize = pendingSize;
      pendingSize = null;
      if (sizesMatch(lastAppliedSize, nextSize)) return;
      const controller = new AbortController();
      activeController = controller;
      inFlight = true;
      try {
        const result = await resizeBrowserDockViewport(sessionId, providerId, nextSize.width, nextSize.height, controller.signal);
        const updated = result.session;
        if (!disposed && updated && `${scopeRef.current.sessionId}:${scopeRef.current.providerId}` === binding) {
          lastAppliedSize = nextSize;
          snapshotBindingRef.current = binding;
          snapshotWriteRef.current += 1;
          setSnapshot(current => preferCurrentBrowserSnapshot(current, updated));
        }
      } catch (reason) {
        if (!disposed && !controller.signal.aborted) setError(getErrorMessage(reason));
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (pendingSize && !disposed) resizeTimer = setTimeout(() => { void flushResize(); }, 160);
      }
    };
    const readContainerSize = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      const nextSize = {
        width: Math.max(320, Math.min(1280, Math.round(bounds.width))),
        height: Math.max(400, Math.min(1600, Math.round(bounds.height)))
      };
      if (!inFlight && sizesMatch(lastAppliedSize, nextSize) && !pendingSize) return;
      pendingSize = nextSize;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { void flushResize(); }, 160);
    };
    const observer = new ResizeObserver(readContainerSize);
    observer.observe(element);
    readContainerSize();
    return () => {
      disposed = true;
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      activeController?.abort();
    };
  }, [hidden, providerId, providerReady, sessionId, snapshot?.sessionId]);

  const runAction = useCallback((operation: () => Promise<{ session: BrowserSessionSnapshot }>): Promise<void> => {
    if (actionCountRef.current >= 32) {
      setError("浏览器操作较多，请等待当前操作完成后继续。");
      return Promise.resolve();
    }
    actionCountRef.current += 1;
    setError("");
    const scope = `${scopeRef.current.sessionId}:${scopeRef.current.providerId}`;
    const task = actionTailRef.current.catch(() => undefined).then(async () => {
      try {
        const result = await operation();
        if (`${scopeRef.current.sessionId}:${scopeRef.current.providerId}` !== scope) return;
        snapshotBindingRef.current = scope;
        snapshotWriteRef.current += 1;
        setSnapshot(current => preferCurrentBrowserSnapshot(current, result.session));
      } catch (reason) {
        if (`${scopeRef.current.sessionId}:${scopeRef.current.providerId}` === scope) setError(getErrorMessage(reason));
      } finally {
        actionCountRef.current = Math.max(0, actionCountRef.current - 1);
      }
    });
    actionTailRef.current = task.then(() => undefined);
    return task;
  }, []);

  const stopLiveView = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    reconnectAttemptRef.current = 0;
    streamRequestIdRef.current += 1;
    streamPendingRef.current = false;
    setLiveStreamConnecting(false);
    liveStreamRef.current = false;
    liveStreamControllerRef.current?.abort();
    liveStreamControllerRef.current = null;
    liveStreamBindingRef.current = "";
    liveStreamPageRef.current = "";
    pendingFrameRef.current = null;
    browserGestureRef.current = null;
    pendingTextRef.current = "";
    wheelDeltaRef.current = 0;
    if (textFlushTimerRef.current) clearTimeout(textFlushTimerRef.current);
    if (wheelFlushTimerRef.current) clearTimeout(wheelFlushTimerRef.current);
    textFlushTimerRef.current = null;
    wheelFlushTimerRef.current = null;
    setLiveStream(false);
  }, []);

  useEffect(() => {
    const sourceSession = sessionId;
    const selectedProvider = providerId;
    if (!sourceSession || !selectedProvider || !providerReady || hidden
      || !shouldRestoreBrowserDockPage(browserUrl, snapshotReady, snapshot?.url, Boolean(navigationRequest))) {
      if (snapshot) restoreNavigationRef.current = "";
      return;
    }
    const key = `${sourceSession}:${selectedProvider}:${browserUrl}`;
    if (restoreNavigationRef.current === key) return;
    restoreNavigationRef.current = key;
    stopLiveView();
    setHasRenderedFrame(false);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    try {
      const target = resolveBrowserAddress(browserUrl!, settings.browserUse.searchEngine);
      void runAction(() => navigateBrowserDock(sourceSession, selectedProvider, target));
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, [browserUrl, hidden, navigationRequest, providerId, providerReady, runAction, sessionId, settings.browserUse.searchEngine, snapshot, snapshotReady, stopLiveView]);

  const startLiveView = useCallback(async () => {
    if (streamPendingRef.current || liveStreamRef.current || !sessionId || !providerId) return;
    setLiveStreamError("");
    const binding = `${sessionId}:${providerId}`;
    const pageId = snapshotRef.current?.tabs.find(tab => tab.active)?.id ?? "";
    if (!pageId || snapshotBindingRef.current !== binding) return;
    const requestId = ++streamRequestIdRef.current;
    const controller = new AbortController();
    liveStreamControllerRef.current = controller;
    streamPendingRef.current = true;
    setLiveStreamConnecting(true);
    try {
      liveStreamBindingRef.current = binding;
      liveStreamPageRef.current = pageId;
      await streamBrowserDockFrames(sessionId, providerId, controller.signal, frame => {
        const scope = scopeRef.current;
        const latestPageId = snapshotRef.current?.tabs.find(tab => tab.active)?.id ?? "";
        if (requestId !== streamRequestIdRef.current || scope.hidden || `${scope.sessionId}:${scope.providerId}` !== binding || latestPageId !== pageId) return;
        liveStreamRef.current = true;
        pendingFrameRef.current = frame;
        drainFramesRef.current();
      });
      if (!controller.signal.aborted && requestId === streamRequestIdRef.current) {
        setLiveStreamError("网页画面流已结束。");
        void refreshSnapshot(providerId, sessionId).catch(reason => {
          if (!controller.signal.aborted) setError(getErrorMessage(reason));
        });
      }
    } catch (reason) {
      if (!controller.signal.aborted && requestId === streamRequestIdRef.current) {
        setLiveStreamError(getErrorMessage(reason));
        void refreshSnapshot(providerId, sessionId).catch(refreshReason => {
          if (!controller.signal.aborted) setError(getErrorMessage(refreshReason));
        });
      }
    } finally {
      if (requestId === streamRequestIdRef.current) {
        streamPendingRef.current = false;
        setLiveStreamConnecting(false);
        liveStreamRef.current = false;
        liveStreamControllerRef.current = null;
        liveStreamBindingRef.current = "";
        liveStreamPageRef.current = "";
        setLiveStream(false);
        const scope = scopeRef.current;
        if (!controller.signal.aborted && !scope.hidden && document.visibilityState !== "hidden" && `${scope.sessionId}:${scope.providerId}` === binding && snapshotRef.current?.tabs.some(tab => tab.id === pageId && tab.active)) {
          const delay = Math.min(5000, 300 * 2 ** Math.min(reconnectAttemptRef.current++, 4));
          reconnectTimerRef.current = setTimeout(() => { reconnectTimerRef.current = null; void startLiveView(); }, delay);
        }
      }
    }
  }, [providerId, refreshSnapshot, sessionId, stopLiveView]);

  drainFramesRef.current = () => {
    if (frameDecodingRef.current || !pendingFrameRef.current) return;
    frameDecodingRef.current = true;
    const requestId = streamRequestIdRef.current;
    void (async () => {
      try {
        while (pendingFrameRef.current && requestId === streamRequestIdRef.current) {
          const frame = pendingFrameRef.current;
          pendingFrameRef.current = null;
          const binary = atob(frame.dataBase64);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
          const canvas = canvasRef.current;
          if (canvas && requestId === streamRequestIdRef.current) {
            if (canvas.width !== frame.width || canvas.height !== frame.height) {
              canvas.width = frame.width;
              canvas.height = frame.height;
            }
            canvas.getContext("2d", { alpha: false })?.drawImage(bitmap, 0, 0, frame.width, frame.height);
            reconnectAttemptRef.current = 0;
            setHasRenderedFrame(true);
            setLiveStream(true);
            setLiveStreamConnecting(false);
            setLiveStreamError("");
          }
          bitmap.close();
        }
      } catch (reason) {
        if (requestId === streamRequestIdRef.current) setLiveStreamError(getErrorMessage(reason));
      } finally {
        frameDecodingRef.current = false;
        if (pendingFrameRef.current && requestId === streamRequestIdRef.current) drainFramesRef.current();
      }
    })();
  };

  useEffect(() => {
    const expectedBinding = sessionId && providerId ? `${sessionId}:${providerId}` : "";
    if (hidden || !expectedBinding || (liveStreamControllerRef.current && liveStreamBindingRef.current !== expectedBinding)) stopLiveView();
  }, [hidden, providerId, sessionId, stopLiveView]);

  useEffect(() => {
    setHasRenderedFrame(false);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [providerId, sessionId]);

  useEffect(() => {
    if (!sessionId || !providerId || !providerReady || !snapshot || !activePageId || hidden || document.visibilityState === "hidden") return;
    if (liveStreamControllerRef.current && liveStreamBindingRef.current === `${sessionId}:${providerId}` && liveStreamPageRef.current === activePageId) return;
    stopLiveView();
    void startLiveView();
  }, [activePageId, hidden, providerId, providerReady, sessionId, snapshot?.sessionId, startLiveView, stopLiveView]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopLiveView();
      else if (!hidden && sessionId && providerId && providerReady && snapshot && activePageId) void startLiveView();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [activePageId, hidden, providerId, providerReady, sessionId, snapshot, startLiveView, stopLiveView]);

  useEffect(() => () => {
    streamRequestIdRef.current += 1;
    streamPendingRef.current = false;
    liveStreamControllerRef.current?.abort();
    liveStreamControllerRef.current = null;
    liveStreamRef.current = false;
    liveStreamBindingRef.current = "";
    liveStreamPageRef.current = "";
    pendingFrameRef.current = null;
    if (textFlushTimerRef.current) clearTimeout(textFlushTimerRef.current);
    if (wheelFlushTimerRef.current) clearTimeout(wheelFlushTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
  }, []);

  const flushText = useCallback(() => {
    textFlushTimerRef.current = null;
    if (composingRef.current || !pendingTextRef.current || !sessionId || !providerId) return;
    const text = pendingTextRef.current.slice(0, 2000);
    pendingTextRef.current = pendingTextRef.current.slice(text.length);
    void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "typeText", text, includeScreenshot: false }));
    if (pendingTextRef.current) textFlushTimerRef.current = setTimeout(flushText, 120);
  }, [providerId, runAction, sessionId]);

  const appendUserText = useCallback((text: string) => {
    if (!text) return;
    if (pendingTextRef.current.length + text.length > 8000) {
      setLiveStreamError("网页输入缓存已达上限，超出部分未发送。");
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
    if (!sessionId || !providerId) return;
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
      void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "pressKey", key: forwarded, includeScreenshot: false }));
    } else if (!altGraph && (modifier || event.altKey)) {
      event.preventDefault();
      event.stopPropagation();
      setLiveStreamError("这个快捷键暂不转发到网页。");
    }
  }, [providerId, runAction, sessionId]);

  const pagePoint = useCallback((element: HTMLCanvasElement, clientX: number, clientY: number): BrowserPoint | null => {
    const viewport = snapshotRef.current?.viewport;
    if (!viewport?.width || !viewport.height || !element.width || !element.height) return null;
    const rect = element.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    if (relativeX < 0 || relativeY < 0 || relativeX > rect.width || relativeY > rect.height) return null;
    return {
      x: Math.max(0, Math.min(viewport.width - 1, Math.round(relativeX / rect.width * viewport.width))),
      y: Math.max(0, Math.min(viewport.height - 1, Math.round(relativeY / rect.height * viewport.height)))
    };
  }, []);

  const onViewportPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!sessionId || !providerId || event.button !== 0 || !canvasRef.current) return;
    const point = pagePoint(canvasRef.current, event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    keyboardCaptureRef.current?.focus({ preventScroll: true });
    browserGestureRef.current = { pointerId: event.pointerId, pointerType: event.pointerType, start: point, points: [], last: point, startClientX: event.clientX, startClientY: event.clientY, lastAt: event.timeStamp };
  }, [pagePoint, providerId, sessionId]);

  const onViewportPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = browserGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !canvasRef.current) return;
    const point = pagePoint(canvasRef.current, event.clientX, event.clientY);
    if (!point || (point.x === gesture.last.x && point.y === gesture.last.y)) return;
    event.preventDefault();
    const delayMs = Math.min(1000, Math.max(0, Math.round(event.timeStamp - gesture.lastAt)));
    if (gesture.points.length < 128) gesture.points.push({ ...point, delayMs });
    else if ((gesture.points.length & 1) === 0) gesture.points[gesture.points.length - 1] = { ...point, delayMs };
    gesture.last = point;
    gesture.lastAt = event.timeStamp;
  }, [pagePoint]);

  const onViewportPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = browserGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !canvasRef.current || !sessionId || !providerId) return;
    event.preventDefault();
    browserGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const point = pagePoint(canvasRef.current, event.clientX, event.clientY) ?? gesture.last;
    const touchDeltaY = event.clientY - gesture.startClientY;
    const touchDeltaX = event.clientX - gesture.startClientX;
    if (gesture.pointerType === "touch" && Math.abs(touchDeltaY) > 8 && Math.abs(touchDeltaY) > Math.abs(touchDeltaX)) {
      const amount = Math.min(600, Math.max(1, Math.round(Math.abs(touchDeltaY) * (snapshotRef.current?.viewport?.height ?? 800) / Math.max(1, canvasRef.current.clientHeight))));
      void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "scroll", direction: touchDeltaY < 0 ? "down" : "up", amount, includeScreenshot: false }));
    } else if (gesture.points.length) {
      gesture.points.push({ ...point, delayMs: 0 });
      void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "dragAt", x: gesture.start.x, y: gesture.start.y, points: gesture.points.slice(0, 128), includeScreenshot: false }));
    } else {
      void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "clickAt", x: point.x, y: point.y, includeScreenshot: false }));
    }
  }, [pagePoint, providerId, runAction, sessionId]);

  const onViewportPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (browserGestureRef.current?.pointerId === event.pointerId) browserGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const flushWheel = useCallback(() => {
    wheelFlushTimerRef.current = null;
    if (!sessionId || !providerId || Math.abs(wheelDeltaRef.current) < 1) return;
    if (actionCountRef.current) {
      wheelFlushTimerRef.current = setTimeout(flushWheel, 60);
      return;
    }
    const delta = wheelDeltaRef.current;
    const amount = Math.min(600, Math.max(1, Math.round(Math.abs(delta))));
    wheelDeltaRef.current -= Math.sign(delta) * amount;
    void runAction(() => actOnBrowserDock(sessionId, providerId, { action: "scroll", direction: delta > 0 ? "down" : "up", amount, includeScreenshot: false }))
      .finally(() => { if (Math.abs(wheelDeltaRef.current) >= 1 && !wheelFlushTimerRef.current) wheelFlushTimerRef.current = setTimeout(flushWheel, 60); });
  }, [providerId, runAction, sessionId]);

  const onViewportWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!sessionId || !providerId || !snapshotRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const factor = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? Math.max(400, event.currentTarget.clientHeight) : 1;
    wheelDeltaRef.current = Math.max(-12_000, Math.min(12_000, wheelDeltaRef.current + event.deltaY * factor));
    if (!wheelFlushTimerRef.current && !actionCountRef.current) wheelFlushTimerRef.current = setTimeout(flushWheel, 60);
  }, [flushWheel, providerId, sessionId]);

  useEffect(() => {
    if (!navigationRequest || !sessionId || !providerId || !providerReady || handledNavigationRequestRef.current === navigationRequest.id) return;
    handledNavigationRequestRef.current = navigationRequest.id;
    try {
      const target = resolveBrowserAddress(navigationRequest.url, settings.browserUse.searchEngine);
      void runAction(() => navigateBrowserDock(sessionId, providerId, target)).finally(() => onNavigationRequestHandled?.(navigationRequest.id));
    } catch (reason) {
      setError(getErrorMessage(reason));
      onNavigationRequestHandled?.(navigationRequest.id);
    }
  }, [navigationRequest?.id, navigationRequest?.url, onNavigationRequestHandled, providerId, providerReady, runAction, sessionId, settings.browserUse.searchEngine]);

  useEffect(() => {
    if (!actionRequest || navigationRequest || !sessionId || !providerId || !providerReady || handledActionRequestRef.current === actionRequest.id) return;
    handledActionRequestRef.current = actionRequest.id;
    void runAction(() => actOnBrowserDock(sessionId, providerId, { action: actionRequest.action })).finally(() => onActionRequestHandled?.(actionRequest.id));
  }, [actionRequest?.action, actionRequest?.id, navigationRequest, onActionRequestHandled, providerId, providerReady, runAction, sessionId]);

  const currentProvider = providers.find(item => item.id === providerId && item.available);
  const emptyText = !sessionId
    ? "浏览器工作区暂时不可用。"
    : providerLoading
      ? "正在检查本机 Chromium 浏览器…"
      : !currentProvider
        ? providers.map(provider => provider.reason).filter(Boolean).join(" ") || "当前 Web Host 没有可连接的本机 Chromium 页面。请在本机 Web Host 或 LFAA Electron 桌面端打开浏览器。"
        : "在上方地址栏输入网址，网页会直接显示在此处；Agent 使用同一页面。";
  const pageAddress = snapshot ? displayAddress(snapshot.url, settings.browserUse.showFullUrl) : "";

  return <section className="lfaa-browser-panel" aria-label="浏览器工作区" hidden={hidden}>
    {error || liveStreamError ? <div className="lfaa-browser-panel__error" role="alert">{error || liveStreamError}</div> : null}
    <div className="lfaa-browser-panel__content">
      {snapshot ? <div className="lfaa-browser-panel__page">
        <header className="lfaa-browser-panel__page-header">
          <div className="lfaa-browser-panel__page-heading" aria-live="polite">
            <strong title={snapshot.title}>{snapshot.loading ? "网页仍在加载" : snapshot.title || "已打开网页"}</strong>
            <span title={snapshot.url}>{pageAddress || snapshot.url}</span>
          </div>
          <span className="lfaa-browser-panel__stream-status" aria-live="polite">{liveStream ? "网页已就绪" : liveStreamConnecting ? "正在载入网页…" : "正在重新连接网页…"}</span>
        </header>
        <div className="lfaa-browser-panel__live-view" ref={liveViewRef} onPointerDown={onViewportPointerDown} onPointerMove={onViewportPointerMove} onPointerUp={onViewportPointerUp} onPointerCancel={onViewportPointerCancel} onWheel={onViewportWheel}>
          <canvas ref={canvasRef} className="lfaa-browser-panel__live-canvas" aria-label={`${snapshot.title || snapshot.url} 的实时网页画面`} />
          <textarea ref={keyboardCaptureRef} className="lfaa-browser-panel__keyboard-capture" aria-label="网页键盘输入" autoCapitalize="off" autoCorrect="off" spellCheck={false} onInput={onViewportInput} onKeyDown={onViewportKeyDown} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={event => { composingRef.current = false; const target = event.currentTarget; const text = target.value; target.value = ""; appendUserText(text); }} />
          {!hasRenderedFrame ? <span className="lfaa-browser-panel__stream-overlay" role="status">{liveStreamConnecting ? "正在连接内嵌浏览器…" : "网页画面正在载入…"}</span> : null}
        </div>
      </div> : <div className="lfaa-browser-panel__empty" role={providerLoading ? "status" : undefined}>
        <div className="lfaa-browser-panel__empty-card">
          <span className="lfaa-browser-panel__status-label">LFAA 浏览器</span>
          <p>{emptyText}</p>
        </div>
      </div>}
    </div>
  </section>;
}

export function BrowserPanel(props: BrowserPanelProps) {
  const managedBrowserPreferred = props.preferredProviderId === "lfaa-managed-edge" || props.preferredProviderId === "lfaa-managed-chrome";
  if (typeof window !== "undefined" && window.lfaaDesktop?.nativeBrowser && !managedBrowserPreferred) {
    return <NativeBrowserPanel {...props} />;
  }
  return <BrowserUsePanel {...props} />;
}
