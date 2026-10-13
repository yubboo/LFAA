/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：stream.ts
 * 功能：豆包流式响应解析——复用 lfaa-llm 的 SSE 原语，把 Ark OpenAI 兼容 SSE 归一为 StreamChunk。
 * 作用：统一处理 reasoning_content 隐藏推理与 tool_calls 增量。
 * 关联文件：lfaa-llm sse.ts（openAiSsePayloads/streamChunksFromOpenAiChunk）、assembler.ts。
 */
import { openAiSsePayloads, streamChunksFromOpenAiChunk } from "lfaa-llm/src/sse.js";
import { BlockAssembler } from "lfaa-llm/src/assembler.js";

/** 解析一次 Ark SSE 流，组装为可见块。 */
export async function consumeArkStream(body: ReadableStream<Uint8Array>): Promise<{
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}> {
  const assembler = new BlockAssembler();
  for await (const payload of openAiSsePayloads(body)) {
    let parsed: unknown;
    try { parsed = JSON.parse(payload) as unknown; } catch { continue; }
    const { chunks } = streamChunksFromOpenAiChunk(parsed as Parameters<typeof streamChunksFromOpenAiChunk>[0]);
    for (const chunk of chunks) assembler.push(chunk);
  }
  const blocks = assembler.blocks();
  return {
    text: blocks.filter((block) => block.type === "text").map((block) => block.type === "text" ? block.text : "").join(""),
    toolCalls: blocks.flatMap((block) => block.type === "tool-call" ? [{ id: block.id, name: block.name, arguments: block.arguments }] : [])
  };
}
