/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：assistant-stream.ts
 * 功能：流式分片的可见性判定与文本拼接助手。
 * 作用：UI/日志只展示 text-delta（隐藏 reasoning），或拼接整段可见正文。
 * 适配说明：LFAA 会话持久化为函数式记录，不移植 DSH 的 compact 时间戳累加器；
 *   本模块只暴露 Provider 无关的纯函数判定，供消费方自行选择渲染策略。
 * 关联文件：types.ts、assembler.ts、completion.ts。
 */
import type { ContentBlock, StreamChunk } from "./types.js";

/** 任何携带非空文本增量的分片（可见正文与隐藏推理都算）。 */
export function isTokenDelta(chunk: StreamChunk): boolean {
  return (chunk.type === "text-delta" && chunk.text !== "")
    || (chunk.type === "reasoning-delta" && chunk.text !== "");
}

/** 只有面向用户的 text-delta（不含 reasoning）。 */
export function isVisibleChunk(chunk: StreamChunk): boolean {
  return chunk.type === "text-delta" && chunk.text !== "";
}

/** 该分片是否携带面向用户的文本。 */
export function chunkHasVisibleText(chunk: StreamChunk): boolean {
  return chunk.type === "text-delta";
}

/** 拼接一组内容块的可见正文（忽略 reasoning 与 tool-call）。 */
export function joinBlocksText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter((block): block is TextBlockLike => block.type === "text")
    .map((block) => block.text)
    .join("");
}

interface TextBlockLike {
  type: "text";
  text: string;
}
