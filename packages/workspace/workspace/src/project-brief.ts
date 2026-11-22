// 依据项目目录生成项目简介初稿：只读 README/清单与顶层条目，结果确定、可离线测试，不写文件也不调用模型。
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DraftProjectBriefResult } from "../contract";

/** 项目简介上限，避免把整段 README 塞进系统提示。 */
export const MAX_PROJECT_BRIEF_CHARS = 500;

const README_CANDIDATES = ["README.md", "README.zh.md", "README", "readme.md"] as const;
const MAX_ENTRIES = 6;
const MAX_SUMMARY_CHARS = 220;
const IGNORED_ENTRIES = new Set([
  "node_modules", ".git", "dist", "build", "out", "target", ".next", ".turbo", ".cache",
  "coverage", ".idea", ".vscode", ".DS_Store",
]);

/** 去掉代码块、front matter 与 Markdown 标记，得到可读正文。 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/^---[\s\S]*?---/u, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/[#>*`_~]/gu, " ")
    .replace(/\r/gu, "");
}

/** 取第一段有信息量的正文；跳过标题残留、语言切换行与纯符号。 */
export function firstReadableParagraph(text: string): string {
  const plain = stripMarkdown(text);
  const chunks = plain
    .split(/\n\s*\n/u)
    .map((chunk) => chunk.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  const picked = chunks.find((chunk) =>
    chunk.length >= 8
    && !/^(english\s*\|.*|中文|[\w@/.-]+)$/iu.test(chunk)
    && /[\u4e00-\u9fa5a-z]/iu.test(chunk)
  );
  return (picked ?? "").slice(0, MAX_SUMMARY_CHARS);
}

/** 读取清单里的项目描述，作为 README 缺失时的补充依据。 */
async function readPackageDescription(rootPath: string): Promise<string> {
  const raw = await readFile(join(rootPath, "package.json"), "utf8").catch(() => "");
  if (!raw.trim()) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return "";
    const description = (parsed as { description?: unknown }).description;
    return typeof description === "string" ? description.replace(/\s+/gu, " ").trim().slice(0, MAX_SUMMARY_CHARS) : "";
  } catch {
    return "";
  }
}

/** 列出顶层目录与文件，供简介快速交代项目构成。 */
async function listTopLevelEntries(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);
  const visible = entries
    .filter((entry) => !IGNORED_ENTRIES.has(entry.name) && !entry.name.startsWith("."))
    .sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name));
  return visible.slice(0, MAX_ENTRIES).map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
}

/** 生成项目简介初稿；目录不可读或为空时给出可编辑的兜底文案。 */
export async function draftProjectBrief(name: string, rootPath: string): Promise<DraftProjectBriefResult> {
  const projectName = name.trim() || "当前项目";
  const sources: string[] = [];
  const root = rootPath.trim();
  let summary = "";

  if (root) {
    for (const file of README_CANDIDATES) {
      const paragraph = firstReadableParagraph(await readFile(join(root, file), "utf8").catch(() => ""));
      if (!paragraph) continue;
      summary = paragraph;
      sources.push(file);
      break;
    }
    if (!summary) {
      summary = await readPackageDescription(root);
      if (summary) sources.push("package.json");
    }
  }

  const entries = root ? await listTopLevelEntries(root) : [];
  if (entries.length) sources.push("目录条目");

  const head = summary || "本机项目目录，尚未填写项目目标与交付范围";
  const parts = [`「${projectName}」：${head.replace(/[。.；;]+$/u, "")}`];
  if (entries.length) parts.push(`主要包含：${entries.join("、")}`);
  return {
    brief: `${parts.join("。")}。`.slice(0, MAX_PROJECT_BRIEF_CHARS),
    sources,
  };
}