/**
 * 移植自 DeepSeek Harness dsh-token-meter（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：estimate.ts
 * 功能：固定密度的启发式 token 估算（在精确 tokenizer 不可用时使用）。
 * 作用：压缩决策、上下文预算、日志展示在拿到 provider 真实 usage 前做粗估。
 * 适配说明：DSH 版本基于其会话事件重放系统；LFAA 无该体系，本模块只移植纯启发式估算，
 *   直接适配 LFAA 的 AiCompletionMessage / AiCompletionTool 形状。
 * 关联文件：lfaa-llm completion.ts、usage.ts。
 */
import type { AiCompletionMessage, AiCompletionTool } from "lfaa-llm/src/completion.js";

/** 固定文本密度：约每 4 个字符 1 个 token。 */
export const CHARS_PER_TOKEN = 4;
/** 每个角色消息的结构化帧开销。 */
export const ROLE_OVERHEAD = 4;

/**
 * 估算一段文本的 token 数。
 * @param text 原始文本。
 */
export function estimateText(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * 估算一条 LFAA 消息的 token 数（含角色帧开销）。
 * @param message 模型可见消息，不改写。
 */
export function estimateMessage(message: AiCompletionMessage): number {
  let characters = 0;
  const content = message.content;
  if (typeof content === "string") {
    characters = content.length;
  } else if (Array.isArray(content)) {
    for (const part of content) {
      characters += part.type === "text" ? part.text.length : 0;
    }
  }
  return Math.ceil(characters / CHARS_PER_TOKEN) + ROLE_OVERHEAD;
}

/**
 * 估算工具 schema（JSON）占用的 token 数。
 * @param tools 本次请求携带的工具列表。
 */
export function estimateToolSchemas(tools: readonly AiCompletionTool[] | undefined): number {
  if (!tools || tools.length === 0) return 0;
  return Math.ceil(JSON.stringify(tools).length / CHARS_PER_TOKEN) + ROLE_OVERHEAD;
}

/**
 * 一次性估算整轮请求的提示 token（系统/历史消息 + 工具 schema）。
 * @param messages 模型可见消息序列。
 * @param tools 工具列表。
 */
export function estimatePromptTokens(messages: readonly AiCompletionMessage[], tools?: readonly AiCompletionTool[]): number {
  let total = estimateToolSchemas(tools);
  for (const message of messages) total += estimateMessage(message);
  return total;
}
