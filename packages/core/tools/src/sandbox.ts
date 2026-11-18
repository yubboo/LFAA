// 校验工作区路径沙箱，防止路径穿越、前缀伪装或符号链接逃逸到授权目录之外；仅完全访问权限模式允许越界。
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function normalizeForCompare(targetPath: string): string {
  const resolved = resolve(targetPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isInsideRoot(targetPath: string, rootPath: string): boolean {
  const rel = relative(normalizeForCompare(rootPath), normalizeForCompare(targetPath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function resolveNearestRealPath(targetPath: string): Promise<string> {
  let cursor = resolve(targetPath);
  const pending: string[] = [];

  while (true) {
    try {
      const real = await realpath(cursor);
      return pending.length > 0 ? resolve(real, ...pending.reverse()) : real;
    } catch {
      const parent = dirname(cursor);
      if (parent === cursor) return resolve(targetPath);
      const tail = cursor.slice(parent.length).replace(/^[/\\]+/u, "");
      if (tail) pending.push(tail);
      cursor = parent;
    }
  }
}

export interface WorkspacePathOptions {
  allowOutsideWorkspace?: boolean | undefined;
}

export async function resolveSafeWorkspacePath(
  rawPath: string,
  workspaceRoots: string[],
  options: WorkspacePathOptions = {},
): Promise<{ path: string; root: string }> {
  const cleanRoots = workspaceRoots.map((r) => r.trim()).filter(Boolean);
  const trimmedInput = rawPath.trim() || ".";

  if (options.allowOutsideWorkspace) {
    const baseRoot = cleanRoots.length > 0 ? resolve(cleanRoots[0]!) : resolve(homedir());
    const candidate = isAbsolute(trimmedInput) ? resolve(trimmedInput) : resolve(baseRoot, trimmedInput);
    const realCandidate = await resolveNearestRealPath(candidate);
    const realBase = await resolveNearestRealPath(baseRoot);
    return { path: realCandidate, root: realBase };
  }

  if (cleanRoots.length === 0) {
    throw new Error("当前会话未绑定授权项目目录，无法访问本地文件或执行命令。");
  }

  const primaryRoot = resolve(cleanRoots[0]!);
  const candidate = isAbsolute(trimmedInput) ? resolve(trimmedInput) : resolve(primaryRoot, trimmedInput);

  const realCandidate = await resolveNearestRealPath(candidate);
  for (const root of cleanRoots) {
    const realRoot = await resolveNearestRealPath(resolve(root));
    if (isInsideRoot(realCandidate, realRoot)) {
      return { path: realCandidate, root: realRoot };
    }
  }

  throw new Error(`路径越界拦截：${trimmedInput} 不在已授权的工作区目录内。`);
}

export async function resolveSafeWorkspaceRoot(
  workspaceRoots: string[],
  options: WorkspacePathOptions = {},
): Promise<string> {
  const first = await resolveSafeWorkspacePath(".", workspaceRoots, options);
  return first.root;
}
