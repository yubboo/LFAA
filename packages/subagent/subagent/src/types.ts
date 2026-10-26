/**
 * 功能：子代理（subagent）委派的消费者侧契约类型。
 * 作用：定义任务、结果、运行句柄与驱动（driver）接口，供模型工具层与各类驱动实现共享。
 * 设计：以 LFAA 自身的应用身份与运行上下文为准，不依赖 DeepSeek Harness 的 Agent/Session 内部类型。
 * 关联文件：manager.ts、tool-subagent、tool-subagent-control、各驱动包。
 */
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { UserRole } from "lfaa-identity-auth/src/service.js";
import type { KillTreeResult } from "lfaa-win32-process";

/** 一次子代理任务的终态原因；非 completed 一律由工具层映射为失败结果。 */
export type SubagentStopReason = "completed" | "aborted" | "error" | "timeout";

/** 一个外部 Agent SDK 即将执行的工具动作；授权由调用方的 Permission Owner 决定。 */
export interface SubagentToolActionRequest {
  readonly toolUseId: string;
  readonly toolName: string;
  readonly toolVersion: string;
  readonly risk: "read" | "write" | "dangerous";
  readonly scopeKey: string;
  readonly scopeSummary: string;
  readonly summary: string;
  readonly parameters: unknown;
  /** SDK operation signal; it is not persisted as approval parameters. */
  readonly signal: AbortSignal;
}

/** External drivers expose only the parent Agent Loop's current JSON Schema tool scope. */
export interface SubagentToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export type SubagentToolContent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly mimeType: string; readonly data: string };

export interface SubagentToolDispatchResult {
  readonly content: readonly SubagentToolContent[];
  readonly isError?: boolean;
}

/** 模型委派下来的一个自包含子任务。 */
export interface SubagentTask {
  /** 目标驱动名，如 in-process / claude-code / codex。 */
  readonly driver: string;
  /** 简短展示标签（3-8 词）。 */
  readonly description: string;
  /** 完整、自包含的任务正文；外部驱动看不到父会话历史。 */
  readonly prompt: string;
  /** 发起所在的 LFAA 应用。 */
  readonly appId: ApplicationId;
  /** 创建此任务的 Agent Loop Run；由工具上下文注入，不接受模型参数伪造。 */
  readonly parentRunId?: string;
}

/** 子任务执行的运行上下文，由调用方（模型工具）提供，禁止从模型参数伪造。 */
export interface SubagentDriverContext {
  /** 由父 Run 在校验预算后提供，驱动只能通过它创建继承范围的子 Run。 */
  readonly startChild?: (signal?: AbortSignal) => Promise<{ status: string; [key: string]: unknown }>;
  /** 发起账户。 */
  readonly userId: string;
  /** 发起角色；进程内驱动据此调用既有 Run 系统。 */
  readonly userRole: UserRole;
  /** 父运行取消信号；触发时驱动必须终止子任务。 */
  readonly signal: AbortSignal;
  /** 外部驱动使用的可信本机工作目录，由 AgentGit Owner 从当前 Session 绑定注入；禁止回退到宿主 cwd。 */
  readonly workingDirectory?: string;
  /** 当前 Session 绑定的 AgentGit 仓库身份，防止记忆授权跨仓库复用。 */
  readonly repositoryId?: string;
  /** 由父 Agent Loop 按设置计算的剩余模型请求预算。 */
  readonly maxModelRequests?: number;
  /** 外部 SDK 的每个工具动作必须先调用此 Permission Owner 桥。 */
  readonly authorizeAction?: (request: SubagentToolActionRequest) => Promise<boolean>;
  /** Exact tool contracts inherited from the parent Run. */
  readonly tools?: readonly SubagentToolDefinition[];
  /** External tool actions return to the parent Agent Loop's shared dispatcher. */
  readonly executeTool?: (request: { toolName: string; arguments: unknown; signal: AbortSignal }) => Promise<SubagentToolDispatchResult>;
  /** 外部进程取消时委托唯一 Process Owner 终止进程树。 */
  readonly terminateProcessTree?: (pid: number) => Promise<KillTreeResult>;
  /** 运行轨迹进度回报。 */
  readonly onProgress: (detail: string) => void;
  /** 外部 SDK 顶层助手文本的短期增量；不包含 thinking/工具参数，且不写入子任务记录。 */
  readonly onTextDelta?: (delta: string) => void;
}

/** 一个子代理任务的终态结果；永远 resolve，不向调用方抛运行级失败。 */
export interface SubagentRunResult {
  /** 子任务运行标识。 */
  readonly runId: string;
  /** 终态原因。 */
  readonly stopReason: SubagentStopReason;
  /** 子任务最终回答文本；失败时可为空或部分输出。 */
  readonly answer: string;
  /** 驱动侧、不含工具参数/密钥的失败诊断，最长 4096 字节。 */
  readonly diagnostic?: string;
  /** Latest SDK-reported model turns, used to account against the parent run's model-request budget. */
  readonly modelRequestsUsed?: number;
  /** Provider-reported aggregate token usage by model; omitted when the driver cannot validate it. */
  readonly modelUsage?: readonly {
    readonly providerId: string;
    readonly modelId: string;
    readonly promptTokens: number | null;
    readonly completionTokens: number | null;
    readonly cacheReadTokens: number | null;
  }[];
}

/** 已注册的一种子代理执行后端。驱动是同进程可信实现，各自隔离运行期可变状态。 */
export interface SubagentDriver {
  /** 唯一驱动名（如 in-process / claude-code / codex）。 */
  readonly name: string;
  /** 模型可见的中文显示名。 */
  readonly displayName: string;
  /** 驱动所需的执行合同尚未接入时，登记为不可运行并说明能力缺口。 */
  readonly available?: boolean;
  readonly unavailableReason?: string;
  /** 执行一次一次性子任务；收到 ctx.signal 取消时必须尽快终止并 settled 为 aborted。 */
  run(task: SubagentTask, ctx: SubagentDriverContext): Promise<SubagentRunResult>;
}

/** 一个被追踪的活动子任务句柄，供列表/取消控制工具使用。 */
export interface SubagentRunHandle {
  readonly runId: string;
  readonly driver: string;
  readonly description: string;
  readonly userId: string;
  readonly appId: ApplicationId;
  readonly parentRunId?: string;
  readonly startedAt: string;
  status: "running" | "completed" | "aborted" | "error";
  /** 父级取消；同时转发给驱动的内部 AbortController。 */
  cancel(): void;
  /** 终态 Promise。 */
  readonly done: Promise<SubagentRunResult>;
}
