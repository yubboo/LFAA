// 右侧工作台内置浏览器状态与宿主操作：标签列表、初始 URL、外部快照与新建/关闭/导航处理。
import { useCallback, useRef, useState, type RefObject } from "react";
import { controlBrowserNav, fetchBrowserState, manageBrowserTab, type BrowserSessionSnapshot, type BrowserTabItem } from "@lfaa/client-ui-browser/client";
import type { ChatClientStore } from "../store/chat-store";
import type { FilePreviewTab } from "../store/chat-types";
import { patchWorkbenchSessionState } from "../store/workbench-persist";
import { shouldCreateHostTab } from "./blank-tab-policy";

/** 检测当前页面是否运行在内置浏览器内部，避免打开 LFAA 自身时递归恢复右栏浏览器互抢视口尺寸。 */
function isEmbeddedBrowserGuest(): boolean {
  return typeof window !== "undefined"
    && (window as unknown as { __LFAA_EMBEDDED_BROWSER__?: boolean }).__LFAA_EMBEDDED_BROWSER__ === true;
}

/** 只把真实网络失败交给 Chromium 错误页显示，其他导航错误继续反馈给启动页。 */
export function useWorkbenchBrowser({
  sessionId,
  store,
  activeFileTab,
  syncedSessionRef,
  initialOpen,
}: {
  sessionId: string;
  store: ChatClientStore;
  activeFileTab: FilePreviewTab | undefined;
  syncedSessionRef: RefObject<string | null>;
  initialOpen: boolean;
}) {
  const [browserOpen, setBrowserOpen] = useState(() => (isEmbeddedBrowserGuest() ? false : initialOpen));
  const [browserTabs, setBrowserTabs] = useState<BrowserTabItem[]>([]);
  const [browserInitialUrl, setBrowserInitialUrl] = useState<string>();
  const [browserExternalState, setBrowserExternalState] = useState<{ snap: BrowserSessionSnapshot; nonce: number }>();
  const stateRequest = useRef(0);

  // 会话切换或重新挂载时先清空浏览器状态，再拉取宿主机已开启的标签（内嵌客体页跳过以避免递归嵌套）。
  const restoreBrowser = useCallback((sid: string, savedOpen: boolean, savedUrl: string | undefined) => {
    const request = ++stateRequest.current;
    // 过滤掉历史误存的 chrome-error:// 等非 http(s) 地址；空态占位「新标签页」没有地址，也没有宿主页面，不参与恢复。
    const savedHttp = savedUrl && /^https?:\/\//iu.test(savedUrl) ? savedUrl : undefined;
    if (isEmbeddedBrowserGuest()) {
      setBrowserOpen(false);
      setBrowserInitialUrl(undefined);
      setBrowserTabs([]);
      setBrowserExternalState(undefined);
      return () => {};
    }
    setBrowserOpen(Boolean(savedOpen && savedHttp));
    setBrowserInitialUrl(undefined);
    setBrowserTabs([]);
    setBrowserExternalState(undefined);
    let current = true;
    void fetchBrowserState(sid).then((res) => {
      if (!current || request !== stateRequest.current) return;
      const hostTabs = res.state.tabs ?? [];
      const hasRealPage = hostTabs.some((tab) => Boolean(tab.url && tab.url !== "about:blank"));
      if (res.state.active && hasRealPage) {
        setBrowserTabs(hostTabs);
        setBrowserExternalState((prev) => ({ snap: res.state, nonce: (prev?.nonce ?? 0) + 1 }));
        setBrowserOpen(true);
      } else if (savedOpen && savedHttp) {
        // 有可复用的 Host 标签时沿用页面。
        setBrowserInitialUrl(savedHttp);
      }
    }).catch(() => {});
    return () => { current = false; };
  }, []);

  const handleBrowserSnapshot = useCallback((snap: BrowserSessionSnapshot) => {
    setBrowserTabs(snap.tabs ?? []);
    if (snap.url && /^https?:\/\//iu.test(snap.url)) {
      setBrowserInitialUrl((pendingUrl) => pendingUrl === snap.url ? undefined : pendingUrl);
      patchWorkbenchSessionState(sessionId, { browserOpen: true, browserUrl: snap.url });
    }
  }, [sessionId]);

  const handleOpenNewBrowserTab = () => {
    const wasOpen = browserOpen;
    setBrowserOpen(true);
    store.setRightStageKind("browser");
    // 已经打开过就每次都给一个新标签页；首次打开时只露出空态占位。
    if (!shouldCreateHostTab({ browserOpen: wasOpen, browserTabs: browserTabs.length })) return;
    void manageBrowserTab(sessionId, { action: "new" })
      .then((r) => {
        setBrowserTabs(r.state.tabs ?? []);
        setBrowserExternalState((prev) => ({ snap: r.state, nonce: (prev?.nonce ?? 0) + 1 }));
      })
      .catch(() => {});
  };

  const handleActivateBrowserTab = (tabId: string) => {
    void manageBrowserTab(sessionId, { action: "activate", tabId })
      .then((r) => {
        setBrowserTabs(r.state.tabs ?? []);
        setBrowserExternalState((prev) => ({ snap: r.state, nonce: (prev?.nonce ?? 0) + 1 }));
      })
      .catch(() => {});
  };

  // fallbackStage：关掉浏览器后舞台回退到哪；缺省按是否还有文件标签推断。
  const handleCloseBrowserTab = (tabId?: string, fallbackStage?: "file" | "review" | "subagent" | null) => {
    if (!tabId || browserTabs.length <= 1) {
      stateRequest.current += 1;
      setBrowserOpen(false);
      setBrowserTabs([]);
      setBrowserInitialUrl(undefined);
      setBrowserExternalState(undefined);
      patchWorkbenchSessionState(sessionId, { browserOpen: false, browserUrl: "" });
      store.setRightStageKind(fallbackStage === undefined ? (activeFileTab ? "file" : null) : fallbackStage);
      void controlBrowserNav(sessionId, "close").catch(() => {});
      return;
    }
    // 先乐观移除被关闭的标签页：关闭与空白标签原位替换 0ms 响应，不再等待后端往返导致标签闪动跳位。
    setBrowserTabs((prev) => prev.filter((item) => item.tabId !== tabId));
    void manageBrowserTab(sessionId, { action: "close", tabId })
      .then((r) => {
        setBrowserTabs(r.state.tabs ?? []);
        setBrowserExternalState((prev) => ({ snap: r.state, nonce: (prev?.nonce ?? 0) + 1 }));
      })
      .catch(() => {});
  };

  // 关闭除 keepTabId 之外的浏览器标签；没有要保留的标签时直接关掉整个浏览器。
  const closeBrowserTabsExcept = async (keepTabId?: string) => {
    if (!keepTabId || browserTabs.length === 0) {
      handleCloseBrowserTab();
      return;
    }
    for (const tab of browserTabs) {
      if (tab.tabId === keepTabId) continue;
      try {
        const result = await manageBrowserTab(sessionId, { action: "close", tabId: tab.tabId });
        setBrowserTabs(result.state.tabs ?? []);
        setBrowserExternalState((prev) => ({ snap: result.state, nonce: (prev?.nonce ?? 0) + 1 }));
      } catch {
        // 单个标签关闭失败不阻塞其它标签，下一次快照会校正列表。
      }
    }
    store.setRightStageKind("browser");
  };

  const handleOpenUrl = async (url: string) => {
    stateRequest.current += 1;
    const trimmed = url.trim();
    const targetUrl = /^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;
    setBrowserInitialUrl(targetUrl);
    setBrowserOpen(true);
    patchWorkbenchSessionState(sessionId, { browserOpen: true, browserUrl: targetUrl });
    store.setRightStageKind("browser");
  };

  // Agent 导航或切换多标签后主动从 Host 拉一次最新快照，确保顶部多标签栏与当前视口即时同步。
  const syncHostBrowser = useCallback((sid: string) => {
    if (isEmbeddedBrowserGuest()) return;
    const request = ++stateRequest.current;
    void fetchBrowserState(sid).then((res) => {
      if (syncedSessionRef.current !== sid || request !== stateRequest.current) return;
      if (res.state.active || res.state.tabs.length > 0) {
        setBrowserInitialUrl(undefined);
        setBrowserTabs(res.state.tabs);
        setBrowserExternalState((prev) => ({ snap: res.state, nonce: (prev?.nonce ?? 0) + 1 }));
        setBrowserOpen(true);
      }
    }).catch(() => {});
  }, [syncedSessionRef]);

  return {
    browserOpen,
    browserTabs,
    browserInitialUrl,
    browserExternalState,
    setBrowserOpen,
    setBrowserInitialUrl,
    handleBrowserSnapshot,
    handleOpenNewBrowserTab,
    handleActivateBrowserTab,
    handleCloseBrowserTab,
    closeBrowserTabsExcept,
    handleOpenUrl,
    restoreBrowser,
    syncHostBrowser,
  };
}
