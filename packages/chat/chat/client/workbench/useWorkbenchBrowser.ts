// 右侧工作台内置浏览器状态与宿主操作：标签列表、初始 URL、外部快照与新建/关闭/导航处理。
import { useCallback, useState, type RefObject } from "react";
import { fetchBrowserState, manageBrowserTab, navigateBrowser, type BrowserSessionSnapshot, type BrowserTabItem } from "@lfaa/browser/client";
import type { ChatClientStore } from "../store/chat-store";
import type { FilePreviewTab } from "../store/chat-types";
import { patchWorkbenchSessionState } from "../store/workbench-persist";

export function useWorkbenchBrowser({
  sessionId,
  store,
  activeFileTab,
  syncedSessionRef,
  initialOpen,
  initialUrl,
}: {
  sessionId: string;
  store: ChatClientStore;
  activeFileTab: FilePreviewTab | undefined;
  syncedSessionRef: RefObject<string | null>;
  initialOpen: boolean;
  initialUrl: string | undefined;
}) {
  const [browserOpen, setBrowserOpen] = useState(initialOpen);
  const [browserTabs, setBrowserTabs] = useState<BrowserTabItem[]>([]);
  const [browserInitialUrl, setBrowserInitialUrl] = useState<string | undefined>(initialUrl);
  const [browserExternalState, setBrowserExternalState] = useState<{ snap: BrowserSessionSnapshot; nonce: number }>();

  // 会话切换或重新挂载时先清空浏览器状态，再拉取宿主机已开启的标签。
  const restoreBrowser = useCallback((sid: string, savedOpen: boolean, savedUrl: string | undefined) => {
    setBrowserOpen(savedOpen);
    setBrowserInitialUrl(savedUrl);
    setBrowserTabs([]);
    setBrowserExternalState(undefined);
    let current = true;
    void fetchBrowserState(sid).then((res) => {
      if (!current) return;
      if (res.state.active && res.state.tabs.length > 0) {
        setBrowserTabs(res.state.tabs);
        setBrowserExternalState((prev) => ({ snap: res.state, nonce: (prev?.nonce ?? 0) + 1 }));
        setBrowserOpen(true);
      }
    }).catch(() => {});
    return () => { current = false; };
  }, []);

  const handleBrowserSnapshot = useCallback((snap: BrowserSessionSnapshot) => {
    setBrowserTabs(snap.tabs ?? []);
    if (snap.url && snap.url !== "about:blank") {
      setBrowserInitialUrl(snap.url);
      patchWorkbenchSessionState(sessionId, { browserOpen: true, browserUrl: snap.url });
    }
  }, [sessionId]);

  const handleOpenNewBrowserTab = () => {
    const wasOpen = browserOpen;
    setBrowserOpen(true);
    store.setRightStageKind("browser");
    if (!wasOpen && browserTabs.length === 0) return;
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

  const handleCloseBrowserTab = (tabId?: string) => {
    if (!tabId || browserTabs.length <= 1) {
      setBrowserOpen(false);
      setBrowserTabs([]);
      setBrowserInitialUrl(undefined);
      setBrowserExternalState(undefined);
      patchWorkbenchSessionState(sessionId, { browserOpen: false, browserUrl: "" });
      store.setRightStageKind(activeFileTab ? "file" : null);
      return;
    }
    void manageBrowserTab(sessionId, { action: "close", tabId })
      .then((r) => {
        setBrowserTabs(r.state.tabs ?? []);
        setBrowserExternalState((prev) => ({ snap: r.state, nonce: (prev?.nonce ?? 0) + 1 }));
      })
      .catch(() => {});
  };

  const handleOpenUrl = async (url: string) => {
    const { state: snap } = await navigateBrowser(sessionId, url);
    if (syncedSessionRef.current !== sessionId) return;
    setBrowserInitialUrl(undefined);
    setBrowserTabs(snap.tabs);
    setBrowserExternalState((prev) => ({ snap, nonce: (prev?.nonce ?? 0) + 1 }));
    setBrowserOpen(true);
    patchWorkbenchSessionState(sessionId, { browserOpen: true, browserUrl: snap.url });
    store.setRightStageKind("browser");
  };

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
    handleOpenUrl,
    restoreBrowser,
  };
}