/**
 * 移植参考：DeepSeek Harness dsh-token-meter（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：index.ts
 * 功能：token-meter 插件入口，登记 token 估算与用量累计服务。
 * 关联文件：estimate.ts、usage.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { estimatePromptTokens } from "./estimate.js";
import { UsageAccumulator } from "./usage.js";
export {
  CHARS_PER_TOKEN,
  ROLE_OVERHEAD,
  estimateText,
  estimateMessage,
  estimateToolSchemas,
  estimatePromptTokens
} from "./estimate.js";
export { UsageAccumulator } from "./usage.js";
export type { UsageSummary } from "./usage.js";

/** token 计量服务：暴露估算原语与累加器工厂。 */
export interface TokenMeterService {
  estimatePromptTokens: typeof estimatePromptTokens;
  createAccumulator: () => UsageAccumulator;
}

export const name = "lfaaTokenMeter";
export const inject = [] as const;

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaTokenMeter: TokenMeterService }
}

/** Cordis 装配：登记 token 计量服务。 */
export function apply(ctx: Context): void {
  ctx.provide(name, Object.freeze({
    estimatePromptTokens,
    createAccumulator: () => new UsageAccumulator()
  }));
}
