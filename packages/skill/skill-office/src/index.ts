/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-skill-office。
 *
 * 功能：内置 Office 文档 Skill Provider（docx/pptx/xlsx 三个 bundled Skill）。
 * 作用：经 ctx.skills.registerProvider 注册 provider "lfaa-office"，正文为 assets/ 下
 *       三个 SKILL.md（目录束格式），resourceBase 指向各 Skill 目录，正文里 references/scripts
 *       的相对路径可据此解析。
 * 关联文件：packages/skill/skill（注册表契约）、assets/scripts/check_office.py（只读结构校验脚本）。
 *
 * LFAA 与蓝本差异（中文说明）：
 * 1. 蓝本运行时拼接 LibreOffice Kit CLI 的绝对路径注入正文；LFAA store 无 libreoffice-kit，
 *    本包说明随包资源与本机依赖的区别，模型可按用户目标发现或安装真实依赖。
 * 2. 蓝本 frontmatter 用 yaml 包；LFAA 改用 js-yaml@4.3.2。
 * 3. provider 名由 dsh-office 改为 lfaa-office。
 */

import { readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import yaml from "js-yaml";
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillProvider,
} from "lfaa-skill";

const SKILL_NAMES = ["office-docx", "office-pptx", "office-xlsx"] as const;
const PROVIDER_NAME = "lfaa-office";

/** Cordis 插件名。 */
export const name = "skill-office";
/** 注册表 Provider 依赖。 */
export const inject = ["skills"];

/** 解析 SKILL.md 的 frontmatter，取出 description 与正文。 */
function parseSkill(raw: string, path: string): { description: string; content: string } {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (frontmatter?.[1] === undefined) throw new Error(`skill-office: ${path} has no YAML frontmatter`);
  const metadata: unknown = yaml.load(frontmatter[1]);
  const description = typeof metadata === "object" && metadata !== null && "description" in metadata
    ? (metadata as { description: unknown }).description
    : undefined;
  if (typeof description !== "string" || description.length === 0) {
    throw new Error(`skill-office: ${path} has no description`);
  }
  return { description, content: raw.slice(frontmatter[0].length).trim() };
}

/**
 * 注册 Office Skill。
 * @param ctx - 携带 Skill 注册表的 Context。
 */
export function apply(ctx: Context): void {
  // assets 与本源码同级（../assets/）；打包时随包发布。
  const assetRoot = fileURLToPath(new URL("../assets/", import.meta.url));
  if (!statSync(join(assetRoot, "scripts", "check_office.py")).isFile()) {
    throw new Error("skill-office: assets must contain scripts/check_office.py");
  }
  // LibreOffice Kit 未集成：固定说明，不拼接不存在的 CLI 路径。
  const runtimeNote = [
    "",
    "",
    "## Runtime note",
    "",
    "LibreOffice Kit CLI 未在本部署集成（LFAA 无 libreoffice-kit 依赖）：",
    "不代表目标主机没有文档处理能力。需要渲染、公式重算等操作时，使用本轮工具发现目标主机的 Python、Office/LibreOffice 或其他适用依赖，并核实真实执行结果。",
    "依赖缺失且完成用户目标需要安装时，安装动作按同一三种权限模式执行；不要向共享 Skill 资源目录写入依赖，不得虚构已安装或已渲染。",
  ].join("\n");
  const candidates: SkillCandidate[] = SKILL_NAMES.map((skillName) => {
    const directory = join(assetRoot, skillName);
    const path = join(directory, "SKILL.md");
    const { description } = parseSkill(readFileSync(path, "utf8"), path);
    return {
      name: skillName,
      description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: PROVIDER_NAME,
      source: "bundled",
      rank: BUNDLED_SKILL_RANK,
      resourceBase: { kind: "directory", path: directory },
      locator: path,
    };
  });
  const provider: SkillProvider = {
    name: PROVIDER_NAME,
    list: () => Promise.resolve(candidates),
    async get(candidate, options) {
      const raw = await readFile(candidate.locator as string, { encoding: "utf8", signal: options.signal });
      return {
        name: candidate.name,
        description: candidate.description,
        ...candidate.whenToUse !== undefined ? { whenToUse: candidate.whenToUse } : {},
        invocation: candidate.invocation,
        source: candidate.source,
        provider: PROVIDER_NAME,
        ...candidate.resourceBase !== undefined ? { resourceBase: candidate.resourceBase } : {},
        ...candidate.path !== undefined ? { path: candidate.path } : {},
        ...candidate.metadata !== undefined ? { metadata: candidate.metadata } : {},
        content: parseSkill(raw, candidate.locator as string).content + runtimeNote,
      };
    },
  };
  ctx.skills.registerProvider(() => provider);
}
