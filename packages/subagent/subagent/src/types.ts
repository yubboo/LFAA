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
  /** 外部进程取消时委托唯一 Process Owner 终止进程树。 */
  readonly terminateProcessTree?: (pid: number) => Promise<KillTreeResult>;
  /** 运行轨迹进度回报。 */
  readonly onProgress: (detail: string) => void;
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
}

/** 已注册的一种子代理执行后端。驱动是同进程可信实现，各自隔离运行期可变状态。 */
export interface SubagentDriver {
  /** 唯一驱动名（如 in-process / claude-code / codex）。 */
  readonly name: string;
  /** 模型可见的中文显示名。 */
  readonly displayName: string;
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
  readonly startedAt: string;
  status: "running" | "completed" | "aborted" | "error";
  /** 父级取消；同时转发给驱动的内部 AbortController。 */
  cancel(): void;
  /** 终态 Promise。 */
  readonly done: Promise<SubagentRunResult>;
}
