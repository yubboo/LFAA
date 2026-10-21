/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：adapter.ts
 * 功能：豆包 Provider 的 OpenAI 兼容请求体/响应适配（含思考字段映射）。
 * 作用：把 LFAA 通用对话输入翻译为 Ark chat/completions 报文；Ark 与 OpenAI 协议基本一致，
 *   仅思考参数与 max_tokens 字段名需按模型能力映射。
 * 关联文件：lfaa-llm completion.ts（实际发请求）、models.ts（思考档位）。
 */
import type { AiCompletionMessage, AiCompletionTool, AiCompletionUsage } from "lfaa-llm/src/completion.js";

/** 一次豆包对话请求的报文片段（不含 system，system 由 lfaa-llm 统一组装）。 */
export interface ArkChatRequest {
  model: string;
  messages: AiCompletionMessage[];
  stream: true;
  max_tokens: number;
  tools?: AiCompletionTool[];
  tool_choice?: "auto";
  /** 思考参数（仅模型支持且档位非默认时下发）。 */
  thinking?: { type: "enabled" | "disabled" };
}

/**
 * 构造 Ark chat 请求体。
 * @param modelId 模型/推理接入点 ID。
 * @param messages 对话消息。
 * @param maxTokens 输出上限（Ark 用 max_tokens）。
 * @param tools 工具列表。
 * @param thinkingEnabled 是否开启思考。
 */
export function buildArkChatRequest(
  modelId: string,
  messages: AiCompletionMessage[],
  maxTokens: number,
  tools?: AiCompletionTool[],
  thinkingEnabled?: boolean
): ArkChatRequest {
  const request: ArkChatRequest = {
    model: modelId,
    messages,
    stream: true,
    max_tokens: maxTokens,
    ...(tools?.length ? { tools, tool_choice: "auto" as const } : {}),
    ...thinkingEnabled === undefined ? {} : { thinking: { type: thinkingEnabled ? "enabled" : "disabled" } }
  };
  return request;
}

/** 从 Ark 响应 usage 提取 LFAA 用量。 */
export function readArkUsage(raw: unknown): AiCompletionUsage {
  if (typeof raw !== "object" || raw === null) return { promptTokens: null, completionTokens: null, cacheReadTokens: null };
  const usage = raw as Record<string, unknown>;
  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  const details = typeof usage.prompt_tokens_details === "object" && usage.prompt_tokens_details !== null
    ? usage.prompt_tokens_details as Record<string, unknown>
    : null;
  const nestedCacheReadTokens = details?.cached_tokens;
  const cacheMissTokens = usage.prompt_cache_miss_tokens;
  const validCacheCount = (candidate: unknown): candidate is number => typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0;
  return {
    promptTokens: typeof promptTokens === "number" ? promptTokens : null,
    completionTokens: typeof completionTokens === "number" ? completionTokens : null,
    cacheReadTokens: validCacheCount(usage.prompt_cache_hit_tokens)
      ? usage.prompt_cache_hit_tokens
      : validCacheCount(nestedCacheReadTokens) ? nestedCacheReadTokens
        : validCacheCount(cacheMissTokens) && typeof promptTokens === "number" && Number.isSafeInteger(promptTokens) && promptTokens >= cacheMissTokens ? promptTokens - cacheMissTokens : null
  };
}
