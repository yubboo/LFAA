/**
 * 移植思路来自 deepseek-harness packages/core/agent-loop/src/tool-calls.ts（MIT，commit 639ed01）。
 * LFAA 适配：DSH 版本把工具派发写成 session 事件；LFAA 直接在 completionMessages 上回填 tool 结果。
 * 本模块抽出与 LFAA 现有 execute-turn 内联逻辑等价的纯函数，便于复用与单测。
 *
 * 文件：tool-calls.ts
 * 功能：工具调用结果回填、中止/取消时的合成 fail-closed 结果、调用-结果成对校验。
 * 作用：execute-turn 派发工具后用 appendToolResult() 回填；中止时用 synthesizeAbortResults() 闭合未决调用。
 * 不负责：真正执行工具（那是 lfaa-tools / lfaa-user-approval）。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

/** 把一条工具执行结果回填到消息数组末尾（role=tool，带 tool_call_id）。 */
export function appendToolResult(input: {
  messages: AiCompletionMessage[];
  callId: string;
  content: string;
  isError?: boolean;
}): AiCompletionMessage[] {
  input.messages.push({
    role: "tool",
    tool_call_id: input.callId,
    content: input.content,
  });
  return input.messages;
}

/**
 * 从一条 assistant 消息里取出它声明的所有 tool_call id。
 * 用于在回填结果前确认“该等哪些结果”。
 */
export function declaredToolCallIds(assistantMessage: AiCompletionMessage): string[] {
  if (assistantMessage.role !== "assistant" || !Array.isArray(assistantMessage.tool_calls)) return [];
  return assistantMessage.tool_calls.map((call) => call.id);
}

/**
 * 校验消息数组里 assistant 的每个 tool_call 都已被对应 tool 结果闭合。
 * 返回未闭合的 callId 列表（空数组 = 全部成对）。这是发给模型前的一致性闸门。
 */
export function unclosedToolCalls(messages: readonly AiCompletionMessage[]): string[] {
  const pending = new Set<string>();
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) pending.add(call.id);
    } else if (message.role === "tool" && message.tool_call_id) {
      pending.delete(message.tool_call_id);
    }
  }
  return [...pending];
}

/**
 * 中止/取消时，为所有尚未收到结果的工具调用合成一条 fail-closed 的 tool 结果。
 * 这样下一次请求（或历史落盘）不会留下“悬空的 tool_calls”导致 API 400。
 * 对齐 DSH：不假装成功，明确说明副作用状态未知、禁止盲目重放。
 */
export function synthesizeAbortResults(input: {
  messages: AiCompletionMessage[];
  reason?: "interrupted" | "cancelled";
}): AiCompletionMessage[] {
  const open = unclosedToolCalls(input.messages);
  if (open.length === 0) return input.messages;
  const cause = input.reason === "cancelled" ? "用户取消" : "运行中止";
  for (const callId of open) {
    input.messages.push({
      role: "tool",
      tool_call_id: callId,
      content: JSON.stringify({
        error: `${cause}发生在工具派发之后；结果未持久化，副作用状态未知，禁止盲目重放。`,
      }),
    });
  }
  return input.messages;
}
