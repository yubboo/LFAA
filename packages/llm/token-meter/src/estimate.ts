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

// 图片块的视觉 token 由 Provider 决定；这里给一个保守固定值，避免大图请求完全不进预算。
const IMAGE_TOKEN_ESTIMATE = 1_200;

function estimateContextMessage(message: AiCompletionMessage, includeReplay = true): { tokens: number; includesImages: boolean } {
  let characters = 0;
  let imageCount = 0;
  const content = message.content;
  if (typeof content === "string") {
    characters = content.length;
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "text") characters += part.text.length;
      else imageCount += 1;
    }
  }
  characters += message.role.length;
  if (Array.isArray(message.tool_calls)) {
    characters += JSON.stringify(message.tool_calls).length;
  }
  if (typeof message.tool_call_id === "string") characters += message.tool_call_id.length;
  if (includeReplay && message.providerReplay) characters += message.providerReplay.reasoningContent.length;
  return {
    tokens: Math.ceil(characters / CHARS_PER_TOKEN) + ROLE_OVERHEAD + imageCount * IMAGE_TOKEN_ESTIMATE,
    includesImages: imageCount > 0
  };
}

/**
 * 估算一条 LFAA 消息的 token 数（含角色帧、工具往返、图片和续接文本）。
 * @param message 模型可见消息，不改写。
 */
export function estimateMessage(message: AiCompletionMessage): number {
  return estimateContextMessage(message).tokens;
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
export function estimatePromptTokens(messages: readonly AiCompletionMessage[], tools?: readonly AiCompletionTool[], reasoningReplayCharacters?: number): number {
  return estimateContextBreakdown(messages, tools, reasoningReplayCharacters).estimatedPromptTokens;
}

export interface ContextBreakdownEstimate {
  estimatedPromptTokens: number;
  systemTokens: number;
  toolsTokens: number;
  messageTokens: number;
  includesImages: boolean;
}

/**
 * Estimate the current request's prompt composition without a model call. When provided,
 * reasoningReplayCharacters replaces raw replay lengths on messages with the LLM Owner's
 * verified count for the selected account, Provider, and model.
 * Image payload tokens are provider-specific; use a coarse per-image reserve,
 * flag the estimate, and replace it with actual Provider usage when available.
 */
export function estimateContextBreakdown(
  messages: readonly AiCompletionMessage[],
  tools?: readonly AiCompletionTool[],
  reasoningReplayCharacters?: number
): ContextBreakdownEstimate {
  const hasExplicitReplayEstimate = typeof reasoningReplayCharacters === "number"
    && Number.isSafeInteger(reasoningReplayCharacters) && reasoningReplayCharacters >= 0;
  let systemTokens = 0;
  let messageTokens = 0;
  let includesImages = false;
  for (const message of messages) {
    const estimate = estimateContextMessage(message, !hasExplicitReplayEstimate);
    if (message.role === "system") systemTokens += estimate.tokens;
    else messageTokens += estimate.tokens;
    includesImages ||= estimate.includesImages;
  }
  if (hasExplicitReplayEstimate && reasoningReplayCharacters > 0) {
    messageTokens += Math.ceil(reasoningReplayCharacters / CHARS_PER_TOKEN);
  }
  const toolsTokens = estimateToolSchemas(tools);
  return { estimatedPromptTokens: systemTokens + toolsTokens + messageTokens, systemTokens, toolsTokens, messageTokens, includesImages };
}
