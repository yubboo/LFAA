// @lfaa/skills 技能文档与标识校验工具：负责 ID 合法性校验、slug 归一化以及 SKILL.md frontmatter 解析与组装。
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const SAFE_PERSONAL_SKILL_ID_RE = /^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5._-]{0,127}$/iu;

/** 默认未启用的内置技能（保留上游原目录便于后续更新，可在「技能中心」一键启用，避免默认上下文过载与触发冲突）。 */
export const DEFAULT_DISABLED_BUILTIN_IDS = new Set([
  "builtin:baseline-ui",
  "builtin:improve-ui",
  "builtin:write-swift",
  "builtin:animate-expo",
  "builtin:ask-sonner",
  "builtin:animation-vocabulary",
  "builtin:find-animation-opportunities",
  "builtin:improve-animations",
  "builtin:remove-animations",
  "builtin:learn-taste",
  "builtin:pick-ui-library",
  "builtin:prototype",
  "builtin:apple-design",
  "builtin:mobile-native",
]);

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

/** 解析 SKILL.md 顶部的 YAML frontmatter（提取 name 与 description，兼容多行块标量）。 */
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
  const lines = frontmatter.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    // 跳过缩进子字段（如 metadata 下的 author / version）
    if (/^\s/u.test(line)) continue;
    const sep = line.indexOf(":");
    if (sep <= 0) continue;
    const key = line.slice(0, sep).trim();
    if (key !== "name" && key !== "description") continue;
    let val = line.slice(sep + 1).trim();
    if (/^[|>][+-]?$/u.test(val) || val === "") {
      const blockLines: string[] = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1] ?? "";
        if (next.trim() === "") {
          i += 1;
          continue;
        }
        if (!/^\s+/u.test(next)) break;
        blockLines.push(next.trim());
        i += 1;
      }
      val = blockLines.join(" ").trim();
    } else {
      val = val.replace(/^["']|["']$/gu, "");
    }
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
