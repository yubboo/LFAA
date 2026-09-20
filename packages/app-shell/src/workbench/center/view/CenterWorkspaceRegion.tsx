/**
 * 文件：CenterWorkspaceRegion.tsx
 * 作用：工作台中央大模块的唯一装配点。
 * 负责：按 Header → Conversation → Composer 的父子顺序装配中央子模块，只传递显式 Props/Callback。
 * 不负责：左/右栏、终端、Settings、Shell 状态、Composer/RuntimeControl 私有状态。
 * 状态归属：本文件不拥有业务状态；展示状态由子模块持有，跨区域事实由上层 Controller 提供。
 * 对外接口：CenterWorkspaceRegion。
 * 修改注意事项：禁止深链导入子模块内部文件；只能通过 header/conversation/composer 的 index.ts 使用公共 API。
 */
import type { AgentExecutionHints, AgentPermissionProfileId, AgentRunHandle, AgentSurfaceMode } from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type { ActiveReasoningControl, ChatProjectionMessage, LayoutMode, QuickModelOption } from "#workbench/contracts";
import { ComposerRegion } from "../composer";
import { ConversationRegion } from "../conversation";
import { CenterHeader } from "../header";
import styles from "../styles/CenterWorkspace.module.css";

export interface CenterWorkspaceRegionProps {
  layoutMode: LayoutMode;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  agentSurface: AgentSurfaceMode;
  permissionProfileId: AgentPermissionProfileId;
  modelLabel: string;
  quickModels: readonly QuickModelOption[];
  activeReasoning: ActiveReasoningControl | null;
  runtimeConnected: boolean;
  chatMessages: readonly ChatProjectionMessage[];
  workspaceId?: string;
  lastRunInput: string | null;
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
}

export function CenterWorkspaceRegion(props: CenterWorkspaceRegionProps) {
  return (
    <section className={styles.root} data-agent-surface={props.agentSurface} data-ui="center-workspace">
      <CenterHeader
        layoutMode={props.layoutMode}
        leftCollapsed={props.leftCollapsed}
        rightCollapsed={props.rightCollapsed}
        terminalOpen={props.terminalOpen}
        agentSurface={props.agentSurface}
        runtimeConnected={props.runtimeConnected}
        onToggleLeft={props.onToggleLeft}
        onToggleRight={props.onToggleRight}
        onToggleTerminal={props.onToggleTerminal}
        onLeftHoverEnter={props.onLeftHoverEnter}
        onLeftHoverLeave={props.onLeftHoverLeave}
      />
      <ConversationRegion
        agentSurface={props.agentSurface}
        layoutMode={props.layoutMode}
        chatMessages={props.chatMessages}
        workspaceId={props.workspaceId}
        lastRunInput={props.lastRunInput}
      />
      <ComposerRegion
        layoutMode={props.layoutMode}
        agentSurface={props.agentSurface}
        permissionProfileId={props.permissionProfileId}
        modelLabel={props.modelLabel}
        quickModels={props.quickModels}
        activeReasoning={props.activeReasoning}
        runtimeConnected={props.runtimeConnected}
        onPermissionProfileChange={props.onPermissionProfileChange}
        onSubmitTask={props.onSubmitTask}
        onQuickSelectModel={props.onQuickSelectModel}
        onQuickUpdateModelSetting={props.onQuickUpdateModelSetting}
        onOpenAiSettings={props.onOpenAiSettings}
      />
    </section>
  );
}
