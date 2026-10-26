/**
 * 移植自 deepseek-harness packages/compaction/compaction/src/types.ts（MIT, commit 639ed01）。
 * LFAA 适配：DSH 协议基于事件 surface 区间；LFAA 直接操作内存 AiCompletionMessage[]。
 * 本模块定义压缩协议的最小契约——与具体摘要策略、持久化解耦。
 *
 * 文件：types.ts
 * 功能：压缩触发原因、结果、区间选择的公共类型。
 * 作用：compaction-basic / image-offload / tool-result-pruner / command-compact 共享这些类型。
 */
import type { AiCompletionMessage, AiCompletionTool } from "lfaa-llm/src/completion.js";

/** 触发压缩的来源。 */
export type CompactionTrigger =
  | { reason: "pressure" }       // 上下文用量超阈值，自动触发
  | { reason: "manual"; commandId: string }  // /compact 之类用户命令
  | { reason: "spill-threshold" }; // 接近溢出阈值，主动压一次

/** 一次压缩的结果。 */
export interface CompactionResult {
  /** 改写后的完整消息数组（压缩段被替换为摘要消息）。 */
  messages: AiCompletionMessage[];
  /** 实际被压缩掉的旧消息数。 */
  compactedCount: number;
  /** 压缩后估算的已用 token。 */
  estimatedTokensAfter: number;
  /** 摘要文本。 */
  summary: string;
}

/**
 * 压缩会话适配接口：把“压缩一段历史”所需的最小能力抽象出来。
 * 实现负责选择区间、调用摘要、回填结果。LFAA 的 run-loop 只需面向此接口编程。
 */
export interface CompactionEngine {
  /**
   * 按压力自动压缩。返回 null 表示本次无需/未能压缩（历史太短、已取消等）。
   */
  compactIfNeeded(input: {
    messages: AiCompletionMessage[];
    /** Same request tools used for pressure estimates; summaries still never receive or execute tools. */
    tools?: AiCompletionTool[];
    /** Effective replay characters for this Provider/model, counted once in the request budget. */
    reasoningReplayCharacters?: number;
    contextWindow: number;
    trigger: CompactionTrigger;
    signal?: AbortSignal;
  }): Promise<CompactionResult | null>;
}
