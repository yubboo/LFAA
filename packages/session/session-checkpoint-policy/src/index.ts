/**
 * 文件：index.ts
 * 功能：会话检查点策略——判定何时该为长会话落一个显式检查点。
 * 作用：给上下文管理（compaction/spill 分片）提供一个与格式无关的触发阈值。
 * 边界：只做阈值判定，不执行压缩、不读密钥；阈值默认保守，避免频繁检查点。
 * 关联文件：core/session、compaction 分片（集成需要接线）。
 */
import type { Context } from "@deepseek-ai/cordis";

/** 检查点输入。 */
export interface CheckpointInput {
  /** 已提交消息数。 */
  readonly messageCount: number;
  /** 累计已观测 token（未知传 null）。 */
  readonly observedTokens: number | null;
}

/** 默认阈值：每 24 条消息或 24k token 触发一次检查点。 */
export const CHECKPOINT_DEFAULTS = { messages: 24, tokens: 24000 } as const;

/** 纯函数：是否达到检查点阈值。 */
export function shouldCheckpoint(input: CheckpointInput, thresholds = CHECKPOINT_DEFAULTS): boolean {
  if (input.messageCount >= thresholds.messages) return true;
  if (input.observedTokens !== null && input.observedTokens >= thresholds.tokens) return true;
  return false;
}

export const name = "lfaaSessionCheckpointPolicy";
export function apply(ctx: Context): void {
  ctx.provide(name, shouldCheckpoint);
}
