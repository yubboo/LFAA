// 右侧工作台面板跳转请求处理：响应聊天消息点击与 Agent 自动跟随事件，统一调度舞台、DevTools 与辅助面板。
import { useEffect, useRef } from "react";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatStoreSnapshot } from "../store/chat-types";
import type { RightAuxTab } from "./RightUtilityRail";
import type { RightStageKind } from "./WorkbenchTabs";

export function useWorkbenchRequests({
  request,
  sessionId,
  stageKind,
  store,
  syncHostBrowser,
  setAuxOpen,
  setActiveAux,
  setBrowserOpen,
  setBrowserInitialUrl,
  setDevtoolsRequest,
  setReviewMessageId,
  setReviewTabOpen,
  setSelectedJobId,
  setSelectedSubagentId,
  openSubagentTab,
}: {
  request: ChatStoreSnapshot["rightPanelRequest"];
  sessionId: string;
  stageKind: RightStageKind;
  store: ChatClientStore;
  syncHostBrowser: (sid: string) => void;
  setAuxOpen: (open: boolean) => void;
  setActiveAux: (tab: RightAuxTab) => void;
  setBrowserOpen: (open: boolean) => void;
  setBrowserInitialUrl: (url: string | undefined) => void;
  setDevtoolsRequest: (req: { tab: "console" | "network"; nonce: number } | undefined) => void;
  setReviewMessageId: (id: string | undefined) => void;
  setReviewTabOpen: (open: boolean) => void;
  setSelectedJobId: (id: string | undefined) => void;
  setSelectedSubagentId: (id: string | undefined) => void;
  openSubagentTab: (subagentId: string, role?: string) => void;
}) {
  const stageKindRef = useRef(stageKind);
  stageKindRef.current = stageKind;

  useEffect(() => {
    if (!request) return;
    if (request.tab === "browser") {
      setAuxOpen(false);
      setBrowserOpen(true);
      store.setRightStageKind("browser");
      if (request.url) setBrowserInitialUrl(request.url);
      if (request.refreshBrowser) syncHostBrowser(sessionId);
      if (request.devtoolsTab) setDevtoolsRequest({ tab: request.devtoolsTab, nonce: request.nonce });
    } else if (request.tab === "review") {
      setAuxOpen(false);
      setReviewMessageId(request.url);
      setReviewTabOpen(true);
      store.setRightStageKind("review");
    } else if (request.tab === "file-preview") {
      setAuxOpen(false);
    } else if (request.tab === "files") {
      // 文件树已移到左二「项目工作区」，这里不再打开右侧文件树舞台。
      setAuxOpen(false);
    } else if (request.tab === "shell") {
      // 真实终端：与后台任务共用辅助面板，但打的是「终端」标签。
      setActiveAux("shell");
      setAuxOpen(true);
    } else if (request.tab === "terminal") {
      if (request.url) setSelectedJobId(request.url);
      // 自动跟随时不抢占台前正在浏览的网页/文件舞台，仅在欢迎页空闲时自动展开终端抽屉。
      if (request.autoExpand && stageKindRef.current !== "welcome") return;
      setActiveAux("terminal");
      setAuxOpen(true);
    } else if (request.tab === "subagent" && request.url) {
      setAuxOpen(false);
      openSubagentTab(request.url, request.subagentRole);
    } else if (request.tab === "subagents") {
      if (request.url) setSelectedSubagentId(request.url);
      if (request.autoExpand && stageKindRef.current !== "welcome") return;
      setActiveAux("subagents");
      setAuxOpen(true);
    } else if (request.tab === "sideAsk" || request.tab === "details") {
      setActiveAux(request.tab);
      setAuxOpen(true);
    }
    // 一个请求只消费一次：清空后即使 store 再 patch，也不会把用户刚关掉的标签重新打开。
    store.clearRightPanelRequest();
  }, [
    openSubagentTab,
    request,
    sessionId,
    setActiveAux,
    setAuxOpen,
    setBrowserInitialUrl,
    setBrowserOpen,
    setDevtoolsRequest,
    setReviewMessageId,
    setReviewTabOpen,
    setSelectedJobId,
    setSelectedSubagentId,
    store,
    syncHostBrowser,
  ]);
}
