// 项目记录归一化与路径边界：解析存储记录、去重根目录、校验目标是否落在项目授权目录内。
import { isAbsolute, relative, resolve } from "node:path";
import { MAX_PROJECT_BRIEF_CHARS } from "./project-brief";
import type { WorkspaceProjectSummary } from "../contract";

/** 判断候选路径是否位于指定根目录内（含根目录本身）。 */
export function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedCandidate = resolve(candidatePath);
  const normalizedRoot = resolve(rootPath);
  const rel = relative(normalizedRoot, normalizedCandidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** 在项目已授权的多个根目录中解析请求路径，越界时返回 null。 */
export function resolveWithinProjectRoots(
  project: WorkspaceProjectSummary,
  requestedPath?: string,
): { matchedRoot: string; resolvedPath: string; relativePath: string } | null {
  const trimmed = requestedPath?.trim();
  if (!trimmed) {
    const root = resolve(project.rootPath);
    return { matchedRoot: root, resolvedPath: root, relativePath: "" };
  }
  const roots = project.rootPaths.length > 0 ? project.rootPaths : [project.rootPath];
  const candidate = isAbsolute(trimmed) ? resolve(trimmed) : resolve(project.rootPath, trimmed);
  for (const rawRoot of roots) {
    const root = resolve(rawRoot);
    if (isWithinRoot(candidate, root)) {
      return {
        matchedRoot: root,
        resolvedPath: candidate,
        relativePath: relative(root, candidate).replace(/\\/gu, "/"),
      };
    }
  }
  return null;
}

/** 校验存储里的一条项目记录是否具备最小字段，避免脏数据进入列表。 */
export function isValidProjectRecord(item: unknown): item is WorkspaceProjectSummary {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.name === "string"
    && typeof record.rootPath === "string"
    && typeof record.createdAt === "number";
}

/** 归一项目根目录列表：去空白、去重（Windows 忽略大小写），保留用户顺序。 */
export function normalizeUniquePaths(rawPaths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of rawPaths) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const resolved = resolve(trimmed);
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(resolved);
  }
  return result;
}

/** 归一项目简介：去首尾空白、限长，空字符串表示未填写。 */
export function normalizeProjectDescription(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\r/gu, "").trim();
  return trimmed ? trimmed.slice(0, MAX_PROJECT_BRIEF_CHARS) : undefined;
}