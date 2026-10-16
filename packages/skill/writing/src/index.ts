/**
 * 功能：将既有写作方法接入共享 Skill 注册表。
 * 作用：目录只持有摘要，正文按模型指定名称加载；保留原方法 ID，不复制作品数据。
 * 关联文件：catalog.ts、writing-skills.ts、skill/tool-skill。
 */
import type { Context } from "@deepseek-ai/cordis";
import { BUNDLED_SKILL_RANK, type SkillCandidate } from "lfaa-skill";
import { WRITING_SKILL_CATALOG } from "./catalog.js";
export const name = "lfaaWritingSkills";
export const inject = ["skills"];
export function apply(ctx: Context): void {
  const candidates: SkillCandidate[] = WRITING_SKILL_CATALOG.map(entry => ({ name: entry.id, description: entry.description, invocation: { modelInvocable: true, userInvocable: true }, source: "bundled", provider: "lfaa-writing", rank: BUNDLED_SKILL_RANK, resourceBase: { kind: "opaque", description: "写作内置方法，作品内容由 Writing Owner 读取" }, locator: entry.id }));
  // 保留原稳定扩展 ID；摘要和正文仍引用同一个方法 Owner。
  for (const entry of WRITING_SKILL_CATALOG) ctx.get("aiExtensions")?.register(ctx, { id: "skill.writing." + entry.id, pluginId: "lfaa-skill-writing", kind: "skill", name: entry.name, description: entry.description, version: "1.0.0", builtIn: true,
    loadInstructions: async () => { const source = await import("./writing-skills.js"); const skill = source.getWritingSkill(entry.id); if (!skill) throw new Error("写作 Skill 正文缺失。"); return skill.instructions; } });
  ctx.skills.registerProvider(() => ({ name: "lfaa-writing", list: async () => candidates, get: async (candidate, options) => {
    options.signal?.throwIfAborted();
    const { getWritingSkill } = await import("./writing-skills.js");
    const skill = getWritingSkill(String(candidate.locator));
    if (!skill) return undefined;
    return { ...candidate, content: skill.instructions };
  } }));
}
