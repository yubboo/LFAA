/**
 * 功能：在工作区当前浏览器标签的内容区域显示 Electron 原生 Chromium 页面。
 * 作用：地址、标签与导航操作由 ApplicationWorkspace 统一提供，网页通过既有 nativeBrowser Owner 展示。
 * 关联文件：apps/desktop-electron/src/native-browser-workspace.mjs、packages/browser-use/browser-use。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage, setNativeBrowserActiveTarget, type NativeBrowserState, type UserSettings } from "lfaa-client-connection/src/api.js";
import "./native-browser-panel.css";
import { resolveBrowserAddress } from "./browser-address.js";

type Props = {
  sessionId: string | null;
  settings: UserSettings;
  hidden?: boolean;
  navigationRequest?: { id: string; url: string } | null;
  onNavigationRequestHandled?: (requestId: string) => void;
  actionRequest?: { id: string; action: "back" | "forward" | "reload" } | null;
  onActionRequestHandled?: (requestId: string) => void;
  onOpenTabsChange?: (tabs: Array<{ id: string; title: string; url: string; active: boolean }>) => void;
};
type NativeBrowserApi = NonNullable<NonNullable<Window["lfaaDesktop"]>["nativeBrowser"]>;

function nativeApi(): NativeBrowserApi | null {
  return typeof window === "undefined" ? null : window.lfaaDesktop?.nativeBrowser ?? null;
}

function isNativeBrowserState(value: unknown): value is NativeBrowserState {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Array.isArray((value as { tabs?: unknown }).tabs)
    && ((value as { activeTabId?: unknown }).activeTabId === null || typeof (value as { activeTabId?: unknown }).activeTabId === "string")
    && typeof (value as { visible?: unknown }).visible === "boolean";
}

export function NativeBrowserPanel({ sessionId, settings, hidden = false, navigationRequest, onNavigationRequestHandled, actionRequest, onActionRequestHandled, onOpenTabsChange }: Props) {
  const api = useMemo(nativeApi, []);
  const [state, setState] = useState<NativeBrowserState>({ tabs: [], activeTabId: null, visible: false });
  const [error, setError] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boundTargetRef = useRef("");
  const handledNavigationRequestRef = useRef("");
  const handledActionRequestRef = useRef("");
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId) ?? null;

  useEffect(() => {
    onOpenTabsChange?.(state.tabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url, active: tab.active })));
  }, [onOpenTabsChange, state.tabs]);

  useEffect(() => {
    const targetId = activeTab?.targetId ?? "";
    if (!sessionId || !targetId) {
      boundTargetRef.current = "";
      return;
    }
    const bindingKey = `${sessionId}:${targetId}`;
    if (boundTargetRef.current === bindingKey) return;
    const controller = new AbortController();
    boundTargetRef.current = bindingKey;
    void setNativeBrowserActiveTarget(sessionId, targetId, controller.signal).catch(reason => {
      if (!controller.signal.aborted) {
        if (boundTargetRef.current === bindingKey) boundTargetRef.current = "";
        setError(getErrorMessage(reason));
      }
    });
    return () => controller.abort();
  }, [activeTab?.targetId, sessionId]);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    if (!api) return null;
    setError("");
    try {
      const result = await operation();
      if (isNativeBrowserState(result)) setState(result);
      return result;
    } catch (reason) {
      setError(getErrorMessage(reason));
      return null;
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;
    let live = true;
    const unsubscribe = api.onState(next => { if (live) setState(next); });
    void api.getState().then(current => {
      if (!live) return;
      setState(current);
      if (!current.tabs.length) return api.ensureTab();
      return current;
    }).then(current => { if (live && current) setState(current); }).catch(reason => { if (live) setError(getErrorMessage(reason)); });
    return () => { live = false; unsubscribe(); };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    void api.setPreferences(settings.browserUse).catch(reason => {
      setError(getErrorMessage(reason));
    });
  }, [api, settings.browserUse]);

  useEffect(() => {
    if (!api) return;
    void api.setVisible(!hidden).catch(reason => setError(getErrorMessage(reason)));
    return () => { void api.setVisible(false).catch(() => undefined); };
  }, [api, hidden]);

  useLayoutEffect(() => {
    if (!api) return;
    let frame = 0;
    let live = true;
    let sending = false;
    let lastAppliedKey = "";
    let sendingKey = "";
    let pending: { bounds: { x: number; y: number; width: number; height: number }; key: string } | null = null;
    const sendPending = () => {
      if (!live || hidden || sending || !pending) return;
      const next = pending;
      pending = null;
      if (next.key === lastAppliedKey) return;
      sending = true;
      sendingKey = next.key;
      void api.setBounds(next.bounds).then(() => {
        if (live) lastAppliedKey = next.key;
      }).catch(() => undefined).finally(() => {
        sending = false;
        sendingKey = "";
        if (live && pending) sendPending();
      });
    };
    const readBounds = () => {
      const node = viewportRef.current;
      if (!node || hidden) return;
      const rect = node.getBoundingClientRect();
      const bounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      const key = `${Math.round(bounds.x)}:${Math.round(bounds.y)}:${Math.round(bounds.width)}:${Math.round(bounds.height)}`;
      if (key === lastAppliedKey || key === sendingKey || key === pending?.key) return;
      pending = { bounds, key };
      sendPending();
    };
    const syncBounds = () => {
      if (hidden || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        readBounds();
      });
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncBounds);
    if (viewportRef.current) observer?.observe(viewportRef.current);
    const onViewportChange = () => syncBounds();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    syncBounds();
    return () => {
      live = false;
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      pending = null;
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
    };
  }, [api, hidden]);

  useEffect(() => {
    if (!navigationRequest || !api || !activeTab || handledNavigationRequestRef.current === navigationRequest.id) return;
    handledNavigationRequestRef.current = navigationRequest.id;
    try {
      const target = resolveBrowserAddress(navigationRequest.url, settings.browserUse.searchEngine);
      void run(() => api.navigate(activeTab.id, target)).finally(() => onNavigationRequestHandled?.(navigationRequest.id));
    } catch (reason) {
      setError(getErrorMessage(reason));
      onNavigationRequestHandled?.(navigationRequest.id);
    }
  }, [activeTab?.id, api, navigationRequest?.id, navigationRequest?.url, onNavigationRequestHandled, run, settings.browserUse.searchEngine]);

  useEffect(() => {
    if (!actionRequest || navigationRequest || !api || !activeTab || handledActionRequestRef.current === actionRequest.id) return;
    handledActionRequestRef.current = actionRequest.id;
    const operation = actionRequest.action === "back" ? () => api.back(activeTab.id)
      : actionRequest.action === "forward" ? () => api.forward(activeTab.id)
        : () => api.reload(activeTab.id);
    void run(operation).finally(() => onActionRequestHandled?.(actionRequest.id));
  }, [actionRequest?.action, actionRequest?.id, activeTab?.id, api, navigationRequest, onActionRequestHandled, run]);

  if (!api) return <section className="lfaa-native-browser" aria-label="网页内容"><div className="lfaa-native-browser__empty">当前设备不支持原生网页显示。</div></section>;
  return <section className="lfaa-native-browser" aria-label="网页内容" hidden={hidden}>
    <div ref={viewportRef} className="lfaa-native-browser__native-page" aria-label="网页内容" />
    {error || activeTab?.error ? <div className="lfaa-native-browser__error" role="alert">{error || activeTab?.error}</div> : null}
  </section>;
}
