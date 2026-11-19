// 上下文 token 估算：按 DSH token-meter 的固定密度口径（4 字符/token + 结构/角色开销）适配 LFAA 的扁平消息结构。
// 算法参考：@deepseek-ai/dsh-token-meter/estimate（MIT）；已用其源码实测 { role: "user", content: "hello world" } → 11。
import type { LlmMessage } from "@lfaa/llm";

/** 固定文本密度，与 DSH token-meter 相同。 */
export const CHARS_PER_TOKEN = 4;
/** 每个内容块的结构开销（JSON 框架与类型标签）。 */
export const BLOCK_OVERHEAD = 4;
/** 每条消息的角色字段开销。 */
export const ROLE_OVERHEAD = 4;

/** 系统提示词：文本密度 + 角色开销，无块开销（DSH 同口径）。 */
export function estimateSystemPromptTokens(content: string): number {
  if (!content) return 0;
  return Math.ceil(content.length / CHARS_PER_TOKEN) + ROLE_OVERHEAD;
}

/** 单条模型消息：正文块 + 推理块 + 工具调用参数，按固定密度估算。 */
export function estimateMessageTokens(message: LlmMessage): number {
  if (message.role === "system") return estimateSystemPromptTokens(message.content);
  let tokens = ROLE_OVERHEAD;
  if (message.content.length > 0) tokens += Math.ceil(message.content.length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
  if (message.reasoningContent) {
    tokens += Math.ceil(message.reasoningContent.length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
  }
  for (const call of message.toolCalls ?? []) {
    tokens += Math.ceil(call.name.length / CHARS_PER_TOKEN)
      + Math.ceil(call.argumentsJson.length / CHARS_PER_TOKEN)
      + BLOCK_OVERHEAD;
  }
  return tokens;
}

/** 工具 schema 部分：整段 JSON 密度 + 一个块开销（DSH 同口径）。 */
export function estimateToolsTokens(tools: ReadonlyArray<unknown>): number {
  if (tools.length === 0) return 0;
  return Math.ceil(JSON.stringify(tools).length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD;
}
