/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 会话不变量校验：序号、表面边界、工具配对的运行时断言。
 * 实现权威在 kernel.ts；本模块按 DSH 形态导出可调用断言。
 *
 * 文件：invariant.ts
 * 功能：assertValidSessionSeq / assertBalancedToolCalls。
 */
import type { SessionModelMessage } from "./kernel.js";

/** 断言一个值是合法的正安全整数会话序号。 */
export function assertValidSessionSeq(value: number): asserts value is number {
  if (!Number.isSafeInteger(value) || value < 1 || Object.is(value, -0)) {
    throw new Error("会话序号必须是正安全整数。");
  }
}

/**
 * 断言一条消息序列里 assistant 的每个 tool_call 都有对应 tool 结果闭合。
 * 发模型前调用；悬空调用会导致 Provider 400。
 */
export function assertBalancedToolCalls(messages: readonly SessionModelMessage[]): void {
  const open = new Set<string>();
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) open.add(call.id);
    } else if (message.role === "tool" && message.tool_call_id) {
      open.delete(message.tool_call_id);
    }
  }
  if (open.size > 0) {
    throw new Error(`会话消息存在 ${open.size} 个未闭合的工具调用，禁止发往模型。`);
  }
}
