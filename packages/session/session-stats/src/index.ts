/**
 * 文件：index.ts
 * 功能：会话统计——从消息行与用量行折叠出消息数、角色分布与 token 用量。
 * 作用：给列表、诊断与配额展示提供同一组聚合口径。
 * 边界：只聚合计数与 Provider 真实返回的 token 数，不估算费用、不含正文内容。
 * 关联文件：session-projection、ai_usage 表、core/session/sessions.ts。
 * 移植说明：字段取向参考 DSH session-stats 的 whole-log 统计思路，按 LFAA 的 ai_messages/ai_usage 实现。
 */
import type { Context } from "@deepseek-ai/cordis";

/** 一个会话的折叠统计结果。 */
export interface SessionStats {
  /** 消息总行数（用户 + 助手）。 */
  readonly messageCount: number;
  readonly userMessages: number;
  readonly assistantMessages: number;
  /** 状态为 complete 的助手消息数（视为完成的轮次）。 */
  readonly completedAssistantMessages: number;
  /** 用量记录条数（Provider 请求次数）。 */
  readonly usageRecords: number;
  /** 累计提示 token（无记录时为 null）。 */
  readonly promptTokens: number | null;
  /** 累计补全 token（无记录时为 null）。 */
  readonly completionTokens: number | null;
}

function sumTokens(usageRows: readonly Record<string, unknown>[], key: "prompt_tokens" | "completion_tokens"): number | null {
  const values = usageRows.map(row => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

/** 纯函数：折叠消息行与用量行。调用方负责按会话取行。 */
export function computeSessionStats(messages: readonly Record<string, unknown>[], usage: readonly Record<string, unknown>[]): SessionStats {
  let userMessages = 0, assistantMessages = 0, completedAssistantMessages = 0;
  for (const row of messages) {
    if (row.role === "user") userMessages += 1;
    else if (row.role === "assistant") {
      assistantMessages += 1;
      if (row.status === "complete") completedAssistantMessages += 1;
    }
  }
  return {
    messageCount: messages.length,
    userMessages,
    assistantMessages,
    completedAssistantMessages,
    usageRecords: usage.length,
    promptTokens: sumTokens(usage, "prompt_tokens"),
    completionTokens: sumTokens(usage, "completion_tokens")
  };
}

export const name = "lfaaSessionStats";
export function apply(ctx: Context): void {
  ctx.provide(name, computeSessionStats);
}
