/**
 * 移植思路来自 deepseek-harness packages/core/agent-loop/src/assistant-stream.ts（MIT，commit 639ed01）。
 * LFAA 适配：DSH 版本把流式块落到 session surface 事件；LFAA 的 execute-turn 直接在内存里累加 delta。
 * 本模块抽出一个与 LFAA 现状等价、可单测的“流式助手块装配器”，避免逻辑散落在循环里。
 *
 * 文件：assistant-stream.ts
 * 功能：把模型流式 delta 折叠成结构化输出——累积文本块、识别工具调用分片、在 abort 时产出终止标记。
 * 作用：execute-turn 的 onDelta 回调只需把 delta 交给本装配器；装配器负责切分文本块与增量 tool_calls。
 * 不负责：真正发起 HTTP 流（那是 lfaa-llm.streamAiCompletion）；也不负责工具派发。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

/** 一条从流里解析出的助手消息（供回填到 completionMessages / 历史）。 */
export interface AssembledAssistantTurn {
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  aborted: boolean;
}

/**
 * 流式装配器。逐段喂 delta，维护当前文本与增量 tool_calls。
 * LFAA 的 OpenAI 兼容流里，tool_calls 的 function.arguments 是分片到达的字符串片段，需要按 index 累积。
 */
export class AssistantStreamAssembler {
  private textBuffer = "";
  private readonly toolCallBuffers = new Map<number, { id: string; name: string; arguments: string }>();
  private aborted = false;

  /** 喂入一段文本 delta。 */
  pushText(delta: string): void {
    if (delta) this.textBuffer += delta;
  }

  /**
   * 喂入一个 tool_calls 分片（OpenAI chunk.choices[0].delta.tool_calls[i]）。
   * index 用于配对同一调用的后续分片；id/name 在首片出现；arguments 逐片拼接。
   */
  pushToolCallChunk(chunk: { index: number; id?: string; name?: string; arguments?: string }): void {
    const existing = this.toolCallBuffers.get(chunk.index) ?? { id: "", name: "", arguments: "" };
    if (chunk.id) existing.id = chunk.id;
    if (chunk.name) existing.name = chunk.name;
    if (chunk.arguments) existing.arguments += chunk.arguments;
    this.toolCallBuffers.set(chunk.index, existing);
  }

  /** 标记流被中止。 */
  markAborted(): void {
    this.aborted = true;
  }

  /** 当前累积的纯文本。 */
  get text(): string {
    return this.textBuffer;
  }

  /** 是否已经收集到至少一个工具调用。 */
  get hasToolCalls(): boolean {
    return this.toolCallBuffers.size > 0;
  }

  /**
   * 装配成一条助手消息。被中止时：若尚无工具调用，则产出带部分文本的助手消息；
   * 若有工具调用，由调用方决定如何闭合（见 tool-calls.ts 的 abortSyntheticResults）。
   */
  toAssistantMessage(): AiCompletionMessage {
    const calls = [...this.toolCallBuffers.values()]
      .filter((call) => call.id && call.name)
      .map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      }));
    const content = this.textBuffer.length > 0 ? this.textBuffer : null;
    return calls.length > 0
      ? { role: "assistant", content, tool_calls: calls }
      : { role: "assistant", content };
  }

  /** 装配成 turn 结果（含 aborted 标记）。 */
  build(): AssembledAssistantTurn {
    const message = this.toAssistantMessage();
    return {
      text: typeof message.content === "string" ? message.content : "",
      toolCalls: (message.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })),
      aborted: this.aborted,
    };
  }
}
