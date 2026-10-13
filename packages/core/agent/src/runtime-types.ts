/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 运行时类型绑定 Cordis Scoped 事件流；LFAA 保留选项/状态/收件箱接口契约，
 * 不依赖 DSH 的 LlmCallConfig/系统提示组装事件。
 *
 * 文件：runtime-types.ts
 * 功能：Agent 选项、取消选项、收件箱接口、生命周期状态。
 * 作用：model-selection 与未来 agent 运行器共用。
 */
import type { InboxTarget } from "./types.js";

/** 可合并扩展的 Agent 创建选项。 */
export interface AgentOptions {
  /** Provider 路由标识。 */
  provider?: string;
  /** 由所选 provider 解释的模型 id。 */
  model?: string;
  /** 每次对话模型请求的最大输出 token。 */
  maxTokens?: number;
}

/** Agent 生命周期状态：idle 无驱动；running 有可取消活动。 */
export type AgentStatus = "idle" | "running";

/** cancel 选项。 */
export interface CancelOptions {
  /** 保留已排队与转向收件箱而不是丢弃。 */
  keepInbox?: boolean;
}

/** Agent 拥有的待处理工作访问接口；具体存储由驱动负责。 */
export interface Inbox {
  /** 等待独立回合的提示。 */
  readonly nextTurn: readonly string[];
  /** 等待下一个步骤边界的输入。 */
  readonly nextStep: readonly string[];
  /** 清空全部待处理输入。 */
  clear(): void;
  /** 向某待处理列表追加一条。 */
  append(target: InboxTarget, message: string): void;
  /** 在某待处理列表头部插入一条。 */
  prepend(target: InboxTarget, message: string): void;
  /** 用标准 splice 语义改动待处理列表。 */
  splice(target: InboxTarget, start: number, deleteCount: number, inserted: string[]): string[];
}

/** 会话生命周期开始来源。 */
export type SessionStartSource = "startup" | "resume" | "clear" | "compact";
