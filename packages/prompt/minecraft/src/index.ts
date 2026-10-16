/**
 * 功能：minecraft 内置提示词的可撤销登记。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：catalog.ts、prompt/prompt、领域正文库。
 */
import type { Context } from "@deepseek-ai/cordis";
import { PROMPT_CATALOG } from "./catalog.js";
export const name = "lfaaPromptMinecraft";
export const inject = ["aiExtensions"];
export function apply(ctx: Context): void {
  for (const entry of PROMPT_CATALOG) ctx.aiExtensions.register(ctx, { id: "prompt.minecraft." + entry.id, pluginId: "lfaa-prompt-minecraft", kind: "prompt", name: entry.name, version: "1.0.0", description: entry.description, builtIn: true, loadInstructions: async () => {
    const source = await import("./minecraft-prompt-library.js");
    const prompt = source.getMinecraftPrompt(entry.id);
    if (!prompt) throw new Error("提示词正文未登记。");
    return prompt.instructions;
  } });
}
