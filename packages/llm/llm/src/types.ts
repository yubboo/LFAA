/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：types.ts
 * 功能：Provider 无关的流式词汇表（内容块、结束原因、流式分片、用量）。
 * 作用：把 OpenAI 兼容 SSE 增量归一化为统一的块流，供块组装器、token 计量与重试判定复用。
 * 适配说明：不依赖 DSH 的附件/品牌/会话时间戳体系；用量桥接 LFAA 现有 AiCompletionUsage。
 * 关联文件：completion.ts（生产路径）、assembler.ts、assistant-stream.ts、token-meter。
 */
import type { AiCompletionUsage } from "./completion.js";

/** 一段对用户可见的正文。 */
export interface TextBlock {
  type: "text";
  text: string;
}

/** 模型隐藏推理（thinking/reasoning），与可见正文区分。 */
export interface ReasoningBlock {
  type: "reasoning";
  text: string;
}

/** 模型发起的一次工具调用；id 用于与工具回执对应。 */
export interface ToolCallBlock {
  type: "tool-call";
  id: string;
  name: string;
  /** 模型产出的原始 JSON 参数字符串，不预先解析。 */
  arguments: string;
}

/** 任一已知内容块；新块类型应在此联合上扩展。 */
export type ContentBlock = TextBlock | ReasoningBlock | ToolCallBlock;

/** 模型结束本次输出的原因（可按 kind 穷举）。 */
export type FinishReason =
  | { kind: "stop" }
  | { kind: "tool-calls" }
  | { kind: "max-tokens" }
  | { kind: "aborted" }
  | { kind: "error"; message: string };

/**
 * 一次模型调用的 token 用量。计数为离散桶：inputTokens 不含缓存命中，
 * 缓存命中单列，避免把 provider 总量重复计价。
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * 把 LFAA 现有 AiCompletionUsage（promptTokens/completionTokens/cacheReadTokens，可空）桥接为 TokenUsage。
 * provider 未上报的计数记为 0，便于计量包做求和与完整性判定。
 */
export function tokenUsageFromCompletion(usage: AiCompletionUsage | null | undefined): TokenUsage {
  const promptTokens = usage?.promptTokens ?? 0;
  const cacheReadTokens = usage?.cacheReadTokens ?? null;
  const inputTokens = Math.max(0, promptTokens - (cacheReadTokens ?? 0));
  const outputTokens = usage?.completionTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens + (cacheReadTokens ?? 0),
    ...(cacheReadTokens !== null ? { cacheReadTokens } : {})
  };
}

/** 流式分片协议：适配器把 provider 增量翻译成这些事件；块下标关联交错增量。 */
export type StreamChunk =
  | { type: "block-start"; index: number; blockType: ContentBlock["type"] }
  | { type: "text-delta"; index: number; text: string }
  | { type: "reasoning-delta"; index: number; text: string }
  | { type: "tool-call-delta"; index: number; id: string; name?: string; argumentsDelta: string }
  | { type: "block-end"; index: number; block: ContentBlock }
  | { type: "usage"; usage: TokenUsage }
  | { type: "finish"; reason: FinishReason };

/** 一个工具的 JSON Schema，与发送给模型的 tools 字段一致。 */
export interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema 对象；不由本包校验，原样交给 Provider。 */
  parameters: Record<string, unknown>;
}

/** 结构化、可序列化的 Provider/传输失败事实；由重试策略决定是否可恢复。 */
export interface LlmFailure {
  message: string;
  /** Provider 无关的稳定机器码（RATE_LIMIT / SERVER / TIMEOUT / TRANSPORT / EMPTY_RESPONSE 等）。 */
  code: string;
  /** provider 返回的 HTTP 状态码（若有）。 */
  status?: number;
  /** provider 在 Retry-After 中要求的延迟（毫秒，若有）。 */
  providerRetryAfterMs?: number;
}
