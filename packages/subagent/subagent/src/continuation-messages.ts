/**
 * 功能：构造续接消息——把后续指令拼接到原任务上下文上。
 * 作用：外部驱动/进程内子 Agent 看不到父会话历史，续接消息必须自包含：先复述原任务，再追加新指令。
 * 关联文件：continuation.ts、inbox.ts。
 */

/** 一条排队中的续接消息。 */
export interface ContinuationMessage {
  readonly at: string;
  readonly followup: string;
}

/** 由原任务正文与后续指令拼出一条自包含的续接 prompt。 */
export function buildContinuationPrompt(originalPrompt: string, followups: readonly ContinuationMessage[]): string {
  const lines = ["## 此前任务", originalPrompt.trim()];
  for (const item of followups) lines.push(`## 后续补充（${item.at}）`, item.followup.trim());
  return lines.join("\n\n");
}
