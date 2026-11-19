// 工作区遍历过滤器：统一忽略目录、应用私有路径与超限文件，供文件检索类工具复用。
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { createPrivatePathFilter } from "./sandbox";

/** 检索时跳过的依赖与构建目录。 */
export const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo"]);

/** 枚举出的工作区文件及其相对路径。 */
export interface WorkspaceFileEntry {
  path: string;
  size: number;
  relativePath: string;
}

export interface WalkWorkspaceOptions {
  signal: AbortSignal;
  /** 单个文件体积上限，超过则不读取（默认 512 KB）。 */
  maxBytes?: number;
  /** 最多收集的文件数（默认 5000）。 */
  maxFiles?: number;
  maxDepth?: number;
}

/** 深度优先枚举工作区文件；跳过忽略目录、私有路径、符号链接与超限文件。 */
export async function walkWorkspaceFiles(
  rootDir: string,
  options: WalkWorkspaceOptions,
): Promise<WorkspaceFileEntry[]> {
  const maxBytes = options.maxBytes ?? 512 * 1024;
  const maxFiles = options.maxFiles ?? 5000;
  const maxDepth = options.maxDepth ?? 12;
  const isPrivate = await createPrivatePathFilter();
  const files: WorkspaceFileEntry[] = [];

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (files.length >= maxFiles || options.signal.aborted || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles || options.signal.aborted) break;
      // 不跟随符号链接，避免借链接逃出授权目录。
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (isPrivate(full)) continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) await walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const info = await stat(full);
        if (info.size > maxBytes) continue;
        files.push({ path: full, size: info.size, relativePath: relative(rootDir, full) || entry.name });
      } catch {
        // 遍历期间失效或被占用的文件直接跳过。
      }
    }
  };

  await walk(rootDir, 0);
  return files;
}
