/**
 * 移植自 deepseek-harness packages/compaction/command-compact（MIT, commit 639ed01）。
 * 压缩触发命令：用户显式要求“压缩一下上下文 / /compact”时，用这条命令构造一次手动压缩请求。
 *
 * 文件：index.ts
 * 功能：把用户命令转成 CompactionTrigger.manual，并返回调用引擎所需的输入。
 * 作用：与自动压力触发区分来源；手动压缩不受 pressure 阈值限制，总是尝试。
 * 不负责：真正执行摘要（compaction-basic）；也不负责命令解析的 UI 部分。
 */
import type { CompactionEngine, CompactionTrigger } from "lfaa-compaction/src/index.js";
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

/** 构造一次手动压缩触发（commandId 用于追踪是哪条用户命令触发的）。 */
export function manualCompactTrigger(commandId: string): Extract<CompactionTrigger, { reason: "manual" }> {
  return { reason: "manual", commandId };
}

/**
 * 执行一次手动压缩。与自动触发不同：不看阈值，直接让引擎压缩当前历史。
 * 返回引擎结果；引擎返回 null 表示无可压缩内容。
 */
export async function runManualCompact(input: {
  engine: CompactionEngine;
  messages: AiCompletionMessage[];
  contextWindow: number;
  commandId: string;
  signal?: AbortSignal;
}) {
  return input.engine.compactIfNeeded({
    messages: input.messages,
    contextWindow: input.contextWindow,
    trigger: manualCompactTrigger(input.commandId),
    ...(input.signal ? { signal: input.signal } : {})
  });
}

/** Cordis 服务：导出手动压缩辅助函数集。 */
import type { Context } from "@deepseek-ai/cordis";
export const name = "lfaaCommandCompact";
export const inject = [] as const;
export function apply(ctx: Context): void {
  ctx.provide(name, { manualCompactTrigger, runManualCompact });
}
