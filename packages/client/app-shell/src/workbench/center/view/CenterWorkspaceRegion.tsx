/**
 * 文件：CenterWorkspaceRegion.tsx
 * 作用：工作台中央大模块的唯一装配点。
 * 负责：按 Header → Workspace(Chat/Work/Manual) → Control Bar 的父子顺序装配中央区域。
 * 不负责：左/右栏、终端实现、Settings、Shell 状态、具体 Agent/Tool Runtime。
 * 状态归属：本文件不拥有业务状态；跨区域事实由上层 Controller 提供。
 * 对外接口：CenterWorkspaceRegion。
 * 关联文件：header/composer、@lfaa/workspace。
 * 修改注意事项：Chat/Work 只切换表现层，必须共享同一 onSubmitTask；Manual 不启动 Agent Run。
 */
import type { AgentExecutionHints, AgentPermissionProfileId, AgentRunHandle } from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type { ActiveReasoningControl, LayoutMode, QuickModelOption } from "#workbench/contracts";
import { ChatWorkspace, ManualWorkspace, WorkWorkspace, type ChatMessageViewModel, type WorkspaceMode } from "@lfaa/workspace";
import { ComposerRegion } from "../composer";
import { CenterHeader } from "../header";
import styles from "../styles/CenterWorkspace.module.css";

export interface CenterWorkspaceRegionProps {
  layoutMode: LayoutMode;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  workspaceMode: WorkspaceMode;
  permissionProfileId: AgentPermissionProfileId;
  modelLabel: string;
  quickModels: readonly QuickModelOption[];
  activeReasoning: ActiveReasoningControl | null;
  runtimeConnected: boolean;
  automationReady: boolean;
  chatMessages: readonly ChatMessageViewModel[];
  workspaceId: string | undefined;
  lastRunInput: string | null;
  lastAssistantText: string | null;
  onPermissionProfileChange: (profileId: AgentPermissionProfileId) => void;
  onSubmitTask: (input: string, executionHints?: AgentExecutionHints, modelSettingOverrides?: Readonly<Record<string, AiModelSettingValue>>) => Promise<AgentRunHandle>;
  onQuickSelectModel: (accountId: string, modelId: string) => Promise<void>;
  onQuickUpdateModelSetting: (fieldId: string, value: AiModelSettingValue) => Promise<void>;
  onOpenAiSettings: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleTerminal: () => void;
  onLeftHoverEnter: () => void;
  onLeftHoverLeave: () => void;
  onWorkContextChange: (context: string) => void;
}

export function CenterWorkspaceRegion(props: CenterWorkspaceRegionProps) {
  return (
    <section className={styles.root} data-workspace-mode={props.workspaceMode} data-ui="center-workspace">
      <CenterHeader
        layoutMode={props.layoutMode}
        leftCollapsed={props.leftCollapsed}
        rightCollapsed={props.rightCollapsed}
        terminalOpen={props.terminalOpen}
        workspaceMode={props.workspaceMode}
        runtimeConnected={props.runtimeConnected}
        onToggleLeft={props.onToggleLeft}
        onToggleRight={props.onToggleRight}
        onToggleTerminal={props.onToggleTerminal}
        onLeftHoverEnter={props.onLeftHoverEnter}
        onLeftHoverLeave={props.onLeftHoverLeave}
      />
      {props.workspaceMode === "work" ? (
        <WorkWorkspace workspaceId={props.workspaceId} lastRunInput={props.lastRunInput} lastRunOutput={props.lastAssistantText} onContextChange={props.onWorkContextChange} />
      ) : props.workspaceMode === "manual" ? (
        <ManualWorkspace workspaceId={props.workspaceId} terminalOpen={props.terminalOpen} onToggleTerminal={props.onToggleTerminal} />
      ) : (
        <ChatWorkspace layoutMode={props.layoutMode} messages={props.chatMessages} />
      )}
      <ComposerRegion
        layoutMode={props.layoutMode}
        workspaceMode={props.workspaceMode}
        permissionProfileId={props.permissionProfileId}
        modelLabel={props.modelLabel}
        quickModels={props.quickModels}
        activeReasoning={props.activeReasoning}
        runtimeConnected={props.runtimeConnected}
        automationReady={props.automationReady}
        onPermissionProfileChange={props.onPermissionProfileChange}
        onSubmitTask={props.onSubmitTask}
        onQuickSelectModel={props.onQuickSelectModel}
        onQuickUpdateModelSetting={props.onQuickUpdateModelSetting}
        onOpenAiSettings={props.onOpenAiSettings}
        onToggleTerminal={props.onToggleTerminal}
      />
    </section>
  );
}
