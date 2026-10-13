/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：provider.ts
 * 功能：豆包 Provider 接口：chat/completions + 流式。
 * 作用：对外暴露豆包 Provider 的统一事实；实际请求由 lfaa-llm 的 streamAiCompletion 发出
 *   （OpenAI 兼容 SSE），本模块只汇总本包各子能力，避免重复实现 HTTP。
 * 关联文件：lfaa-llm completion.ts（streamAiCompletion）、adapter.ts、discovery.ts。
 */
import type { AiCompletionMessage, AiCompletionResult, AiCompletionTool } from "lfaa-llm/src/completion.js";
import { DOUBAO_CATALOG } from "./catalog.js";
import { buildArkChatRequest } from "./adapter.js";

/** 豆包 Provider 对外能力面。 */
export interface DoubaoProvider {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly chatUrl: string;
  /** 构造一次 chat 请求体（供 lfaa-llm/测试使用）。 */
  buildRequest: (modelId: string, messages: AiCompletionMessage[], maxTokens: number, tools?: AiCompletionTool[]) => unknown;
}

/** 构造豆包 Provider 能力对象。 */
export function createDoubaoProvider(): DoubaoProvider {
  return Object.freeze({
    providerId: DOUBAO_CATALOG.providerId,
    baseUrl: DOUBAO_CATALOG.baseUrl,
    chatUrl: DOUBAO_CATALOG.chatUrl,
    buildRequest: (modelId: string, messages: AiCompletionMessage[], maxTokens: number, tools?: AiCompletionTool[]) => buildArkChatRequest(modelId, messages, maxTokens, tools)
  });
}

/** 流式结果类型别名（与 lfaa-llm 对齐）。 */
export type DoubaoStreamResult = AiCompletionResult;
