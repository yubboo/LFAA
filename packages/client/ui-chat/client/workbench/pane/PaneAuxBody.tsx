// 舞台辅助面板内容入口：把 RightWorkbenchPane 里「组装 WorkbenchAuxBody 的那堆 props」搬出来，
// 让舞台容器只传一份 props 对象，减少该文件体积与并发改动冲突面。
import type { ReactNode } from "react";
import type { WorkbenchContextPanelContribution } from "@lfaa/ui-layout";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { ChatClientStore } from "../../store/chat-store";
import type { ChatLocaleMessages } from "../../locales";
import { WorkbenchAuxBody } from "../WorkbenchAuxBody";
import type { RightAuxTab } from "../RightUtilityRail";

/** 辅助面板需要的全部上下文；由 RightWorkbenchPane 一次性组装后传入。 */
export interface PaneAuxBodyProps {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  sessionId: string;
  boundProjectId: string | null;
  boundProjectName: string | null;
  boundWorktreeId?: string | undefined;
  activeFilePath: string | undefined;
  projectContext: ReactNode;
  utilityPanels: WorkbenchContextPanelContribution<ReactNode>[];
  activeProfileName: string;
  activeProfileId: string | undefined;
  memoriesCount: number;
  activeRulesCount: number;
  selectedJobId: string | undefined;
  selectedSubagentId: string | undefined;
  onOpenSettings: () => void;
  workbench?: WorkbenchClientService | undefined;
}

/** 渲染某个辅助标签的内容；纯函数，不持有状态。 */
export function renderPaneAuxBody(props: PaneAuxBodyProps, tab: RightAuxTab) {
  return <WorkbenchAuxBody {...props} tab={tab} />;
}