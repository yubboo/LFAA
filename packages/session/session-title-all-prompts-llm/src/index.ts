/**
 * 文件：index.ts
 * 功能：综合全部用户输入生成 LLM 标题。
 * 作用：会话多轮后标题漂移时，用累计用户输入重新概括主题。
 * 关联文件：session-title-llm、session-title-first-prompt-llm。
 */
import type { Context } from "@deepseek-ai/cordis";
import { generateLlmTitle, type TitleCompleter } from "lfaa-session-title-llm";

/** 用全部非空用户输入生成标题。 */
export async function generateAllPromptsTitle(prompts: readonly string[], complete: TitleCompleter): Promise<string> {
  return generateLlmTitle(prompts, complete);
}

export const name = "lfaaSessionTitleAllPromptsLlm";
export function apply(ctx: Context): void {
  ctx.provide(name, generateAllPromptsTitle);
}
