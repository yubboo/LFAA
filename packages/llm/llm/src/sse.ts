/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：sse.ts（对应 DSH wire 适配层）
 * 功能：把 OpenAI 兼容的 SSE `data:` 流解析为 Provider 无关的 StreamChunk 序列。
 * 作用：统一处理 choice.delta 的 text / reasoning_content / tool_calls 增量，
 *   以及 usage 与 finish_reason，供 BlockAssembler 组装。
 * 关联文件：types.ts、assembler.ts、completion.ts（生产路径内联了等价逻辑）。
 */
import type { FinishReason, StreamChunk, TokenUsage } from "./types.js";

/** OpenAI 兼容 delta 中一个 tool_calls 项的形状（宽松判定）。 */
interface OpenAiToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiChoiceDelta {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: OpenAiToolCallDelta[] | null;
}

interface OpenAiChoice {
  delta?: OpenAiChoiceDelta;
  finish_reason?: string | null;
}

interface OpenAiChunkUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAiChunk {
  choices?: OpenAiChoice[];
  usage?: OpenAiChunkUsage | null;
}

/**
 * 把 finish_reason 字符串归一化为 FinishReason。
 * @param reason provider 给出的 finish_reason（可能为空）。
 */
export function finishReasonFromWire(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case "stop": return { kind: "stop" };
    case "tool_calls":
    case "tool_calls_parallel": return { kind: "tool-calls" };
    case "length": return { kind: "max-tokens" };
    case "error": return { kind: "error", message: "provider reported an error" };
    default: return { kind: "stop" };
  }
}

/** 把 OpenAI usage 对象桥接为 TokenUsage。 */
export function tokenUsageFromWire(usage: OpenAiChunkUsage | null | undefined): TokenUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    ...usage?.total_tokens !== undefined ? { totalTokens: usage.total_tokens } : {},
  };
}

/**
 * 从一个 OpenAI chunk JSON 对象产出结构化 StreamChunks。
 * 块下标由调用侧维护（与 completion.ts 的 toolCalls Map 对应）。
 * @param chunk 已解析的 OpenAI chunk。
 * @param blockIndex 当前文本块下标（provider 不编号，由调用侧递增）。
 */
export function streamChunksFromOpenAiChunk(chunk: OpenAiChunk): {
  chunks: StreamChunk[];
  usage?: TokenUsage;
  finish?: FinishReason;
} {
  const chunks: StreamChunk[] = [];
  const choice = chunk.choices?.[0];
  const delta = choice?.delta;

  if (delta?.content) chunks.push({ type: "text-delta", index: 0, text: delta.content });
  if (delta?.reasoning_content) chunks.push({ type: "reasoning-delta", index: 0, text: delta.reasoning_content });

  const toolCalls = delta?.tool_calls;
  if (Array.isArray(toolCalls)) {
    for (const call of toolCalls) {
      chunks.push({
        type: "tool-call-delta",
        index: (call.index ?? 0) + 1,
        id: call.id ?? "",
        ...call.function?.name ? { name: call.function.name } : {},
        argumentsDelta: call.function?.arguments ?? "",
      });
    }
  }

  return {
    chunks,
    ...chunk.usage ? { usage: tokenUsageFromWire(chunk.usage) } : {},
    ...choice?.finish_reason ? { finish: finishReasonFromWire(choice.finish_reason) } : {},
  };
}

/**
 * 消费 Response.body 的 SSE 字节流，逐段 yield `data:` 负载字符串。
 * 自动跳过 `data: [DONE]` 与注释行。
 * @param body fetch 返回的可读流。
 */
export async function* openAiSsePayloads(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      // SSE 以空行分隔事件；按行切分，保留未到换行的尾部。
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "" || payload === "[DONE]") continue;
        yield payload;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
