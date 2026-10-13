/**
 * 文件：index.ts
 * 功能：登记本地规则标题服务 lfaaSessionTitle。
 * 作用：在没有 LLM 可用或被用户改钉时，用确定性规则生成/清洗会话标题。
 * 关联文件：normalize.ts、session-title-llm。
 */
import type { Context } from "@deepseek-ai/cordis";
import { fallbackSessionTitle, normalizeSessionTitle } from "./normalize.js";

export * from "./normalize.js";

/** 本地规则标题服务。 */
export interface SessionTitleService {
  /** 由首条用户输入生成回退标题。 */
  readonly fromFirstPrompt: (prompt: string) => string;
  /** 清洗任意来源标题（含 LLM 返回）。 */
  readonly normalize: (title: string) => string;
}

export const name = "lfaaSessionTitle";
export function apply(ctx: Context): void {
  const service: SessionTitleService = {
    fromFirstPrompt: prompt => fallbackSessionTitle(prompt) || "新对话",
    normalize: title => normalizeSessionTitle(title)
  };
  ctx.provide(name, service);
}
