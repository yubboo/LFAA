/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 类型绑定 session-projection/typert；LFAA 用自己的会话事件词汇（kernel.ts）。
 *
 * 文件：types.ts
 * 功能：Agent 句柄、收件箱目标、回合/步骤边界投影等公共类型。
 * 作用：runtime-types/model-selection/consumed-work 共用这些类型。
 */

/** 两个有序待处理消息列表之一。 */
export type InboxTarget = "next-turn" | "next-step";

/** 待处理收件箱的完整状态。 */
export interface InboxState {
  readonly "next-turn": readonly string[];
  readonly "next-step": readonly string[];
}

/** 公共活 Agent 句柄。 */
export interface Agent {
  /** 会话背书的 Agent 身份。 */
  readonly id: string;
}

/**
 * 从一个 Agent 会话日志折叠出的回合与步骤边界。
 * 无 agent-loop 时视为“无开放回合/无边界”——能力缺失而非状态损坏。
 */
export interface TurnBoundaryProjection {
  /** 开放回合的 turnId；回合间为 null。 */
  readonly openTurnId: string | null;
  /** 最近一次 step/start 的步骤号；首个步骤前为 null。 */
  readonly lastStep: number | null;
  /** 最近回合号。 */
  readonly lastTurn: number;
}
