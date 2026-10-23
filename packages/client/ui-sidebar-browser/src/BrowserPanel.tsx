/**
 * 功能：展示 Browser Owner 的真实网页会话状态；Web 使用独立可见 Chromium 窗口，Electron 使用原生 WebContentsView。
 * 作用：地址、标签与导航操作仍由 ApplicationWorkspace 统一提供，浏览器页面不通过截图模拟。
 * 关联文件：NativeBrowserPanel.tsx、packages/browser-use/browser-use、packages/client/ui-workspace。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { actOnBrowserDock, getErrorMessage, loadBrowserDockSession, loadBrowserProviders, navigateBrowserDock, waitForBrowserDockRevision, type BrowserProviderId, type BrowserProviderSummary, type BrowserSessionSnapshot, type UserSettings } from "lfaa-client-connection/src/api.js";
import { NativeBrowserPanel } from "./NativeBrowserPanel.js";
import { resolveBrowserAddress } from "./browser-address.js";
import "./browser-panel.css";

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

function displayAddress(value: string, showFullUrl: boolean): string {
  if (showFullUrl) return value;
  try { return new URL(value).host; } catch { return value; }
}

function BrowserUsePanel({ sessionId, settings, hidden = false, navigationRequest, onNavigationRequestHandled, actionRequest, onActionRequestHandled, onOpenTabsChange }: BrowserPanelProps) {
  const [providers, setProviders] = useState<BrowserProviderSummary[]>([]);
  const [providerId, setProviderId] = useState<BrowserProviderId | "">("");
  const [snapshot, setSnapshot] = useState<BrowserSessionSnapshot | null>(null);
  const snapshotRef = useRef<BrowserSessionSnapshot | null>(null);
  const [error, setError] = useState("");
  const [providerLoading, setProviderLoading] = useState(true);
  const actionTailRef = useRef<Promise<void>>(Promise.resolve());
  const actionCountRef = useRef(0);
  const handledNavigationRequestRef = useRef("");
  const handledActionRequestRef = useRef("");
  const snapshotRefreshRef = useRef<{ scope: string; promise: Promise<BrowserSessionSnapshot | null> } | null>(null);
  const providerReady = Boolean(providerId && providers.some(provider => provider.id === providerId && provider.available));

  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

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

  const refreshSnapshot = useCallback((selectedProvider: BrowserProviderId, sourceSession: string, signal?: AbortSignal) => {
    const scope = `${sourceSession}:${selectedProvider}`;
    const existing = snapshotRefreshRef.current;
    if (existing?.scope === scope) return existing.promise;
    if (existing) snapshotRefreshRef.current = null;
    const request = loadBrowserDockSession(sourceSession, selectedProvider, signal).then(result => {
      if (snapshotRefreshRef.current?.scope !== scope) return null;
      const next = result.session;
      if (next) {
        setSnapshot(current => current && current.revision > next.revision ? current : next);
      } else {
        setSnapshot(null);
      }
      return next;
    }).finally(() => {
      if (snapshotRefreshRef.current?.promise === request) snapshotRefreshRef.current = null;
    });
    snapshotRefreshRef.current = { scope, promise: request };
    return request;
  }, []);

  useEffect(() => {
    setSnapshot(null);
    snapshotRefreshRef.current = null;
    if (!sessionId || !providerId || !providerReady) return;
    const controller = new AbortController();
    void refreshSnapshot(providerId, sessionId, controller.signal).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    });
    return () => controller.abort();
  }, [providerId, providerReady, refreshSnapshot, sessionId]);

  useEffect(() => {
    if (hidden || !sessionId || !providerId || !providerReady || !snapshot) return;
    let cancelled = false;
    let activeRequest: AbortController | null = null;
    const poll = async () => {
      while (!cancelled && document.visibilityState !== "hidden") {
        const current = snapshotRef.current;
        if (!current) return;
        const request = new AbortController();
        activeRequest = request;
        try {
          const response = await waitForBrowserDockRevision(sessionId, providerId, current.revision, request.signal);
          if (cancelled) return;
          if (!response.session) {
            setSnapshot(null);
            return;
          }
          if (response.session.revision !== current.revision) {
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

  const runAction = useCallback((operation: () => Promise<{ session: BrowserSessionSnapshot }>): Promise<void> => {
    if (actionCountRef.current >= 32) {
      setError("浏览器操作较多，请等待当前操作完成后继续。");
      return Promise.resolve();
    }
    actionCountRef.current += 1;
    setError("");
    const task = actionTailRef.current.catch(() => undefined).then(async () => {
      try {
        const result = await operation();
        setSnapshot(current => current && current.revision > result.session.revision ? current : result.session);
      } catch (reason) {
        setError(getErrorMessage(reason));
      } finally {
        actionCountRef.current = Math.max(0, actionCountRef.current - 1);
      }
    });
    actionTailRef.current = task.then(() => undefined);
    return task;
  }, []);

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
    ? "先打开一个 AI 会话，再使用浏览器工作区。"
    : providerLoading
      ? "正在检查本机 Chromium 浏览器…"
      : !currentProvider
        ? providers.map(provider => provider.reason).filter(Boolean).join(" ") || "当前 Host 不提供本机可视浏览器。远程 Web 可以调用已授权的 Agent 网页能力，但无法显示或接管本机窗口。"
        : "通过上方地址栏打开网页。页面会在隔离的 Chromium 窗口中真实渲染；你和 Agent 共用当前 LFAA 会话里的同一页面。";
  const pageAddress = snapshot ? displayAddress(snapshot.url, settings.browserUse.showFullUrl) : "";

  return <section className="lfaa-browser-panel" aria-label="浏览器工作区" hidden={hidden}>
    {error ? <div className="lfaa-browser-panel__error" role="alert">{error}</div> : null}
    <div className="lfaa-browser-panel__content">
      {snapshot ? <article className="lfaa-browser-panel__status" aria-live="polite">
        <span className="lfaa-browser-panel__status-label">真实 Chromium 页面</span>
        <h2>{snapshot.loading ? "网页仍在加载" : snapshot.title || "已打开网页"}</h2>
        <p className="lfaa-browser-panel__page-url" title={snapshot.url}>{pageAddress || snapshot.url}</p>
        <p>网页正在独立 Chromium 窗口中渲染和接收输入。你与 Agent 使用同一个浏览器页面；在该窗口中继续手动浏览，或在上方地址栏导航。</p>
      </article> : <div className="lfaa-browser-panel__empty" role={providerLoading ? "status" : undefined}>
        <div className="lfaa-browser-panel__empty-card">
          <span className="lfaa-browser-panel__status-label">LFAA 浏览器</span>
          <p>{emptyText}</p>
        </div>
      </div>}
    </div>
  </section>;
}

export function BrowserPanel(props: BrowserPanelProps) {
  if (typeof window !== "undefined" && window.lfaaDesktop?.nativeBrowser) {
    return <NativeBrowserPanel {...props} />;
  }
  return <BrowserUsePanel {...props} />;
}
