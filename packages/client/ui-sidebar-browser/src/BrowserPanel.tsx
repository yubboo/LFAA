/**
 * 功能：在 AI Work 右 Dock 内以独立标签预览并操作每个已接入的浏览器。
 * 作用：通过已认证 Client API 与本机 Browser Owner 共享当前 AI Session；接入偏好归 Settings Owner。
 * 关联文件：packages/client/connection/src/api.ts、packages/browser-use/browser-use、packages/client/ui-workspace。
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { actOnBrowser, claimBrowserTab, closeBrowserProviderSessions, closeBrowserSession, connectTabbitBrowser, getErrorMessage, loadBrowserProviders, loadBrowserRevision, loadBrowserSession, loadBrowserTabs, navigateBrowser, resizeBrowserViewport, saveSettings, type BrowserProviderId, type BrowserProviderSummary, type BrowserSessionSnapshot, type BrowserTabSummary, type UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./browser-panel.css";

type BrowserPanelProps = { sessionId: string | null; settings: UserSettings };
type BrowserView = "preview" | "text" | "elements" | "json";
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

function normalizeAddress(value: string): string {
  const candidate = value.trim();
  if (!candidate) throw new Error("请输入 HTTP 或 HTTPS 地址。");
  const address = /^[a-z][a-z\d+.-]*:/iu.test(candidate) ? candidate : `https://${candidate}`;
  const parsed = new URL(address);
  if (!new Set(["http:", "https:"]).has(parsed.protocol) || parsed.username || parsed.password) throw new Error("浏览器只支持不含账号密码的 HTTP(S) 地址。");
  return parsed.toString();
}

function shortProviderName(provider: BrowserProviderSummary): string {
  if (provider.id === "lfaa-managed-edge") return "LFAA Edge";
  if (provider.id === "lfaa-managed-chrome") return "LFAA Chrome";
  return "Tabbit";
}

function originOnly(value: string): string {
  try { return new URL(value).origin; } catch { return value; }
}

export function BrowserPanel({ sessionId, settings }: BrowserPanelProps) {
  const [providers, setProviders] = useState<BrowserProviderSummary[]>([]);
  const [browserSettings, setBrowserSettings] = useState<UserSettings["browserUse"]>(settings.browserUse);
  const computerControlEnabled = settings.computerControl.enabled;
  const [tabbitTabs, setTabbitTabs] = useState<BrowserTabSummary[]>([]);
  const [tabbitTabsRequested, setTabbitTabsRequested] = useState(false);
  const [providerId, setProviderId] = useState<BrowserProviderId | "">("");
  const [snapshot, setSnapshot] = useState<BrowserSessionSnapshot | null>(null);
  const snapshotRef = useRef<BrowserSessionSnapshot | null>(null);
  const [address, setAddress] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [view, setView] = useState<BrowserView>("preview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewportSyncing, setViewportSyncing] = useState(false);
  const [providerLoading, setProviderLoading] = useState(true);
  const actionInFlight = useRef(false);
  const actionEpochRef = useRef(0);
  const actionTailRef = useRef<Promise<void>>(Promise.resolve());
  const queuedActionCountRef = useRef(0);
  const snapshotRequestInFlight = useRef(false);
  const viewportSyncInFlight = useRef(false);
  const lastViewportAttempt = useRef<string | null>(null);
  const previewViewportRef = useRef<BrowserViewport | null>(null);
  const [previewViewport, setPreviewViewport] = useState<BrowserViewport | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
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
  const providerConnected = Boolean(providerId && browserSettings?.enabledProviderIds.includes(providerId));

  useEffect(() => setBrowserSettings(settings.browserUse), [settings.browserUse]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  useEffect(() => {
    const content = contentRef.current;
    if (!providerConnected || !content || typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: BrowserViewport | null = null;
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect;
      if (!bounds || bounds.width < 1 || bounds.height < 1) return;
      const next = {
        width: Math.min(1280, Math.max(320, Math.round(bounds.width))),
        height: Math.min(1600, Math.max(400, Math.round(bounds.height)))
      };
      const current = pending ?? previewViewportRef.current;
      if (current && Math.abs(current.width - next.width) < 8 && Math.abs(current.height - next.height) < 8) return;
      pending = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!pending) return;
        previewViewportRef.current = pending;
        setPreviewViewport(pending);
        pending = null;
      }, 220);
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [providerConnected, providerId, sessionId]);

  const refreshSnapshot = useCallback(async (selectedProvider: BrowserProviderId, sourceSession: string, signal?: AbortSignal) => {
    if (snapshotRequestInFlight.current) return null;
    snapshotRequestInFlight.current = true;
    try {
      const result = await loadBrowserSession(sourceSession, selectedProvider, signal);
      if (result.session) {
        setSnapshot(current => !current || result.session!.revision >= current.revision ? result.session : current);
        if (result.session.revision >= (snapshotRef.current?.revision ?? -1)) setAddress(result.session.url);
        if (result.session.screenshot) needsVisualRefreshRef.current = false;
      } else setSnapshot(null);
      return result.session;
    } finally {
      snapshotRequestInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!providers.length) return;
    setProviderId(current => {
      if (current && settings.browserUse.enabledProviderIds.includes(current)) return current;
      return providers.find(provider => settings.browserUse.enabledProviderIds.includes(provider.id))?.id ?? current ?? providers[0]?.id ?? "";
    });
  }, [providers, settings.browserUse.enabledProviderIds]);

  useEffect(() => {
    const controller = new AbortController();
    setProviderLoading(true);
    void loadBrowserProviders(controller.signal).then(browserResult => {
      if (controller.signal.aborted) return;
      setProviders(browserResult.providers);
      setProviderId(current => current && browserResult.providers.some(item => item.id === current)
        ? current
        : browserResult.providers.find(item => settings.browserUse.enabledProviderIds.includes(item.id))?.id
          ?? browserResult.providers[0]?.id ?? "");
      setError("");
    }).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    }).finally(() => { if (!controller.signal.aborted) setProviderLoading(false); });
    return () => controller.abort();
  }, [settings.browserUse.enabledProviderIds]);

  useEffect(() => {
    setSnapshot(null);
    setAddress("");
    if (!sessionId || !providerId || !providerConnected) return;
    const controller = new AbortController();
    void refreshSnapshot(providerId, sessionId, controller.signal).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    });
    return () => controller.abort();
  }, [providerConnected, providerId, refreshSnapshot, sessionId]);

  useEffect(() => {
    if (!sessionId || !providerId || providerId === "tabbit-personal" || !providerConnected || !snapshot || !previewViewport) return;
    const { width, height } = previewViewport;
    const requestKey = `${sessionId}:${providerId}:${width}x${height}`;
    if (lastViewportAttempt.current === requestKey) return;
    if (snapshot.screenshot?.width === width && snapshot.screenshot.height === height) {
      lastViewportAttempt.current = requestKey;
      return;
    }
    if (loading || actionInFlight.current || snapshotRequestInFlight.current || viewportSyncInFlight.current) return;

    lastViewportAttempt.current = requestKey;
    viewportSyncInFlight.current = true;
    setViewportSyncing(true);
    setLoading(true);
    void resizeBrowserViewport(sessionId, providerId, width, height).then(result => {
      const resized = result.session;
      if (resized) setSnapshot(current => !current || resized.revision >= current.revision ? resized : current);
    }).catch(reason => {
      setError(getErrorMessage(reason));
    }).finally(() => {
      viewportSyncInFlight.current = false;
      setViewportSyncing(false);
      setLoading(false);
    });
  }, [loading, previewViewport, providerConnected, providerId, sessionId, snapshot, viewportSyncing]);

  useEffect(() => {
    if (!sessionId || !providerId || !providerConnected) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let activeRequest: AbortController | null = null;
    const isPageVisible = () => document.visibilityState !== "hidden";
    const poll = async () => {
      if (cancelled || !isPageVisible() || activeRequest) return;
      try {
        if (!actionInFlight.current && !viewportSyncInFlight.current) {
          const request = new AbortController();
          activeRequest = request;
          const response = await loadBrowserRevision(sessionId, providerId, request.signal);
          if (!cancelled && response.session && (!snapshot || response.session.revision !== snapshot.revision)) {
            await refreshSnapshot(providerId, sessionId, request.signal);
          } else if (!cancelled && !response.session) {
            setSnapshot(null);
          }
        }
      } catch (reason) {
        if (!cancelled && !activeRequest?.signal.aborted) setError(getErrorMessage(reason));
      } finally {
        activeRequest = null;
        if (!cancelled && isPageVisible()) timer = setTimeout(() => { void poll(); }, 1800);
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
    timer = setTimeout(() => { void poll(); }, 1800);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      activeRequest?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [providerConnected, providerId, refreshSnapshot, sessionId, snapshot]);

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
          setAddress(result.session.url);
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
            if (needsVisualRefreshRef.current && sessionId && providerId && providerConnected) {
              visualRefreshTimerRef.current = setTimeout(() => {
                visualRefreshTimerRef.current = null;
                if (epoch !== actionEpochRef.current || actionInFlight.current) return;
                void refreshSnapshot(providerId, sessionId).catch(reason => {
                  if (epoch === actionEpochRef.current) setError(getErrorMessage(reason));
                });
              }, 180);
            }
          }
        }
      }
    });
    actionTailRef.current = task.then(() => undefined);
    return task;
  }, [providerConnected, providerId, refreshSnapshot, sessionId]);

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

  const connectProvider = useCallback(async (provider: BrowserProviderSummary) => {
    if (!browserSettings || !sessionId || loading) return;
    setLoading(true);
    setError("");
    try {
      let discoveredTabs: BrowserTabSummary[] | null = null;
      if (provider.id === "tabbit-personal") {
        const result = await connectTabbitBrowser(sessionId);
        discoveredTabs = result.tabs;
        setBrowserSettings(result.settings.browserUse);
      }
      if (provider.id !== "tabbit-personal") {
        const enabledProviderIds = [...new Set([...browserSettings.enabledProviderIds, provider.id])];
        const result = await saveSettings("browserUse", { ...browserSettings, enabledProviderIds });
        setBrowserSettings(result.settings.browserUse);
      }
      if (discoveredTabs) {
        setTabbitTabs(discoveredTabs);
        setTabbitTabsRequested(true);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [browserSettings, loading, sessionId]);

  const disconnectProvider = useCallback(async (provider: BrowserProviderSummary) => {
    if (!browserSettings || loading) return;
    setLoading(true);
    setError("");
    try {
      await closeBrowserProviderSessions(provider.id);
      const enabledProviderIds = browserSettings.enabledProviderIds.filter(id => id !== provider.id);
      const result = await saveSettings("browserUse", { ...browserSettings, enabledProviderIds });
      setBrowserSettings(result.settings.browserUse);
      setSnapshot(null);
      setAddress("");
      if (provider.id === "tabbit-personal") {
        setTabbitTabs([]);
        setTabbitTabsRequested(false);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [browserSettings, loading]);

  const readTabbitTabs = useCallback(async () => {
    if (!sessionId || loading || !computerControlEnabled) return;
    setLoading(true);
    setError("");
    try {
      const result = await loadBrowserTabs(sessionId, "tabbit-personal");
      setTabbitTabs(result.tabs);
      setTabbitTabsRequested(true);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [computerControlEnabled, loading, sessionId]);

  const onNavigate = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || !providerId || !providerConnected) return;
    try {
      const url = normalizeAddress(address);
      setAddress(url);
      void runAction(() => navigateBrowser(sessionId, providerId, url));
    } catch (reason) { setError(getErrorMessage(reason)); }
  }, [address, providerConnected, providerId, runAction, sessionId]);

  const onPreviewPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!sessionId || !providerId || !snapshot?.screenshot || !imageRef.current || !event.isPrimary || event.button !== 0) return;
    const point = pagePoint(imageRef.current, snapshot.screenshot.width, snapshot.screenshot.height, event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    keyboardCaptureRef.current?.focus({ preventScroll: true });
    pointerGestureRef.current = { pointerId: event.pointerId, pointerType: event.pointerType, start: point, startClientX: event.clientX, startClientY: event.clientY, points: [], lastPage: point, lastClientX: event.clientX, lastClientY: event.clientY, lastAt: event.timeStamp, mode: "pending" };
  }, [providerId, sessionId, snapshot]);

  const onPreviewPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
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

  const onPreviewPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
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
      if (gesture.points.length) void runAction(() => actOnBrowser(sessionId, providerId, { action: "dragAt", x: gesture.start.x, y: gesture.start.y, points: gesture.points }));
      else void runAction(() => actOnBrowser(sessionId, providerId, { action: "clickAt", x: gesture.start.x, y: gesture.start.y }));
    } else if (gesture.mode === "scroll") {
      const amount = Math.max(-12_000, Math.min(12_000, Math.round(gesture.startClientY - event.clientY)));
      wheelDeltaRef.current = Math.max(-12_000, Math.min(12_000, wheelDeltaRef.current + amount));
      if (!wheelFlushTimerRef.current) wheelFlushTimerRef.current = setTimeout(() => wheelFlushRef.current?.(), 0);
    } else {
      void runAction(() => actOnBrowser(sessionId, providerId, { action: "clickAt", x: gesture.start.x, y: gesture.start.y }));
    }
  }, [providerId, runAction, sessionId, snapshot]);

  const onPreviewPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
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
    void runAction(() => actOnBrowser(sessionId, providerId, { action: "typeText", text, includeScreenshot: false }));
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

  const onPreviewInput = useCallback((event: FormEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (composingRef.current || nativeEvent.isComposing) return;
    const target = event.currentTarget;
    const text = target.value;
    target.value = "";
    appendUserText(text);
  }, [appendUserText]);

  const onPreviewKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
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
      if (sessionId && providerId) void runAction(() => actOnBrowser(sessionId, providerId, { action: "pressKey", key: forwarded, includeScreenshot: false }));
    } else if (!altGraph && (modifier || event.altKey)) {
      event.preventDefault();
      event.stopPropagation();
      setError("这个快捷键暂不转发到网页。");
    }
  }, [providerId, runAction, sessionId]);

  const flushWheel = useCallback(() => {
    wheelFlushTimerRef.current = null;
    if (!sessionId || !providerId || Math.abs(wheelDeltaRef.current) < 1) return;
    if (queuedActionCountRef.current >= 250) {
      wheelFlushTimerRef.current = setTimeout(flushWheel, 160);
      return;
    }
    const delta = wheelDeltaRef.current;
    const amount = Math.min(600, Math.max(1, Math.round(Math.abs(delta))));
    wheelDeltaRef.current -= Math.sign(delta) * amount;
    void runAction(() => actOnBrowser(sessionId, providerId, { action: "scroll", direction: delta > 0 ? "down" : "up", amount, includeScreenshot: false }));
    if (Math.abs(wheelDeltaRef.current) >= 1) wheelFlushTimerRef.current = setTimeout(flushWheel, 160);
  }, [providerId, runAction, sessionId]);

  useEffect(() => { wheelFlushRef.current = flushWheel; }, [flushWheel]);

  const onPreviewWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!sessionId || !providerId || !snapshot?.screenshot) return;
    event.preventDefault();
    event.stopPropagation();
    const factor = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? Math.max(400, contentRef.current?.clientHeight ?? 800) : 1;
    wheelDeltaRef.current = Math.max(-12000, Math.min(12000, wheelDeltaRef.current + event.deltaY * factor));
    if (!wheelFlushTimerRef.current) wheelFlushTimerRef.current = setTimeout(flushWheel, 160);
  }, [flushWheel, providerId, sessionId, snapshot]);

  const currentProvider = providers.find(item => item.id === providerId);
  const snapshotControls = snapshot && Array.isArray(snapshot.controls) ? snapshot.controls : [];
  const snapshotTabs = snapshot && Array.isArray(snapshot.tabs) ? snapshot.tabs : [];
  const shownAddress = address && !browserSettings?.showFullUrl && !addressFocused ? originOnly(address) : address;
  return <section className="lfaa-browser-panel" aria-label="浏览器工作区">
    <header className="lfaa-browser-panel__header">
      <div><strong>浏览器</strong><span>{browserSettings?.enabled ? "你与 Agent 操作同一浏览器会话" : "Agent 控制关闭 · 你仍可直接操作"}</span></div>
      {browserSettings ? <button type="button" className="lfaa-browser-panel__settings-link" onClick={() => { window.location.assign("/settings?section=browser"); }}>设置</button> : null}
    </header>
    <nav className="lfaa-browser-panel__provider-tabs" aria-label="浏览器应用">
      {providers.map(provider => {
        const linked = browserSettings?.enabledProviderIds.includes(provider.id) === true;
        return <button type="button" key={provider.id} className={provider.id === providerId ? "is-active" : ""} aria-pressed={provider.id === providerId} disabled={!provider.available || providerLoading || loading} title={provider.available ? provider.name : provider.reason} onClick={() => { setProviderId(provider.id); setSnapshot(null); setAddress(""); setTabbitTabs([]); setTabbitTabsRequested(false); setError(""); }}>
          <strong>{shortProviderName(provider)}</strong><span>{!provider.available ? "不可用" : linked ? "已接入" : "接入"}</span>
        </button>;
      })}
      {!providers.length && !providerLoading ? <span className="lfaa-browser-panel__provider-empty">当前 Host 未登记本机浏览器</span> : null}
    </nav>
    {!sessionId ? <div className="lfaa-browser-panel__empty"><WorkbenchIcon name="browser" size={26} /><strong>浏览器将与当前 AI 会话共享</strong><p>先打开或发起一个 AI Work 会话，Agent 和右侧浏览器工作区才能操作同一页面。</p></div> : null}
    {sessionId && providerLoading ? <div className="lfaa-browser-panel__empty" role="status"><span>正在读取浏览器接入状态…</span></div> : null}
    {sessionId && !providerLoading && providers.length === 0 ? <div className="lfaa-browser-panel__empty"><WorkbenchIcon name="browser" size={26} /><strong>当前宿主没有本机浏览器</strong><p>隔离浏览器只在 LFAA 本机 Web 或桌面 Host 中运行。远程 Web Host 不会访问这台设备的浏览器。</p></div> : null}
    {sessionId && currentProvider && !providerConnected ? <div className="lfaa-browser-panel__connect-card">
      <WorkbenchIcon name="browser" size={28} />
      <strong>接入 {currentProvider.name}</strong>
      <p>{currentProvider.isolation === "new-profile" ? "接入后会为当前 AI 会话创建隔离页面，不读取系统浏览器中的登录状态。" : "点击后会启动 Tabbit LocalAgent 并读取可连接标签的标题与净化后地址；只有你再选择某个标签后，才会获取页面正文和截图。连接个人会话需要启用电脑操控；Agent 还要求本轮目标明确指定 Tabbit。"}</p>
      <button type="button" disabled={!currentProvider.available || loading || !browserSettings || currentProvider.id === "tabbit-personal" && !computerControlEnabled} onClick={() => void connectProvider(currentProvider)}>{loading ? "正在连接…" : currentProvider.id === "tabbit-personal" ? computerControlEnabled ? "连接并查看标签" : "先启用电脑操控" : "接入浏览器"}</button>
      {error ? <div className="lfaa-browser-panel__error" role="alert">{error}</div> : null}
    </div> : null}
    {sessionId && providerConnected && currentProvider ? <>
      <div className="lfaa-browser-panel__provider-actions"><span>{currentProvider.isolation === "new-profile" ? "LFAA 隔离会话" : "Tabbit 个人会话"}</span><button type="button" disabled={loading} onClick={() => void disconnectProvider(currentProvider)}>断开</button></div>
      {providerId === "tabbit-personal" && !snapshot ? <div className="lfaa-browser-panel__tab-list">
        <p>只有点击下方按钮才会读取 Tabbit 的标签标题和地址；选中具体标签后才会读取页面内容。个人标签仍受设置中心电脑操控与当前权限模式管理。</p>
        {tabbitTabsRequested ? tabbitTabs.length ? tabbitTabs.map(tab => <div className="lfaa-browser-panel__tab" key={tab.tabId}><div><strong>{tab.title || "无标题标签"}</strong><span title={tab.url}>{tab.url || "地址不可用"}</span><small>{tab.active ? "当前标签" : tab.state === "available" ? "可连接" : tab.state === "busy" ? "由其他任务使用" : tab.state}</small></div><button type="button" disabled={tab.state !== "available" || loading} onClick={() => void runAction(() => claimBrowserTab(sessionId, "tabbit-personal", tab.tabId))}>选择此标签</button></div>) : <div className="lfaa-browser-panel__empty"><span>没有可连接的 Tabbit 标签。你也可以使用地址栏打开一个新网页。</span></div> : null}
        <button type="button" className="lfaa-browser-panel__secondary-action" disabled={loading || !computerControlEnabled} onClick={() => void readTabbitTabs()}>{!computerControlEnabled ? "先启用电脑操控" : tabbitTabsRequested ? "刷新标签列表" : "读取可连接的标签"}</button>
      </div> : null}
      <form className="lfaa-browser-panel__address" onSubmit={onNavigate}>
        <div className="lfaa-browser-panel__nav">
          {(["back", "forward", "reload"] as const).map(action => <button key={action} type="button" aria-label={action === "back" ? "后退" : action === "forward" ? "前进" : "刷新"} title={action === "back" ? "后退" : action === "forward" ? "前进" : "刷新"} disabled={loading || !snapshot || !providerId} onClick={() => { if (providerId) void runAction(() => actOnBrowser(sessionId, providerId, { action })); }}>{action === "reload" ? <WorkbenchIcon name="refresh" size={15} /> : action === "back" ? "‹" : "›"}</button>)}
        </div>
        <input aria-label="浏览器地址" type="text" inputMode="url" autoComplete="url" spellCheck={false} value={shownAddress} onFocus={() => setAddressFocused(true)} onBlur={() => setAddressFocused(false)} onChange={event => setAddress(event.currentTarget.value)} placeholder="输入 HTTP(S) 网址" disabled={loading} />
        <button type="submit" aria-label="打开网页" title="打开网页" disabled={loading}>打开</button>
      </form>
      {providerId === "tabbit-personal" ? <p className="lfaa-browser-panel__notice">网页操作会作用于所选的真实 Tabbit 标签。不要在本轮未明确要求时切换或读取个人浏览器。</p> : null}
      {error ? <div className="lfaa-browser-panel__error" role="alert">{error}</div> : null}
      <nav className="lfaa-browser-panel__views" aria-label="浏览器检查视图">{(["preview", "text", "elements", "json"] as const).map(item => <button type="button" key={item} aria-pressed={view === item} className={view === item ? "is-active" : ""} onClick={() => setView(item)}>{item === "preview" ? "网页" : item === "text" ? "文本" : item === "elements" ? "元素" : "JSON"}</button>)}<span aria-live="polite">{viewportSyncing ? "适配网页大小…" : loading ? "处理中…" : snapshot ? `修订 ${snapshot.revision}` : "未打开网页"}</span></nav>
      <div ref={contentRef} className="lfaa-browser-panel__content">
        {view === "preview" ? snapshot?.screenshot ? <div className="lfaa-browser-panel__preview-wrap" onPointerDown={onPreviewPointerDown} onPointerMove={onPreviewPointerMove} onPointerUp={onPreviewPointerUp} onPointerCancel={onPreviewPointerCancel} onWheel={onPreviewWheel}>
          <img ref={imageRef} className="lfaa-browser-panel__preview" src={`data:${snapshot.screenshot.mimeType};base64,${snapshot.screenshot.dataBase64}`} alt={`${snapshot.title || snapshot.url} 页面；点击可操作，滚轮可滚动`} />
          <textarea ref={keyboardCaptureRef} className="lfaa-browser-panel__input-capture" aria-label="网页交互区；点击后可输入，按住并拖动可操作页面" autoCapitalize="off" autoCorrect="off" spellCheck={false} onInput={onPreviewInput} onKeyDown={onPreviewKeyDown} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} />
          <span className="lfaa-browser-panel__interaction-hint" aria-hidden="true">点击输入 · 按住拖动 · 滚轮或触屏滚动</span>
          {loading ? <span className="lfaa-browser-panel__busy" role="status">同步页面…</span> : null}
        </div> : <div className="lfaa-browser-panel__empty"><WorkbenchIcon name="browser" size={24} /><span>{snapshot ? "页面截图暂不可用，可切换到文本或元素视图。" : providerId === "tabbit-personal" ? "连接并选择一个 Tabbit 标签，或在地址栏打开新页面。" : "输入网址后，在此打开并操作网页。"}</span></div> : null}
        {view === "text" ? <pre className="lfaa-browser-panel__data">{snapshot?.pageText || "页面正文为空或尚未打开。"}</pre> : null}
        {view === "elements" ? <div className="lfaa-browser-panel__elements">{snapshotControls.length ? snapshotControls.map((control, index) => <div key={`${control.role}:${control.name}:${index}`}><code>{control.role}</code><span>{control.name}</span>{control.disabled ? <small>禁用</small> : null}</div>) : <p>没有发现可访问的交互元素。</p>}</div> : null}
        {view === "json" ? <pre className="lfaa-browser-panel__data">{snapshot ? JSON.stringify({ url: snapshot.url, title: snapshot.title, revision: snapshot.revision, tabs: snapshotTabs, controls: snapshotControls }, null, 2) : "尚无页面数据。"}</pre> : null}
      </div>
      {snapshot ? <footer className="lfaa-browser-panel__footer"><span title={browserSettings?.showFullUrl ? snapshot.url : originOnly(snapshot.url)}>{browserSettings?.showFullUrl ? snapshot.url : originOnly(snapshot.url)}</span><button type="button" disabled={loading} onClick={() => void closeBrowserSession(sessionId, snapshot.providerId).then(() => { setSnapshot(null); setAddress(""); }).catch(reason => setError(getErrorMessage(reason)))}>关闭会话</button></footer> : null}
    </> : null}
  </section>;
}
