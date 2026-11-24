// @lfaa/skills 技能文档与标识校验工具：负责 ID 合法性校验、slug 归一化以及 SKILL.md frontmatter 解析与组装。
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const SAFE_PERSONAL_SKILL_ID_RE = /^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5._-]{0,127}$/iu;

/** 校验个人技能 ID 为单段安全目录名，防止路径穿越越出个人技能根目录。 */
export function assertSafePersonalSkillId(id: string, personalDir: string): string {
  const trimmed = id.trim();
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    !SAFE_PERSONAL_SKILL_ID_RE.test(trimmed)
  ) {
    throw new Error(`技能 ID 不合法：${id}`);
  }
  const targetDir = resolve(personalDir, trimmed);
  if (dirname(targetDir) !== resolve(personalDir)) {
    throw new Error(`技能 ID 越界：${id}`);
  }
  return targetDir;
}

/** 把用户输入的技能名称转成可用作目录名的短标识。 */
export function slugifySkillId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return cleaned || `skill-${randomUUID().slice(0, 8)}`;
}

/** 解析 SKILL.md 顶部的 YAML frontmatter（提取 name 与 description）。 */
export function parseSkillMarkdown(raw: string, fallbackName: string): { name: string; description: string; body: string } {
  const normalized = raw.replace(/\r\n/gu, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u);
  if (!match) {
    return { name: fallbackName, description: "", body: normalized };
  }
  const frontmatter = match[1] ?? "";
  const body = (match[2] ?? "").trimStart();
  let name = fallbackName;
  let description = "";
  for (const line of frontmatter.split("\n")) {
    const sep = line.indexOf(":");
    if (sep <= 0) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim().replace(/^["']|["']$/gu, "");
    if (key === "name" && val) name = val;
    if (key === "description" && val) description = val;
  }
  return { name, description, body };
}

/** 为缺少 frontmatter 的正文补齐标准 SKILL.md 头部。 */
export function buildSkillMarkdown(name: string, description: string, content: string): string {
  const trimmed = content.replace(/\r\n/gu, "\n").trimStart();
  if (trimmed.startsWith("---\n")) {
    return trimmed;
  }
  const safeDesc = description.replace(/\n+/gu, " ").trim();
  return `---\nname: ${name}\ndescription: ${safeDesc}\n---\n\n${trimmed}`;
}
