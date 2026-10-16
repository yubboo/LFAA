/**
 * 功能：writing 内置提示词的可撤销登记。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：catalog.ts、prompt/prompt、领域正文库。
 */
import type { Context } from "@deepseek-ai/cordis";
import { PROMPT_CATALOG } from "./catalog.js";
export const name = "lfaaPromptWriting";
export const inject = ["aiExtensions"];
export function apply(ctx: Context): void {
  ctx.aiExtensions.register(ctx, { id: "prompt.writing.writing-controller", pluginId: "lfaa-prompt-writing", kind: "prompt", name: "写作控制与作品修改", version: "1.0.0", description: "讨论与保存、当前作品/章节、局部修改、提案和真实结果的完整写作方法。", builtIn: true,
    loadInstructions: async () => (await import("./prompts.js")).writingSystemInstruction() });
  for (const entry of PROMPT_CATALOG) ctx.aiExtensions.register(ctx, { id: "prompt.writing." + entry.id, pluginId: "lfaa-prompt-writing", kind: "prompt", name: entry.name, version: "1.0.0", description: entry.description, builtIn: true, loadInstructions: async () => {
    const source = await import("./writing-prompt-library.js");
    const prompt = source.getWritingPrompt(entry.id);
    if (!prompt) throw new Error("提示词正文未登记。");
    return prompt.instructions;
  } });
}
