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
// 图片块的视觉 token 由 Provider 决定；这里给一个保守固定值，避免大图请求完全不进预算。
const IMAGE_TOKEN_ESTIMATE = 1_200;

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

export interface ContextBreakdownEstimate {
  estimatedPromptTokens: number;
  systemTokens: number;
  toolsTokens: number;
  messageTokens: number;
  includesImages: boolean;
}

function estimateContextMessage(message: AiCompletionMessage): { tokens: number; includesImages: boolean } {
  let characters = message.role.length;
  let includesImages = false;
  if (typeof message.content === "string") characters += message.content.length;
  else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "text") characters += part.text.length;
      else includesImages = true;
    }
  }
  if (Array.isArray(message.tool_calls)) characters += message.tool_calls.reduce((sum, call) => sum + call.function.name.length + call.function.arguments.length, 0);
  if (typeof message.tool_call_id === "string") characters += message.tool_call_id.length;
  return { tokens: Math.ceil(characters / CHARS_PER_TOKEN) + ROLE_OVERHEAD + (includesImages ? IMAGE_TOKEN_ESTIMATE : 0), includesImages };
}

/**
 * Estimate the current request's prompt composition without a model call.
 * Image payload tokens are provider-specific, so the result flags requests
 * containing images and leaves their visual token cost to actual usage.
 */
export function estimateContextBreakdown(messages: readonly AiCompletionMessage[], tools?: readonly AiCompletionTool[]): ContextBreakdownEstimate {
  let systemTokens = 0;
  let messageTokens = 0;
  let includesImages = false;
  for (const message of messages) {
    const estimate = estimateContextMessage(message);
    if (message.role === "system") systemTokens += estimate.tokens;
    else messageTokens += estimate.tokens;
    includesImages ||= estimate.includesImages;
  }
  const toolsTokens = estimateToolSchemas(tools);
  return { estimatedPromptTokens: systemTokens + toolsTokens + messageTokens, systemTokens, toolsTokens, messageTokens, includesImages };
}
