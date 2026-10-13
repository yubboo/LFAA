/**
 * 文件：index.ts
 * 功能：仅用首条用户输入生成 LLM 标题。
 * 作用：新会话刚开第一轮就想要标题时，只喂第一条 prompt，避免后续轮次干扰主题。
 * 关联文件：session-title-llm、session-title-all-prompts-llm。
 */
import type { Context } from "@deepseek-ai/cordis";
import { generateLlmTitle, type TitleCompleter } from "lfaa-session-title-llm";

/** 取首条非空用户输入生成标题。 */
export async function generateFirstPromptTitle(prompts: readonly string[], complete: TitleCompleter): Promise<string> {
  const first = prompts.find(prompt => prompt.trim().length > 0) ?? "";
  return generateLlmTitle([first], complete);
}

export const name = "lfaaSessionTitleFirstPromptLlm";
export function apply(ctx: Context): void {
  ctx.provide(name, generateFirstPromptTitle);
}
