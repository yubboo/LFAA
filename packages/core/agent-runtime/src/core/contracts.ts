/**
 * 文件：contracts.ts
 * 作用：定义 Chat / Work 共用的 Agent Runtime 公共协议与运行过程事件。
 * 负责：Run 输入、模型绑定、Workspace Mode、人工干预、Run Timeline 事件与 Host 端口。
 * 不负责：具体模型 SDK、Harness 进程、工具执行实现、数据库持久化、UI 展示细节。
 * 状态归属：Session/Run 真值归 Runtime/Event Store；UI 只能消费事件并派生 ViewModel。
 * 对外接口：AgentRunRequest、AgentRuntimeEvent、AgentRuntimeHost 等。
 * 关联文件：permission-profiles.ts、packages/api/agent-controller、packages/client/workspace。
 * 修改注意事项：Chat 与 Work 禁止新增不同执行核心；不得把原始隐藏思维链作为 UI Event 暴露，只允许 Provider 官方可读 reasoning summary。
 */

import type { LfaaCapabilityDescriptor, LfaaCapabilityKind } from "@lfaa/plugin-sdk";
import type { AgentPermissionProfileId } from "./permission-profiles.ts";

/** Chat / Work 是同一个 Agent Core 的两种表现层；Manual 不进入 Agent Runtime。 */
export type AgentWorkspaceMode = "chat" | "work";

export interface AgentModelBinding {
  readonly accountId: string;
  readonly providerId: string;
  readonly modelId: string;
  /** Config System 已按官方 Capability 校验过的模型运行参数，例如 reasoningEffort。 */
  readonly settings?: Readonly<Record<string, string | number | boolean>>;
}

export type AgentCapabilityKind = LfaaCapabilityKind;
export type AgentCapabilityDescriptor = LfaaCapabilityDescriptor;

/** Agent 级执行提示，不属于 Provider model settings；Host/Harness 可以按自身能力解释。 */
export interface AgentExecutionHints {
  /** 请求更充分的规划/校验，但不得被翻译成 Provider 未声明的 reasoning 参数。 */
  readonly reasoningBoost?: boolean;
}

export interface AgentRunRequest {
  /** 只描述表现层；Chat / Work 必须共享同一 Agent Core、工具、权限、模型与交付质量。 */
  readonly workspaceMode: AgentWorkspaceMode;
  readonly input: string;
  readonly model: AgentModelBinding;
  readonly permissionProfileId: AgentPermissionProfileId;
  readonly executionHints?: AgentExecutionHints;
  readonly capabilityIds?: readonly string[];
  /** 当前持久会话 ID；Runtime Event 必须以它路由，禁止跨会话串流。 */
  readonly sessionId: string;
  readonly workspaceId: string;
  /** Work 画布等表现层提供给同一 Agent Core 的可编辑上下文。 */
  readonly workspaceContext?: string;
}

export type AgentInterventionDisposition = "steered" | "restarted";

export interface AgentInterventionRequest {
  readonly input: string;
  readonly workspaceContext?: string;
}

export interface AgentRunHandle {
  readonly runId: string;
  readonly sessionId: string;
}

/** Run 顶层阶段只描述可观察执行状态，不代表模型私有思维链。 */
export type AgentRunPhase = "starting" | "thinking" | "acting" | "responding" | "waiting";

/** Timeline 中可被 Chat / Work 共用的真实活动类别。 */
export type AgentActivityKind =
  | "model"
  | "reasoning"
  | "plan"
  | "command"
  | "file"
  | "search"
  | "mcp"
  | "tool"
  | "review"
  | "system";

export type AgentActivityStatus = "running" | "completed" | "failed" | "declined" | "interrupted";

export interface AgentRuntimeActivity {
  readonly id: string;
  readonly kind: AgentActivityKind;
  readonly title: string;
  readonly detail?: string;
  readonly status: AgentActivityStatus;
  readonly startedAt?: number;
  readonly completedAt?: number;
}

/**
 * Runtime Event 是 Chat / Work 运行过程的唯一真值。
 * reasoning.summary.delta 只能承载 Provider 明确提供给客户端展示的摘要，禁止转发原始隐藏 reasoning text。
 */
export type AgentRuntimeEvent =
  | { readonly type: "run.started"; readonly runId: string; readonly sessionId: string; readonly startedAt: number }
  | { readonly type: "run.phase.changed"; readonly runId: string; readonly sessionId: string; readonly phase: AgentRunPhase; readonly label?: string }
  | { readonly type: "run.intervention.accepted"; readonly runId: string; readonly sessionId: string; readonly input: string; readonly disposition: AgentInterventionDisposition }
  | { readonly type: "reasoning.summary.delta"; readonly runId: string; readonly sessionId: string; readonly delta: string }
  | { readonly type: "plan.updated"; readonly runId: string; readonly sessionId: string; readonly text: string }
  | { readonly type: "activity.started"; readonly runId: string; readonly sessionId: string; readonly activity: AgentRuntimeActivity }
  | { readonly type: "activity.output.delta"; readonly runId: string; readonly sessionId: string; readonly activityId: string; readonly delta: string }
  | { readonly type: "activity.completed"; readonly runId: string; readonly sessionId: string; readonly activity: AgentRuntimeActivity }
  | { readonly type: "assistant.delta"; readonly runId: string; readonly sessionId: string; readonly delta: string }
  | { readonly type: "assistant.completed"; readonly runId: string; readonly sessionId: string; readonly text: string }
  | { readonly type: "run.completed"; readonly runId: string; readonly sessionId: string; readonly completedAt: number }
  | { readonly type: "run.failed"; readonly runId: string; readonly sessionId: string; readonly error: string; readonly completedAt: number }
  | { readonly type: "run.cancelled"; readonly runId: string; readonly sessionId: string; readonly completedAt: number };

export type AgentRuntimeEventListener = (event: AgentRuntimeEvent) => void;

/** App Shell 只依赖这个端口，不知道 Codex/DSH/某模型 SDK 的实现细节。 */
export interface AgentRuntimeHost {
  startRun(request: AgentRunRequest): Promise<AgentRunHandle>;
  /** 进行中 Run 的人工干预：原生 steer 或同 Session 重启都由 Host 决定。 */
  interveneRun(runId: string, request: AgentInterventionRequest): Promise<{ readonly handle: AgentRunHandle; readonly disposition: AgentInterventionDisposition }>;
  cancelRun(runId: string): Promise<void>;
  subscribe(listener: AgentRuntimeEventListener): () => void;
}
