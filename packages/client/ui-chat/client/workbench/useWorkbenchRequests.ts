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
  setFileTreeOpen,
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
  setFileTreeOpen: (open: boolean) => void;
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
      setFileTreeOpen(false);
    } else if (request.tab === "files") {
      store.setRightStageKind(null);
      setActiveAux("filesTree");
      setAuxOpen(true);
    } else if (request.tab === "terminal") {
      if (request.url) setSelectedJobId(request.url);
      // 自动跟随时不抢占台前正在浏览的网页/文件舞台，仅在欢迎页空闲时自动展开终端抽屉。
      if (request.autoExpand && stageKindRef.current !== "welcome") return;
      setActiveAux("terminal");
      setAuxOpen(true);
    } else if (request.tab === "subagent" && request.url) {
      setAuxOpen(false);
      setFileTreeOpen(false);
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
  }, [
    openSubagentTab,
    request,
    sessionId,
    setActiveAux,
    setAuxOpen,
    setBrowserInitialUrl,
    setBrowserOpen,
    setDevtoolsRequest,
    setFileTreeOpen,
    setReviewMessageId,
    setReviewTabOpen,
    setSelectedJobId,
    setSelectedSubagentId,
    store,
    syncHostBrowser,
  ]);
}
