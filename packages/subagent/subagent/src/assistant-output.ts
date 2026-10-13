/**
 * 功能：助手输出组装——把结算结果格式化为给模型的最终文本。
 * 作用：成功直接返回答案；失败时给出结构化、不含密钥的失败说明，便于模型决定重试或上报。
 * 关联文件：run-settlement.ts、tool-subagent。
 */
import type { SettledOutcome } from "./run-settlement.js";

/** 组装一段模型可读的工具输出文本。 */
export function assembleAssistantOutput(outcome: SettledOutcome): string {
  if (outcome.ok) return outcome.text;
  return `[子任务未完成] 原因=${outcome.stopReason}${outcome.detail ? `；${outcome.detail}` : ""}${outcome.text ? `\n部分输出：\n${outcome.text}` : ""}`;
}
