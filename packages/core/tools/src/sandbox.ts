// 校验工作区路径沙箱，防止路径穿越、前缀伪装或符号链接逃逸到授权目录之外；仅完全访问权限模式允许越界。
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

function normalizeForCompare(targetPath: string): string {
  const resolved = resolve(targetPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isInsideRoot(targetPath: string, rootPath: string): boolean {
  const rel = relative(normalizeForCompare(rootPath), normalizeForCompare(targetPath));
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
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

/** 同时识别应用私有路径及其磁盘指向，用于单文件校验与目录遍历。 */
export async function createPrivatePathFilter(): Promise<(candidate: string) => boolean> {
  const appHome = join(homedir(), ".lfaa");
  const paths = ["llm-config.json", "credentials", "sessions"].map((entry) => join(appHome, entry));
  const resolved = await Promise.all(paths.map(resolveNearestRealPath));
  const protectedPaths = [...paths, ...resolved];
  return (candidate) => protectedPaths.some((path) => isInsideRoot(candidate, path));
}

/** 描述调用方是否已允许工具访问工作区之外的路径。 */
export interface WorkspacePathOptions {
  allowOutsideWorkspace?: boolean | undefined;
}

/** 以授权目录为基址解析路径，并按真实文件路径核对归属。 */
export async function resolveSafeWorkspacePath(
  rawPath: string,
  workspaceRoots: string[],
  options: WorkspacePathOptions = {},
): Promise<{ path: string; root: string }> {
  const cleanRoots = workspaceRoots.map((r) => r.trim()).filter(Boolean);
  const trimmedInput = rawPath.trim() || ".";
  const allowOutside = options.allowOutsideWorkspace === true;
  if (!allowOutside && cleanRoots.length === 0) {
    throw new Error("当前会话未绑定授权项目目录，无法访问本地文件或执行命令。");
  }

  const primaryRoot = resolve(cleanRoots[0] ?? homedir());
  const candidate = isAbsolute(trimmedInput) ? resolve(trimmedInput) : resolve(primaryRoot, trimmedInput);
  const [realCandidate, isPrivate] = await Promise.all([resolveNearestRealPath(candidate), createPrivatePathFilter()]);
  if (isPrivate(candidate) || isPrivate(realCandidate)) {
    throw new Error("应用私有文件不可由 Agent 文件工具访问。请使用相应设置或会话界面。");
  }
  if (allowOutside) return { path: realCandidate, root: await resolveNearestRealPath(primaryRoot) };
  for (const root of cleanRoots) {
    const realRoot = await resolveNearestRealPath(resolve(root));
    if (isInsideRoot(realCandidate, realRoot)) {
      return { path: realCandidate, root: realRoot };
    }
  }

  throw new Error(`路径越界拦截：${trimmedInput} 不在已授权的工作区目录内。`);
}

/** 从同一套路径检查规则获得命令工具的有效工作目录。 */
export async function resolveSafeWorkspaceRoot(
  workspaceRoots: string[],
  options: WorkspacePathOptions = {},
): Promise<string> {
  const first = await resolveSafeWorkspacePath(".", workspaceRoots, options);
  return first.root;
}
