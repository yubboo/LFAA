/**
 * 文件：workspace.types.ts
 * 作用：Chat / Work Workspace 共享的最小 UI ViewModel 契约。
 * 负责：对话消息、统一 Run Timeline 投影与三种工作方式类型。
 * 不负责：Provider 配置、Canvas Pointer 状态、Runtime 事件产生、宿主 Bridge。
 * 状态归属：Run 真值由 Agent Runtime；这里仅定义 Client 派生 ViewModel。
 * 对外接口：WorkspaceMode、ChatMessageViewModel、AgentRunProcessViewModel。
 * 关联文件：ChatWorkspace.tsx、useWorkspaceSessionController.ts。
 * 修改注意事项：Chat / Work 必须消费同一 Run 事件；禁止为两种表现层复制 Timeline 数据模型。
 */
import type { AgentActivityKind, AgentActivityStatus, AgentRunPhase, AgentWorkspaceMode } from "@lfaa/agent-runtime";

/** Chat / Work 都是 Agent 自动化；Manual 不启动模型。 */
export type WorkspaceMode = AgentWorkspaceMode | "manual";

export interface AgentRunActivityViewModel {
  id: string;
  kind: AgentActivityKind;
  title: string;
  detail?: string;
  status: AgentActivityStatus;
  output: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentRunProcessViewModel {
  runId: string;
  phase: AgentRunPhase;
  label: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: number;
  completedAt?: number;
  reasoningSummary: string;
  plan: string;
  phases: readonly { phase: AgentRunPhase; label: string; at: number }[];
  activities: readonly AgentRunActivityViewModel[];
}

export interface ChatMessageViewModel {
  id: string;
  role: "user" | "assistant" | "error" | "run";
  text: string;
  runId?: string;
  process?: AgentRunProcessViewModel;
}
