// 右栏会话状态恢复与持久化：切换会话/刷新挂载时读回浏览器、审查、辅助标签与插件标签（如无限画布），恢复完成后再写回本地偏好。
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  patchWorkbenchSessionState,
  readWorkbenchSessionState,
} from "../store/workbench-persist";
import type { RightAuxTab } from "./RightUtilityRail";

/** 把「恢复」与「写回」两个副作用收在一处，避免主面板组件继续膨胀。 */
export function useWorkbenchSessionState(input: {
  sessionId: string;
  hydratedSessionId: string;
  setHydratedSessionId: (sessionId: string) => void;
  syncedSessionRef: RefObject<string | null>;
  restoreBrowser: (sessionId: string, savedOpen: boolean, savedUrl: string | undefined) => () => void;
  restoreAuxTab: (tabs: RightAuxTab[], active: RightAuxTab | null) => void;
  restoreExtensionTabs: (opened: string[], activeId: string | null) => void;
  setReviewTabOpen: (open: boolean) => void;
  setReviewMessageId: (id: string | undefined) => void;
  persist: {
    browserOpen: boolean;
    browserUrl?: string | undefined;
    reviewTabOpen: boolean;
    reviewMessageId?: string | undefined;
    auxOpen: boolean;
    activeAuxTab: RightAuxTab | null;
    auxTabs: RightAuxTab[];
    extensionTabs: string[];
    activeExtensionTab: string | null;
  };
}) {
  const {
    sessionId,
    hydratedSessionId,
    setHydratedSessionId,
    syncedSessionRef,
    restoreBrowser,
    restoreAuxTab,
    restoreExtensionTabs,
    setReviewTabOpen,
    setReviewMessageId,
    persist,
  } = input;

  // 恢复效果只依赖会话与浏览器恢复函数；其余 setter 每帧都会重建，用 ref 取最新实现，避免恢复效果反复执行。
  const latest = useRef({
    restoreAuxTab,
    restoreExtensionTabs,
    setReviewTabOpen,
    setReviewMessageId,
    setHydratedSessionId,
  });
  latest.current = {
    restoreAuxTab,
    restoreExtensionTabs,
    setReviewTabOpen,
    setReviewMessageId,
    setHydratedSessionId,
  };

  // 切换会话或刷新挂载时恢复已持久化的右侧栏状态，并拉取宿主机已开启的浏览器标签。
  useEffect(() => {
    const saved = readWorkbenchSessionState(sessionId);
    syncedSessionRef.current = null;
    const cancelBrowserRestore = restoreBrowser(sessionId, saved.browserOpen, saved.browserUrl);
    latest.current.setReviewTabOpen(saved.reviewTabOpen);
    latest.current.setReviewMessageId(saved.reviewMessageId);
    latest.current.restoreAuxTab(saved.auxTabs, saved.activeAux);
    latest.current.restoreExtensionTabs(saved.extensionTabs, saved.activeExtensionTab);
    syncedSessionRef.current = sessionId;
    latest.current.setHydratedSessionId(sessionId);
    return cancelBrowserRestore;
  }, [restoreBrowser, sessionId, syncedSessionRef]);

  // 只有当前会话状态已真正恢复并提交渲染后才写回 localStorage，避免把旧会话状态写进新会话。
  useEffect(() => {
    if (hydratedSessionId !== sessionId || syncedSessionRef.current !== sessionId) return;
    patchWorkbenchSessionState(sessionId, {
      browserOpen: persist.browserOpen,
      ...(persist.browserUrl ? { browserUrl: persist.browserUrl } : {}),
      reviewTabOpen: persist.reviewTabOpen,
      reviewMessageId: persist.reviewMessageId,
      auxOpen: persist.auxOpen,
      auxTabs: persist.auxTabs,
      activeAux: persist.activeAuxTab,
      extensionTabs: persist.extensionTabs,
      activeExtensionTab: persist.activeExtensionTab,
    });
  }, [
    hydratedSessionId,
    persist.activeAuxTab,
    persist.activeExtensionTab,
    persist.auxOpen,
    persist.auxTabs,
    persist.browserOpen,
    persist.browserUrl,
    persist.extensionTabs,
    persist.reviewMessageId,
    persist.reviewTabOpen,
    sessionId,
    syncedSessionRef,
  ]);
}
