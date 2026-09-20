/**
 * 文件：contracts.ts
 * 作用：定义 Chat / Work 共用的 Agent Runtime 最小公共协议。
 * 负责：Run 输入、模型绑定、能力描述、Workspace Mode 与 UI ViewModel 基本类型。
 * 不负责：具体模型 SDK、Harness 进程、工具执行、数据库持久化。
 * 状态归属：Session/Run 真值未来归 Runtime/Event Store；UI 只能持有派生 ViewModel。
 * 对外接口：AgentRunRequest、AgentModelBinding、AgentCapabilityDescriptor 等。
 * 关联文件：permission-profiles.ts、harness/official-harnesses.ts、packages/app-shell。
 * 修改注意事项：Chat 与 Work 禁止新增不同的执行请求类型；二者只通过 workspaceMode 区分入口。
 */

import type { LfaaCapabilityDescriptor, LfaaCapabilityKind } from "@lfaa/plugin-sdk";
import type { AgentPermissionProfileId } from "./permission-profiles.ts";

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
  readonly workspaceMode: AgentWorkspaceMode;
  readonly input: string;
  readonly model: AgentModelBinding;
  readonly permissionProfileId: AgentPermissionProfileId;
  readonly executionHints?: AgentExecutionHints;
  /** 省略时由 Runtime Capability Registry 装配该工作区/模型的默认能力；UI 不自行挑选低配能力集。 */
  readonly capabilityIds?: readonly string[];
  readonly workspaceId: string;
}

export interface AgentRunHandle {
  readonly runId: string;
  readonly sessionId: string;
}

export type AgentRuntimeEvent =
  | { readonly type: "run.started"; readonly runId: string; readonly sessionId: string }
  | { readonly type: "assistant.completed"; readonly runId: string; readonly sessionId: string; readonly text: string }
  | { readonly type: "run.failed"; readonly runId: string; readonly sessionId: string; readonly error: string }
  | { readonly type: "run.cancelled"; readonly runId: string; readonly sessionId: string };

export type AgentRuntimeEventListener = (event: AgentRuntimeEvent) => void;

/**
 * App Shell 只依赖这个端口，不知道 Codex/DSH/某模型 SDK 的实现细节。
 * 未提供 Host 时 UI 必须显示“Runtime 未连接”，禁止本地伪造模型回复。
 */
export interface AgentRuntimeHost {
  startRun(request: AgentRunRequest): Promise<AgentRunHandle>;
  cancelRun(runId: string): Promise<void>;
  /** Runtime 事件是 Chat / Work 派生 ViewModel 的唯一执行结果来源；UI 不自己伪造模型回复。 */
  subscribe(listener: AgentRuntimeEventListener): () => void;
}
