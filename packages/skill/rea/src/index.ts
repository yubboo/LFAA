/**
 * 功能：提供 REA 逆向分析方法的 bundled Skill。
 * 作用：目录只暴露摘要，正文按需读取；MCP 工具仍由用户设置和 MCP Runtime 管理。
 * 关联文件：assets/reverse-engineer-anything/SKILL.md、lfaa-skill、lfaa-agent。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import { BUNDLED_SKILL_RANK, type SkillCandidate } from "lfaa-skill";

const skillName = "reverse-engineer-anything";
const skillDescription = "用 REA MCP 按证据追踪软件功能、模块、调用路径与二进制行为；区分观察、推断、未知和限制。";

export const name = "lfaaReaSkill";
export const inject = ["skills", "aiExtensions"];

export function apply(ctx: Context): void {
  const directory = fileURLToPath(new URL("../assets/reverse-engineer-anything/", import.meta.url));
  const path = fileURLToPath(new URL("../assets/reverse-engineer-anything/SKILL.md", import.meta.url));
  const candidate: SkillCandidate = {
    name: skillName,
    description: skillDescription,
    provider: "lfaa-rea",
    source: "bundled",
    rank: BUNDLED_SKILL_RANK,
    invocation: { modelInvocable: true, userInvocable: true },
    resourceBase: { kind: "directory", path: directory },
    locator: path
  };
  const loadContent = async (signal?: AbortSignal): Promise<string> => {
    const raw = await readFile(path, { encoding: "utf8", signal });
    const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "").trim();
    if (!content) throw new Error("REA 逆向分析 Skill 正文缺失。");
    return content;
  };
  ctx.skills.registerProvider(() => ({
    name: candidate.provider,
    list: async () => [candidate],
    get: async (_candidate, options) => ({ ...candidate, content: await loadContent(options.signal) })
  }));
  ctx.get("aiExtensions")?.register(ctx, {
    id: "skill.rea.reverse-engineer-anything",
    skillId: skillName,
    pluginId: "lfaa-skill-rea",
    kind: "skill",
    name: "REA 逆向分析工作流",
    version: "1.0.0",
    description: skillDescription,
    builtIn: true,
    loadInstructions: () => loadContent()
  });
}
