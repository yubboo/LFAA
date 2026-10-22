/**
 * 功能：在桌面工作区显示 Electron 原生 Chromium 页面，并把标签目标同步给 Browser Owner。
 * 作用：人工操作直接进入网页；Agent 仅在设置中心接入后连接当前活动标签。
 * 关联文件：apps/desktop-electron/src/native-browser-workspace.mjs、packages/browser-use/browser-use。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getErrorMessage, setNativeBrowserActiveTarget, type NativeBrowserInspection, type NativeBrowserState, type NativeBrowserTab, type UserSettings } from "lfaa-client-connection/src/api.js";
import "./native-browser-panel.css";
import { resolveBrowserAddress } from "./browser-address.js";

type Props = {
  sessionId: string | null;
  settings: UserSettings;
  navigationRequest?: { id: string; url: string } | null;
  onNavigationRequestHandled?: (requestId: string) => void;
  actionRequest?: { id: string; action: "back" | "forward" | "reload" } | null;
  onActionRequestHandled?: (requestId: string) => void;
  onOpenTabsChange?: (tabs: Array<{ id: string; title: string; url: string; active: boolean }>) => void;
};
type PanelView = "page" | "text" | "elements" | "json";
type NativeBrowserApi = NonNullable<NonNullable<Window["lfaaDesktop"]>["nativeBrowser"]>;

function addressForDisplay(url: string, full: boolean): string {
  if (full || !url) return url;
  try { return new URL(url).origin; } catch { return url; }
}

function nativeApi(): NativeBrowserApi | null {
  return typeof window === "undefined" ? null : window.lfaaDesktop?.nativeBrowser ?? null;
}

function isNativeBrowserState(value: unknown): value is NativeBrowserState {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Array.isArray((value as { tabs?: unknown }).tabs)
    && ((value as { activeTabId?: unknown }).activeTabId === null || typeof (value as { activeTabId?: unknown }).activeTabId === "string")
    && typeof (value as { visible?: unknown }).visible === "boolean";
}

export function NativeBrowserPanel({ sessionId, settings, navigationRequest, onNavigationRequestHandled, actionRequest, onActionRequestHandled, onOpenTabsChange }: Props) {
  const api = useMemo(nativeApi, []);
  const [state, setState] = useState<NativeBrowserState>({ tabs: [], activeTabId: null, visible: false });
  const [address, setAddress] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [view, setView] = useState<PanelView>("page");
  const [inspection, setInspection] = useState<NativeBrowserInspection | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissedTabError, setDismissedTabError] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const findRef = useRef<HTMLInputElement | null>(null);
  const boundTargetRef = useRef("");
  const handledNavigationRequestRef = useRef("");
  const handledActionRequestRef = useRef("");
  const [inspectionRevision, setInspectionRevision] = useState(0);
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId) ?? null;
  const searchEngine = settings.browserUse.searchEngine;
  const visibleError = error || (activeTab?.error === dismissedTabError ? "" : activeTab?.error ?? "");
  const agentCanUseNativeBrowser = settings.browserUse.enabled && settings.browserUse.enabledProviderIds.includes("lfaa-native-browser");

  useEffect(() => { setDismissedTabError(""); }, [activeTab?.error, activeTab?.id]);

  useEffect(() => {
    onOpenTabsChange?.(state.tabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url, active: tab.active })));
  }, [onOpenTabsChange, state.tabs]);

  useEffect(() => {
    const targetId = activeTab?.targetId ?? "";
    if (!sessionId || !agentCanUseNativeBrowser || !targetId) {
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
  }, [activeTab?.targetId, agentCanUseNativeBrowser, sessionId]);

  const run = useCallback(async <T,>(operation: () => Promise<T>, options?: { keepBusy?: boolean }): Promise<T | null> => {
    if (!api) return null;
    setError("");
    if (!options?.keepBusy) setBusy(true);
    try {
      const result = await operation();
      if (isNativeBrowserState(result)) setState(result);
      return result;
    } catch (reason) {
      setError(getErrorMessage(reason));
      return null;
    } finally {
      if (!options?.keepBusy) setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;
    let live = true;
    const unsubscribe = api.onState(next => {
      if (!live) return;
      setState(next);
      const selected = next.tabs.find(tab => tab.id === next.activeTabId);
      if (selected) {
        setZoom(selected.zoomFactor);
        setAddress(current => addressFocused ? current : selected.url);
      }
    });
    void api.getState().then(current => {
      if (!live) return;
      setState(current);
      if (!current.tabs.length) return api.ensureTab();
      return current;
    }).then(current => { if (live && current) setState(current); }).catch(reason => { if (live) setError(getErrorMessage(reason)); });
    return () => {
      live = false;
      unsubscribe();
      void api.setVisible(false).catch(() => undefined);
    };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.onShortcut(shortcut => {
      if (shortcut === "find") { setFindOpen(true); requestAnimationFrame(() => findRef.current?.focus()); }
      if (shortcut === "address") { addressRef.current?.focus(); addressRef.current?.select(); }
    });
    return unsubscribe;
  }, [api]);

  useLayoutEffect(() => {
    if (!api) return;
    let frame = 0;
    let last = "";
    const syncBounds = () => {
      const node = viewportRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const bounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      const key = `${Math.round(bounds.x)}:${Math.round(bounds.y)}:${Math.round(bounds.width)}:${Math.round(bounds.height)}`;
      if (key === last) return;
      last = key;
      void api.setBounds(bounds).catch(() => undefined);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncBounds);
    if (viewportRef.current) observer?.observe(viewportRef.current);
    const onViewportChange = () => syncBounds();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    const watchPosition = () => {
      if (document.visibilityState === "hidden") {
        frame = window.setTimeout(watchPosition, 500);
        return;
      }
      syncBounds();
      frame = window.setTimeout(watchPosition, 160);
    };
    watchPosition();
    return () => {
      observer?.disconnect();
      window.clearTimeout(frame);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
    };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    void api.setVisible(view === "page").catch(reason => setError(getErrorMessage(reason)));
    return () => { void api.setVisible(false).catch(() => undefined); };
  }, [api, view]);

  useEffect(() => {
    if (!api || view === "page" || !activeTab || activeTab.loading) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.inspect(activeTab.id).then(result => { if (!cancelled) setInspection(result); }).catch(reason => { if (!cancelled) setError(getErrorMessage(reason)); });
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeTab?.id, activeTab?.loading, api, inspectionRevision, state.tabs, view]);

  const navigate = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    if (!api || !activeTab) return;
    try {
      const url = resolveBrowserAddress(address, searchEngine);
      setAddress(url);
      await run(() => api.navigate(activeTab.id, url));
    } catch (reason) { setError(getErrorMessage(reason)); }
  }, [activeTab, address, api, run, searchEngine]);

  useEffect(() => {
    if (!navigationRequest) return;
    setAddress(navigationRequest.url);
    if (!api || !activeTab || handledNavigationRequestRef.current === navigationRequest.id) return;
    handledNavigationRequestRef.current = navigationRequest.id;
    try {
      const target = resolveBrowserAddress(navigationRequest.url, searchEngine);
      void run(() => api.navigate(activeTab.id, target)).finally(() => onNavigationRequestHandled?.(navigationRequest.id));
    } catch (reason) {
      setError(getErrorMessage(reason));
      onNavigationRequestHandled?.(navigationRequest.id);
    }
  }, [activeTab?.id, api, navigationRequest?.id, navigationRequest?.url, onNavigationRequestHandled, run, searchEngine]);

  useEffect(() => {
    if (!actionRequest || navigationRequest || !api || !activeTab || handledActionRequestRef.current === actionRequest.id) return;
    handledActionRequestRef.current = actionRequest.id;
    const operation = actionRequest.action === "back" ? () => api.back(activeTab.id)
      : actionRequest.action === "forward" ? () => api.forward(activeTab.id)
        : () => api.reload(activeTab.id);
    void run(operation).finally(() => onActionRequestHandled?.(actionRequest.id));
  }, [actionRequest?.action, actionRequest?.id, activeTab?.id, api, navigationRequest, onActionRequestHandled, run]);

  const switchTab = useCallback(async (tab: NativeBrowserTab) => {
    await run(() => api!.selectTab(tab.id));
    setInspection(null);
  }, [api, run]);

  const changeZoom = useCallback(async (delta: number) => {
    if (!api || !activeTab) return;
    const next = Math.max(0.5, Math.min(2, Math.round((zoom + delta) * 10) / 10));
    const result = await run(() => api.setZoom(activeTab.id, next));
    if (result) setZoom(next);
  }, [activeTab, api, run, zoom]);

  const find = useCallback((forward: boolean) => {
    if (api && activeTab) void api.find(activeTab.id, findText, forward).catch(reason => setError(getErrorMessage(reason)));
  }, [activeTab, api, findText]);

  const onAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setAddress(activeTab?.url ?? ""); event.currentTarget.blur(); }
  };

  const visibleAddress = addressForDisplay(address, settings.browserUse.showFullUrl || addressFocused);
  const json = inspection ? JSON.stringify(inspection, null, 2) : "打开页面后可在这里查看页面信息。";

  if (!api) return null;
  return <section className="lfaa-native-browser" aria-label="原生浏览器工作区">
    <div className="lfaa-native-browser__tab-strip" role="tablist" aria-label="浏览器标签页">
      {state.tabs.map(tab => <div className={`lfaa-native-browser__tab${tab.active ? " is-active" : ""}`} key={tab.id} role="presentation">
        <button type="button" role="tab" aria-selected={tab.active} title={tab.title || tab.url || "新标签页"} onClick={() => void switchTab(tab)}>{tab.title || "新标签页"}</button>
        <button type="button" className="lfaa-native-browser__tab-close" aria-label={`关闭 ${tab.title || "标签页"}`} onClick={() => { void run(() => api.closeTab(tab.id)); }}>×</button>
      </div>)}
      <button type="button" className="lfaa-native-browser__new-tab" aria-label="新建标签页" title="新建标签页" onClick={() => void run(() => api.createTab())}>＋</button>
      <span className="lfaa-native-browser__strip-spacer" />
      <button type="button" className="lfaa-native-browser__settings" onClick={() => { window.location.assign("/settings?section=browser"); }}>设置</button>
    </div>
    <header className="lfaa-native-browser__toolbar">
      <div className="lfaa-native-browser__navigation">
        <button type="button" aria-label="后退" title="后退" disabled={!activeTab?.canGoBack} onClick={() => activeTab && void run(() => api.back(activeTab.id))}>‹</button>
        <button type="button" aria-label="前进" title="前进" disabled={!activeTab?.canGoForward} onClick={() => activeTab && void run(() => api.forward(activeTab.id))}>›</button>
        <button type="button" aria-label={activeTab?.loading ? "停止加载" : "刷新网页"} title={activeTab?.loading ? "停止" : "刷新"} onClick={() => activeTab && void run(() => activeTab.loading ? api.stop(activeTab.id) : api.reload(activeTab.id))}>{activeTab?.loading ? "×" : "↻"}</button>
      </div>
      <form className="lfaa-native-browser__address" onSubmit={event => void navigate(event)}>
        <span aria-hidden="true" className={activeTab?.url.startsWith("https:") ? "is-secure" : ""}>{activeTab?.url.startsWith("https:") ? "▣" : "◉"}</span>
        <input ref={addressRef} aria-label="网址或搜索内容" type="text" inputMode="url" autoComplete="url" spellCheck={false} value={visibleAddress} onFocus={() => setAddressFocused(true)} onBlur={() => { setAddressFocused(false); if (activeTab) setAddress(activeTab.url); }} onChange={event => setAddress(event.currentTarget.value)} onKeyDown={onAddressKeyDown} placeholder="搜索网页或输入网址" />
        <button type="submit" title="打开网址或搜索">打开</button>
      </form>
      <button type="button" className="lfaa-native-browser__tool" aria-label="查找网页文字" title="查找 Ctrl+F" onClick={() => { setFindOpen(true); requestAnimationFrame(() => findRef.current?.focus()); }}>⌕</button>
      <button type="button" className="lfaa-native-browser__tool" aria-label="复制网址" title="复制网址" disabled={!activeTab?.url} onClick={() => activeTab && void navigator.clipboard?.writeText(activeTab.url).catch(() => setError("无法访问剪贴板。"))}>⧉</button>
      <button type="button" className="lfaa-native-browser__tool" aria-label="打印网页" title="打印 Ctrl+P" disabled={!activeTab?.url} onClick={() => activeTab && void run(() => api.print(activeTab.id))}>▤</button>
    </header>
    {findOpen ? <form className="lfaa-native-browser__find" onSubmit={event => { event.preventDefault(); find(true); }}>
      <input ref={findRef} aria-label="查找网页文字" value={findText} onChange={event => setFindText(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Escape") { setFindOpen(false); setFindText(""); if (activeTab) void api.find(activeTab.id, "", true); } }} placeholder="在网页中查找" />
      <button type="button" aria-label="上一个匹配项" onClick={() => find(false)}>↑</button><button type="submit" aria-label="下一个匹配项">↓</button>
      <button type="button" aria-label="关闭查找" onClick={() => { setFindOpen(false); setFindText(""); if (activeTab) void api.find(activeTab.id, "", true); }}>×</button>
    </form> : null}
    <nav className="lfaa-native-browser__views" aria-label="浏览器视图">
      {([ ["page", "网页"], ["text", "文本"], ["elements", "元素"], ["json", "JSON"] ] as const).map(([id, label]) => <button type="button" key={id} className={view === id ? "is-active" : ""} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
      <span className="lfaa-native-browser__view-spacer" />
      {view === "page" ? <><button type="button" className="lfaa-native-browser__tool" aria-label="缩小网页" title="缩小" disabled={zoom <= .5} onClick={() => void changeZoom(-.1)}>−</button><span className="lfaa-native-browser__zoom">{Math.round(zoom * 100)}%</span><button type="button" className="lfaa-native-browser__tool" aria-label="放大网页" title="放大" disabled={zoom >= 2} onClick={() => void changeZoom(.1)}>＋</button></> : <button type="button" className="lfaa-native-browser__refresh-info" disabled={!activeTab || activeTab.loading || busy} onClick={() => { setInspection(null); setInspectionRevision(value => value + 1); }}>{busy ? "读取中…" : "刷新页面信息"}</button>}
    </nav>
    <main className="lfaa-native-browser__body">
      <div ref={viewportRef} className="lfaa-native-browser__native-page" aria-label="Chromium 网页内容" hidden={view !== "page" || !activeTab} />
      {view === "text" ? <pre className="lfaa-native-browser__data">{inspection?.text || (activeTab?.loading ? "页面正在加载…" : "页面正文为空或尚未读取。")}</pre> : null}
      {view === "elements" ? <div className="lfaa-native-browser__elements">{inspection?.controls.length ? inspection.controls.map((item, index) => <div key={`${item.role}:${item.name}:${index}`}><code>{item.role}</code><span>{item.name || "无名称"}</span>{item.type ? <small>{item.type}</small> : null}{item.disabled ? <small>禁用</small> : null}</div>) : <p>打开网页后可查看页面的可交互元素。</p>}</div> : null}
      {view === "json" ? <pre className="lfaa-native-browser__data">{json}</pre> : null}
      {!activeTab && view === "page" ? <div className="lfaa-native-browser__empty"><strong>新标签页</strong><span>输入网址或搜索内容开始浏览。</span></div> : null}
    </main>
    {visibleError ? <div className="lfaa-native-browser__error" role="alert">{visibleError}<button type="button" aria-label="关闭错误提示" onClick={() => { setError(""); setDismissedTabError(activeTab?.error ?? ""); }}>×</button></div> : null}
    <footer className="lfaa-native-browser__footer">
      <span title={activeTab?.url ?? ""}>{activeTab?.loading ? "正在加载…" : activeTab?.url || "就绪"}</span>
      <span>{!settings.browserUse.enabled ? "Agent 浏览器工具已关闭" : agentCanUseNativeBrowser ? activeTab?.targetId ? "Agent 与你共享当前标签页" : "正在连接当前标签页…" : "在设置中心接入后，Agent 可控制此标签页"}</span>
      <button type="button" onClick={() => { window.location.assign("/settings?section=browser"); }}>浏览器设置</button>
    </footer>
  </section>;
}
