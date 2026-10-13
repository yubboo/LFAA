/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：assembler.ts
 * 功能：消费流式分片，组装为有序、冻结的内容块（含 tool-call 增量聚合）。
 * 作用：流式 UI 逐块渲染；同时为会话持久化与 token 计量产出稳定块序列。
 * 适配说明：id 用普通 string（不引入 dsh-brand 品牌类型）；块冻结用 Object.freeze。
 * 关联文件：types.ts、assistant-stream.ts。
 */
import type { ContentBlock, StreamChunk } from "./types.js";

type BlockAccumulator =
  | { readonly type: "text" | "reasoning"; text: string }
  | { readonly type: "tool-call"; id: string; name: string; arguments: string };

function freezeBlock(block: ContentBlock): ContentBlock {
  return Object.freeze(block);
}

/**
 * 把交错到达的流式分片组装成冻结块序列。
 * 同一个 assembler 实例对一次模型调用持有可变累积态；流式失败时不补结尾，仅按收到的前缀交付。
 */
export class BlockAssembler {
  private readonly accumulators: BlockAccumulator[] = [];

  /**
   * 消费一个分片并就地组装。未知块类型视为错误，拒绝累积。
   * @param chunk 流式协议分片。
   */
  push(chunk: StreamChunk): void {
    if (chunk.type === "block-start") {
      this.accumulators.push(this.blockStart(chunk.index, chunk.blockType));
    } else if (chunk.type === "text-delta") {
      this.pushText(chunk.index, chunk.text, "text");
    } else if (chunk.type === "reasoning-delta") {
      this.pushText(chunk.index, chunk.text, "reasoning");
    } else if (chunk.type === "tool-call-delta") {
      this.pushToolCall(chunk);
    }
    // block-end / usage / finish 不影响块累积（块结构由 start/delta 决定）。
  }

  /**
   * 到目前为止组装出的冻结块序列。
   * @returns 与当前累积状态无关的新数组，元素已冻结。
   */
  blocks(): readonly ContentBlock[] {
    return this.accumulators.map((accumulator) => this.buildBlock(accumulator));
  }

  private blockStart(index: number, blockType: ContentBlock["type"]): BlockAccumulator {
    if (index < 0) throw new Error(`block-start index must be non-negative, got ${index}`);
    if (index < this.accumulators.length) throw new Error(`block-start reuses taken index ${index}`);
    while (this.accumulators.length < index) {
      this.accumulators.push({ type: "text", text: "" });
    }
    if (blockType === "tool-call") {
      return { type: "tool-call", id: "", name: "", arguments: "" };
    }
    return { type: blockType, text: "" };
  }

  private pushText(index: number, text: string, expected: "text" | "reasoning"): void {
    const accumulator = this.accumulators[index];
    if (accumulator === undefined) throw new Error(`${expected} delta references block ${index} that was never started`);
    if (accumulator.type !== expected) throw new Error(`${expected} delta arrived for ${accumulator.type} block ${index}`);
    accumulator.text += text;
  }

  private pushToolCall(chunk: Extract<StreamChunk, { type: "tool-call-delta" }>): void {
    const accumulator = this.accumulators[chunk.index];
    if (accumulator === undefined) throw new Error(`tool-call delta references block ${chunk.index} that was never started`);
    if (accumulator.type !== "tool-call") throw new Error(`tool-call delta arrived for ${accumulator.type} block ${chunk.index}`);
    if (chunk.id !== "" && accumulator.id === "") accumulator.id = chunk.id;
    if (chunk.name !== undefined && chunk.name !== "" && accumulator.name === "") accumulator.name = chunk.name;
    accumulator.arguments += chunk.argumentsDelta;
  }

  private buildBlock(accumulator: BlockAccumulator): ContentBlock {
    if (accumulator.type === "tool-call") {
      return freezeBlock({ type: "tool-call", id: accumulator.id, name: accumulator.name, arguments: accumulator.arguments });
    }
    return freezeBlock({ type: accumulator.type, text: accumulator.text });
  }
}
