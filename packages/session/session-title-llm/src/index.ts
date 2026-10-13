/**
 * 文件：index.ts
 * 功能：LLM 标题生成器——把用户输入压缩成一条紧凑指令，并把模型返回归一化为合法标题。
 * 作用：提供与具体 Provider 解耦的标题 seam；真正的模型调用由调用方传入 complete 回调完成。
 * 集成需要：把 complete 接到 lfaa-llm 的 streamAiCompletion 需要 account/settings/permissionMode 等运行时装配，
 *          该装配属于 agent-loop / settings 分片职责，本包不擅自读取密钥或构造 Provider 请求。
 * 边界：prompt 仅含用户可见输入文本；不在标题请求中携带系统提示、工具参数或凭证。
 * 关联文件：session-title（归一化）、session-title-first-prompt-llm、session-title-all-prompts-llm。
 */
import type { Context } from "@deepseek-ai/cordis";
import { normalizeSessionTitle } from "lfaa-session-title";

/** 文本补全 seam：给定系统+用户消息，返回模型产出文本。 */
export type TitleCompleter = (messages: ReadonlyArray<{ role: "system" | "user"; content: string }>) => Promise<string>;

const SYSTEM = "你是会话标题助手。根据用户输入给出一个不超过 12 个汉字、概括其意图的短标题。只输出标题本身，不要引号、标点前后缀或解释。";
/** 单条输入送进标题请求前的字节上限，避免长任务把标题请求撑爆。 */
const MAX_PROMPT_BYTES = 4000;

function clip(prompt: string): string {
  const normalized = prompt.replace(/\s+/gu, " ").trim();
  return Buffer.byteLength(normalized, "utf8") <= MAX_PROMPT_BYTES
    ? normalized
    : normalizeSessionTitle(normalized, MAX_PROMPT_BYTES);
}

/** 依据若干条用户输入构造标题请求消息。 */
export function buildTitleMessages(prompts: readonly string[]): Array<{ role: "system" | "user"; content: string }> {
  const combined = prompts.map(clip).filter(Boolean).join("\n");
  return [{ role: "system", content: SYSTEM }, { role: "user", content: combined || "（空会话）" }];
}

/** 调用 seam 生成标题；失败或返回空时由调用方回退本地规则。 */
export async function generateLlmTitle(prompts: readonly string[], complete: TitleCompleter): Promise<string> {
  const raw = await complete(buildTitleMessages(prompts));
  return normalizeSessionTitle(raw, 120);
}

export const name = "lfaaSessionTitleLlm";
export function apply(ctx: Context): void {
  ctx.provide(name, generateLlmTitle);
}
