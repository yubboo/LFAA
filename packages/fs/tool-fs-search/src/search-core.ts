/**
 * 功能：本机文件搜索内核——不依赖 fast-glob / ripgrep，仅用 node:fs 递归实现。
 * 作用：为 tool-fs-search 提供「按文件名 glob 找文件」与「按内容 grep 找行」两种只读能力。
 * 安全与资源边界：
 *  - 跳过 node_modules/.git/dist 等无关目录，限制最大递归深度，避免遍历爆炸；
 *  - 每个文件只读前 1 MiB，命中 NUL 字节即当二进制跳过；
 *  - 结果条数设硬上限（默认 50 条命中 / 文件清单默认 200 条），防止把海量结果灌进上下文。
 * 关联文件：src/index.ts、packages/fs/fs-local/src/paths.ts。
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

/** 默认忽略的目录名（精确匹配 basename），避免遍历依赖产物与 VCS 内部目录。 */
const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", ".cache",
  ".venv", "venv", "__pycache__", ".idea", ".vscode", "target", ".turbo"
]);

export const SEARCH_MAX_DEPTH = 8;
export const SEARCH_FILE_BYTES = 1024 * 1024;
export const GREP_MAX_MATCHES = 50;
export const GLOB_MAX_FILES = 200;

/** 把极简 glob（只支持 * 与 ?）编译成正则；其余字符转义。 */
function globToRegExp(pattern: string): RegExp {
  let rx = "";
  for (const ch of pattern) {
    if (ch === "*") rx += ".*";
    else if (ch === "?") rx += ".";
    else rx += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${rx}$`, "i");
}

export interface WalkOptions {
  readonly root: string;
  readonly maxDepth?: number;
  readonly extraIgnore?: ReadonlySet<string>;
}

/** 递归收集所有普通文件的绝对路径（带深度与忽略规则）。 */
export async function walkFiles(opts: WalkOptions): Promise<string[]> {
  const maxDepth = Math.min(opts.maxDepth ?? SEARCH_MAX_DEPTH, SEARCH_MAX_DEPTH);
  const ignore = opts.extraIgnore ?? new Set<string>();
  const collected: string[] = [];
  async function dive(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || collected.length >= GLOB_MAX_FILES * 4) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // 无权限等：跳过该目录。
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(entry.name) || ignore.has(entry.name)) continue;
        await dive(join(dir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        collected.push(join(dir, entry.name));
      }
    }
  }
  await dive(opts.root, 0);
  return collected;
}

/** 按文件名 glob 搜索：返回相对展示路径（由调用方传 displayPath 转换）。 */
export async function searchByFilename(root: string, glob: string): Promise<string[]> {
  const files = await walkFiles({ root });
  const regex = globToRegExp(glob);
  const matched = files.filter((file) => regex.test(file.split(/[\\/]/).pop() ?? ""));
  return matched.slice(0, GLOB_MAX_FILES);
}

export interface GrepMatch {
  readonly path: string;
  readonly lineNumber: number;
  readonly line: string;
}

/** 内容搜索：在 root 下递归找含 query 的文本行。query 以 /.../ 包裹时按正则解析，否则按字面包含。 */
export async function grepContents(root: string, rawQuery: string): Promise<{ matches: GrepMatch[]; truncated: boolean }> {
  const files = await walkFiles({ root });
  let matcher: (line: string) => boolean;
  let patternError: string | null = null;
  const regexMatch = rawQuery.match(/^\/(.*)\/([gimsuy]*)$/);
  if (regexMatch) {
    try {
      matcher = (line) => new RegExp(regexMatch[1], regexMatch[2].replace("g", "")).test(line);
    } catch {
      patternError = `正则无效：${rawQuery}`;
      matcher = () => false;
    }
  } else {
    const needle = rawQuery.toLowerCase();
    matcher = (line) => line.toLowerCase().includes(needle);
  }
  if (patternError) throw new Error(patternError);

  const matches: GrepMatch[] = [];
  for (const file of files) {
    if (matches.length >= GREP_MAX_MATCHES) break;
    let info;
    try {
      info = await stat(file);
    } catch {
      continue;
    }
    if (info.size > SEARCH_FILE_BYTES) continue;
    let buffer: Buffer;
    try {
      buffer = await readFile(file);
    } catch {
      continue;
    }
    if (buffer.includes(0)) continue; // 二进制跳过。
    const text = buffer.toString("utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (matcher(lines[i])) {
        matches.push({ path: file, lineNumber: i + 1, line: lines[i].slice(0, 300) });
        if (matches.length >= GREP_MAX_MATCHES) break;
      }
    }
  }
  return { matches, truncated: matches.length >= GREP_MAX_MATCHES };
}
