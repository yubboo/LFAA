/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：context.ts
 * 功能：豆包模型上下文窗口占用估算与剩余量计算。
 * 作用：在压缩/截断决策前给出近似上下文压力；精确计数以 Provider 真实 usage 为准。
 * 关联文件：lfaa-token-meter（启发式估算）、catalog.ts（模型窗口）。
 */
import type { AiCompletionMessage, AiCompletionTool } from "lfaa-llm/src/completion.js";
import { estimatePromptTokens } from "lfaa-token-meter/src/estimate.js";
import { lookupDoubaoCapability } from "./catalog.js";

/** 一次上下文占用评估结果。 */
export interface ContextPressure {
  modelId: string;
  contextWindow: number;
  estimatedPromptTokens: number;
  /** 剩余可塞下的 token（可能为负，代表已超限）。 */
  remainingTokens: number;
  /** 占用比例 0..1+。 */
  ratio: number;
}

/**
 * 估算某模型处理一批消息时的上下文压力。
 * @param modelId 模型/推理接入点 ID。
 * @param messages 对话消息。
 * @param tools 工具列表。
 */
export function evaluateContextPressure(
  modelId: string,
  messages: readonly AiCompletionMessage[],
  tools?: readonly AiCompletionTool[]
): ContextPressure {
  const capability = lookupDoubaoCapability(modelId);
  const contextWindow = capability?.contextWindow ?? 128_000;
  const estimatedPromptTokens = estimatePromptTokens(messages, tools);
  const remainingTokens = contextWindow - estimatedPromptTokens;
  return {
    modelId,
    contextWindow,
    estimatedPromptTokens,
    remainingTokens,
    ratio: contextWindow > 0 ? estimatedPromptTokens / contextWindow : 1
  };
}
