// 项目目录只读检视与文本文件安全预览：严格校验授权根目录边界并拦截符号链接越界与二进制文件。
// 关联：packages/workspace/workspace/src/index.ts；运行环境：Node.js Host。
import { open, readdir, realpath, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { isWithinRoot, resolveWithinProjectRoots } from "./project-records";
import type { WorkspaceDirectoryEntry, WorkspaceInspection, WorkspaceProjectSummary } from "./types";

const MAX_TREE_ENTRIES = 200;
const MAX_PREVIEW_FILE_BYTES = 256 * 1024;

/** 对已登记的项目目录（及其任意子目录）执行只读检查，严格限制在项目根目录边界内。 */
export async function inspectProjectDirectory(
  project: WorkspaceProjectSummary,
  requestedRootPath?: string,
): Promise<WorkspaceInspection> {
  const resolved = resolveWithinProjectRoots(project, requestedRootPath);
  const targetRoot = resolved ? resolved.resolvedPath : project.rootPath;

  const rootInfo = await stat(targetRoot).catch(() => null);
  if (!rootInfo || !rootInfo.isDirectory()) {
    return {
      projectId: project.id,
      rootPath: targetRoot,
      exists: false,
      directoryCount: 0,
      fileCount: 0,
      entries: [],
    };
  }

  const dirEntries = await readdir(targetRoot, { withFileTypes: true });
  const entries: WorkspaceDirectoryEntry[] = [];
  let directoryCount = 0;
  let fileCount = 0;

  for (const entry of dirEntries) {
    const isDir = entry.isDirectory();
    const isFile = entry.isFile();
    if (!isDir && !isFile) continue;
    if (isDir) directoryCount += 1;
    else fileCount += 1;

    if (entries.length >= MAX_TREE_ENTRIES) continue;
    const itemStats = await stat(join(targetRoot, entry.name)).catch(() => null);
    entries.push({
      name: entry.name,
      kind: isDir ? "directory" : "file",
      ...(isFile && itemStats ? { size: itemStats.size } : {}),
      updatedAt: itemStats ? itemStats.mtimeMs : 0,
    });
  }

  entries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

  return {
    projectId: project.id,
    rootPath: targetRoot,
    exists: true,
    directoryCount,
    fileCount,
    entries,
  };
}

/** 安全只读项目内单个文本文件，拦截路径穿越并限制最大预览字节数。 */
export async function readProjectTextFile(
  project: WorkspaceProjectSummary,
  requestedPath: string,
): Promise<{ path: string; relativePath: string; content: string; truncated: boolean; size: number }> {
  const resolved = resolveWithinProjectRoots(project, requestedPath);
  if (!resolved) {
    throw new Error("文件路径超出当前项目授权目录边界。");
  }
  const info = await stat(resolved.resolvedPath).catch(() => null);
  if (!info || !info.isFile()) {
    throw new Error("目标路径不存在或不是可读文件。");
  }
  const [realRoot, realTarget] = await Promise.all([
    realpath(resolved.matchedRoot).catch(() => resolved.matchedRoot),
    realpath(resolved.resolvedPath).catch(() => null),
  ]);
  if (!realTarget || !isWithinRoot(realTarget, realRoot)) {
    throw new Error("文件路径经符号链接越出当前项目授权目录边界。");
  }

  const readBytes = Math.min(info.size, MAX_PREVIEW_FILE_BYTES);
  const truncated = info.size > MAX_PREVIEW_FILE_BYTES;
  const handle = await open(resolved.resolvedPath, "r");
  try {
    const buffer = Buffer.alloc(readBytes);
    let offset = 0;
    while (offset < readBytes) {
      const { bytesRead } = await handle.read(buffer, offset, readBytes - offset, offset);
      if (bytesRead <= 0) break;
      offset += bytesRead;
    }
    const slice = buffer.subarray(0, offset);
    const sampleEnd = Math.min(slice.length, 4096);
    for (let i = 0; i < sampleEnd; i += 1) {
      if (slice[i] === 0) {
        throw new Error("二进制文件暂不支持在代码查看器中直接预览。");
      }
    }
    return {
      path: resolved.resolvedPath.replace(/\\/gu, "/"),
      relativePath: resolved.relativePath || basename(resolved.resolvedPath),
      content: slice.toString("utf8"),
      truncated,
      size: info.size,
    };
  } finally {
    await handle.close();
  }
}
