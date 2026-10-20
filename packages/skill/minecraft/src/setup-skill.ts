/**
 * 功能：登记随 Minecraft 能力包发布的开服 Skill。
 * 作用：仅提供摘要和按需正文，复用 Skill Registry 生命周期，不执行外部脚本。
 * 关联文件：assets/minecraft-server-setup/SKILL.md、index.ts、skill/tool-skill。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import { BUNDLED_SKILL_RANK, type SkillCandidate } from "lfaa-skill";

export function registerMinecraftSetupSkill(ctx: Context): void {
  const directory = fileURLToPath(new URL("../assets/minecraft-server-setup/", import.meta.url));
  const path = fileURLToPath(new URL("../assets/minecraft-server-setup/SKILL.md", import.meta.url));
  const candidate: SkillCandidate = {
    name: "minecraft-server-setup", description: "Minecraft 自然语言开服、自动补齐 Java/核心、配置与失败恢复；以 LFAA 真实工具和就绪证据交付。",
    provider: "lfaa-minecraft", source: "bundled", rank: BUNDLED_SKILL_RANK,
    invocation: { modelInvocable: true, userInvocable: true }, resourceBase: { kind: "directory", path: directory }, locator: path
  };
  /** 注册表和扩展投影复用同一正文读取，不维护两份解析规则。 */
  const loadContent = async (signal?: AbortSignal): Promise<string> => {
    const raw = await readFile(path, { encoding: "utf8", signal });
    const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "").trim();
    if (!content) throw new Error("Minecraft 开服 Skill 正文缺失。");
    return content;
  };
  ctx.skills.registerProvider(() => ({
    name: candidate.provider, list: async () => [candidate],
    get: async (_candidate, options) => {
      return { ...candidate, content: await loadContent(options.signal) };
    }
  }));
  // 扩展面仅是同一 Provider 的摘要投影，既有插件/能力界面可见，正文不自动注入。
  ctx.get("aiExtensions")?.register(ctx, { id: "skill.minecraft-server-setup", skillId: candidate.name, pluginId: "lfaa-skill-minecraft", kind: "skill", name: "Minecraft 开服方法", version: "1.0.0", description: candidate.description, builtIn: true,
    loadInstructions: () => loadContent() });
}
