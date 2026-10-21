/**
 * 功能：在 AI Work 右 Dock 内以独立标签预览并操作每个已接入的浏览器。
 * 作用：通过已认证 Client API 与本机 Browser Owner 共享当前 AI Session；接入偏好归 Settings Owner。
 * 关联文件：packages/client/connection/src/api.ts、packages/browser-use/browser-use、packages/client/ui-workspace。
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { actOnBrowser, claimBrowserTab, closeBrowserProviderSessions, closeBrowserSession, connectTabbitBrowser, getErrorMessage, loadBrowserProviders, loadBrowserRevision, loadBrowserSession, loadBrowserTabs, loadSettings, navigateBrowser, saveSettings, type BrowserProviderId, type BrowserProviderSummary, type BrowserSessionSnapshot, type BrowserTabSummary, type UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./browser-panel.css";

type BrowserPanelProps = { sessionId: string | null };
type BrowserView = "preview" | "text" | "elements" | "json";

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

export function BrowserPanel({ sessionId }: BrowserPanelProps) {
  const [providers, setProviders] = useState<BrowserProviderSummary[]>([]);
  const [browserSettings, setBrowserSettings] = useState<UserSettings["browserUse"] | null>(null);
  const [computerControlEnabled, setComputerControlEnabled] = useState(false);
  const [tabbitTabs, setTabbitTabs] = useState<BrowserTabSummary[]>([]);
  const [tabbitTabsRequested, setTabbitTabsRequested] = useState(false);
  const [providerId, setProviderId] = useState<BrowserProviderId | "">("");
  const [snapshot, setSnapshot] = useState<BrowserSessionSnapshot | null>(null);
  const [address, setAddress] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [view, setView] = useState<BrowserView>("preview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState(true);
  const requestRevision = useRef(0);
  const actionInFlight = useRef(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const refreshSnapshot = useCallback(async (selectedProvider: BrowserProviderId, sourceSession: string, signal?: AbortSignal) => {
    const result = await loadBrowserSession(sourceSession, selectedProvider, signal);
    setSnapshot(result.session);
    setAddress(result.session?.url ?? "");
    return result.session;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setProviderLoading(true);
    void Promise.all([loadBrowserProviders(controller.signal), loadSettings(controller.signal)]).then(([browserResult, settingsResult]) => {
      if (controller.signal.aborted) return;
      setProviders(browserResult.providers);
      setBrowserSettings(settingsResult.settings.browserUse);
      setComputerControlEnabled(settingsResult.settings.computerControl.enabled);
      setProviderId(current => current && browserResult.providers.some(item => item.id === current)
        ? current
        : browserResult.providers.find(item => settingsResult.settings.browserUse.enabledProviderIds.includes(item.id))?.id
          ?? browserResult.providers[0]?.id ?? "");
      setError("");
    }).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    }).finally(() => { if (!controller.signal.aborted) setProviderLoading(false); });
    return () => controller.abort();
  }, []);

  const providerConnected = Boolean(providerId && browserSettings?.enabledProviderIds.includes(providerId));

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
    if (!sessionId || !providerId || !providerConnected || !snapshot) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let activeRequest: AbortController | null = null;
    const isPageVisible = () => document.visibilityState !== "hidden";
    const poll = async () => {
      if (cancelled || !isPageVisible() || activeRequest) return;
      try {
        if (!actionInFlight.current) {
          const request = new AbortController();
          activeRequest = request;
          const response = await loadBrowserRevision(sessionId, providerId, request.signal);
          if (!cancelled && response.session && response.session.revision !== snapshot.revision) {
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

  const runAction = useCallback(async (operation: () => Promise<{ session: BrowserSessionSnapshot }>) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    const revision = ++requestRevision.current;
    setLoading(true);
    setError("");
    try {
      const result = await operation();
      if (revision === requestRevision.current) {
        setSnapshot(result.session);
        setAddress(result.session.url);
      }
    } catch (reason) {
      if (revision === requestRevision.current) setError(getErrorMessage(reason));
    } finally {
      actionInFlight.current = false;
      if (revision === requestRevision.current) setLoading(false);
    }
  }, []);

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

  const onPreviewClick = useCallback((event: MouseEvent<HTMLImageElement>) => {
    if (!sessionId || !providerId || !snapshot?.screenshot || !imageRef.current) return;
    const bounds = imageRef.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(0, Math.min(snapshot.screenshot.width - 1, Math.floor((event.clientX - bounds.left) * snapshot.screenshot.width / bounds.width)));
    const y = Math.max(0, Math.min(snapshot.screenshot.height - 1, Math.floor((event.clientY - bounds.top) * snapshot.screenshot.height / bounds.height)));
    void runAction(() => actOnBrowser(sessionId, providerId, "clickAt", { x, y }));
  }, [providerId, runAction, sessionId, snapshot]);

  const currentProvider = providers.find(item => item.id === providerId);
  const snapshotControls = snapshot && Array.isArray(snapshot.controls) ? snapshot.controls : [];
  const snapshotTabs = snapshot && Array.isArray(snapshot.tabs) ? snapshot.tabs : [];
  const shownAddress = address && !browserSettings?.showFullUrl && !addressFocused ? originOnly(address) : address;
  return <section className="lfaa-browser-panel" aria-label="浏览器预览台">
    <header className="lfaa-browser-panel__header">
      <div><strong>浏览器</strong><span>{browserSettings?.enabled ? "Agent 浏览器控制已开启" : "Agent 控制关闭 · 仍可直接预览"}</span></div>
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
    {!sessionId ? <div className="lfaa-browser-panel__empty"><WorkbenchIcon name="browser" size={26} /><strong>浏览器将与当前 AI 会话共享</strong><p>先打开或发起一个 AI Work 会话，Agent 和右侧预览台才能操作同一浏览器页面。</p></div> : null}
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
          {(["back", "forward", "reload"] as const).map(action => <button key={action} type="button" aria-label={action === "back" ? "后退" : action === "forward" ? "前进" : "刷新"} title={action === "back" ? "后退" : action === "forward" ? "前进" : "刷新"} disabled={loading || !snapshot || !providerId} onClick={() => { if (providerId) void runAction(() => actOnBrowser(sessionId, providerId, action)); }}>{action === "reload" ? <WorkbenchIcon name="refresh" size={15} /> : action === "back" ? "‹" : "›"}</button>)}
        </div>
        <input aria-label="浏览器地址" type="text" inputMode="url" autoComplete="url" spellCheck={false} value={shownAddress} onFocus={() => setAddressFocused(true)} onBlur={() => setAddressFocused(false)} onChange={event => setAddress(event.currentTarget.value)} placeholder="输入 HTTP(S) 网址" disabled={loading} />
        <button type="submit" aria-label="打开网页" title="打开网页" disabled={loading}>打开</button>
      </form>
      {providerId === "tabbit-personal" ? <p className="lfaa-browser-panel__notice">网页操作会作用于所选的真实 Tabbit 标签。不要在本轮未明确要求时切换或读取个人浏览器。</p> : null}
      {error ? <div className="lfaa-browser-panel__error" role="alert">{error}</div> : null}
      <nav className="lfaa-browser-panel__views" aria-label="浏览器检查视图">{(["preview", "text", "elements", "json"] as const).map(item => <button type="button" key={item} aria-pressed={view === item} className={view === item ? "is-active" : ""} onClick={() => setView(item)}>{item === "preview" ? "预览" : item === "text" ? "文本" : item === "elements" ? "元素" : "JSON"}</button>)}<span aria-live="polite">{loading ? "处理中…" : snapshot ? `修订 ${snapshot.revision}` : "未打开网页"}</span></nav>
      <div className="lfaa-browser-panel__content">
        {view === "preview" ? snapshot?.screenshot ? <div className="lfaa-browser-panel__preview-wrap"><img ref={imageRef} className="lfaa-browser-panel__preview" src={`data:${snapshot.screenshot.mimeType};base64,${snapshot.screenshot.dataBase64}`} alt={`${snapshot.title || snapshot.url} 页面截图；点击页面可操作`} onClick={onPreviewClick} />{loading ? <span className="lfaa-browser-panel__busy" role="status">页面操作中</span> : null}</div> : <div className="lfaa-browser-panel__empty"><WorkbenchIcon name="browser" size={24} /><span>{snapshot ? "页面截图暂不可用，可切换到文本或元素视图。" : providerId === "tabbit-personal" ? "连接并选择一个 Tabbit 标签，或在地址栏打开新页面。" : "输入网址后，在此查看页面预览。"}</span></div> : null}
        {view === "text" ? <pre className="lfaa-browser-panel__data">{snapshot?.pageText || "页面正文为空或尚未打开。"}</pre> : null}
        {view === "elements" ? <div className="lfaa-browser-panel__elements">{snapshotControls.length ? snapshotControls.map((control, index) => <div key={`${control.role}:${control.name}:${index}`}><code>{control.role}</code><span>{control.name}</span>{control.disabled ? <small>禁用</small> : null}</div>) : <p>没有发现可访问的交互元素。</p>}</div> : null}
        {view === "json" ? <pre className="lfaa-browser-panel__data">{snapshot ? JSON.stringify({ url: snapshot.url, title: snapshot.title, revision: snapshot.revision, tabs: snapshotTabs, controls: snapshotControls }, null, 2) : "尚无页面数据。"}</pre> : null}
      </div>
      {snapshot ? <footer className="lfaa-browser-panel__footer"><span title={browserSettings?.showFullUrl ? snapshot.url : originOnly(snapshot.url)}>{browserSettings?.showFullUrl ? snapshot.url : originOnly(snapshot.url)}</span><button type="button" disabled={loading} onClick={() => void closeBrowserSession(sessionId, snapshot.providerId).then(() => { setSnapshot(null); setAddress(""); }).catch(reason => setError(getErrorMessage(reason)))}>关闭会话</button></footer> : null}
    </> : null}
  </section>;
}
