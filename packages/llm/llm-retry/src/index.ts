/**
 * 移植参考：DeepSeek Harness dsh-llm-retry（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：index.ts
 * 功能：llm-retry 插件入口，登记通用 LLM 重试执行器服务。
 * 关联文件：executor.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { withRetry, type RetryExecutorOptions } from "./executor.js";

export { withRetry } from "./executor.js";
export type { RetryAttemptInfo, RetryExecutorOptions } from "./executor.js";

/** 重试执行器服务：直接暴露 withRetry。 */
export interface LlmRetryService {
  withRetry: <T>(operation: () => Promise<T>, options?: RetryExecutorOptions) => Promise<T>;
}

export const name = "lfaaLlmRetry";
export const inject = [] as const;

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaLlmRetry: LlmRetryService }
}

/** Cordis 装配：登记重试执行器服务。 */
export function apply(ctx: Context): void {
  ctx.provide(name, Object.freeze({ withRetry }));
}
