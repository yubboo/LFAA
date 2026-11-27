// 项目存储与默认项目目录同步：读写 ~/.lfaa/projects.json，并让项目列表跟随 <文档>/lfaa 下的真实文件夹。
// 只做文件系统与纯数据加工，不持有 Cordis 上下文；由 WorkspaceService 调用。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isValidProjectRecord, normalizeProjectDescription, normalizeUniquePaths } from "./project-records";
import type { WorkspaceProjectSummary } from "../contract";

const WORKTREE_CONTAINER_SUFFIX = "-worktrees";
/** 「移出项目」记录单独存放，保证 `projects.json` 仍是旧的纯数组格式，旧版本可读。 */
const DISMISSED_FILE_NAME = "projects-dismissed.json";

/** 默认路径只可复用同名的真实目录，文件和链接需要用户另行选择。 */
export async function assertDefaultFolderAvailable(targetPath: string): Promise<boolean> {
  try {
    if ((await lstat(targetPath)).isDirectory()) return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  throw new Error(`默认项目路径被文件或链接占用：${targetPath}。请更换项目名称或选择源文件夹。`);
}

/** 项目存储快照：项目列表 + 用户主动移出的目录（这些目录不再被自动发现）。 */
export interface ProjectStoreSnapshot {
  projects: WorkspaceProjectSummary[];
  dismissedPaths: string[];
}

/** 归一化路径比较键：Windows 忽略大小写，避免同一目录写出两份记录。 */
export function pathKey(input: string): string {
  const resolved = resolve(input);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** 为自动发现的项目生成不重名名称：同名时追加 " (2)"、"(3)"… */
function uniqueProjectName(rawName: string, takenNames: Set<string>): string {
  const base = rawName.trim() || "未命名项目";
  if (!takenNames.has(base.toLowerCase())) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base} (${index})`;
    if (!takenNames.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})`;
}

/** 归一化单条存储记录：补默认字段、修剪简介与根目录列表。 */
export function normalizeStoredProject(item: WorkspaceProjectSummary): WorkspaceProjectSummary {
  const storedRecord = item as WorkspaceProjectSummary & { rootPaths?: unknown; pinned?: unknown; chatCount?: unknown };
  const rawList = Array.isArray(storedRecord.rootPaths)
    ? storedRecord.rootPaths.filter((entry): entry is string => typeof entry === "string")
    : [];
  const rootPaths = normalizeUniquePaths(rawList.length ? rawList : [item.rootPath]);
  const primaryPath = rootPaths[0] ?? resolve(item.rootPath);
  const description = normalizeProjectDescription(
    typeof storedRecord.description === "string" ? storedRecord.description : undefined,
  );
  const next: WorkspaceProjectSummary = {
    ...item,
    rootPath: primaryPath,
    rootPaths: rootPaths.length ? rootPaths : [primaryPath],
    locationType: "local" as const,
    trusted: true as const,
    pinned: storedRecord.pinned === true,
    sectionId: typeof storedRecord.sectionId === "string" && storedRecord.sectionId.trim()
      ? storedRecord.sectionId
      : null,
    chatCount: typeof storedRecord.chatCount === "number" && storedRecord.chatCount >= 0
      ? storedRecord.chatCount
      : 0,
  };
  if (description) next.description = description;
  else delete next.description;
  return next;
}

/** 「移出项目」记录文件：与项目索引同目录，单独一个文件。 */
function dismissedFilePath(storeFilePath: string): string {
  return join(dirname(storeFilePath), DISMISSED_FILE_NAME);
}

/** 容错读取 JSON 文件；文件缺失或损坏时返回 null，交给调用方用空数据兜底。 */
async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

/** 从任意 JSON 中取出路径字符串数组。 */
function readPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** 读取项目存储；兼容旧版「纯项目数组」格式，移出记录来自同目录的独立文件。 */
export async function readProjectStore(filePath: string): Promise<ProjectStoreSnapshot> {
  const parsed = await readJsonFile(filePath);
  const parsedProjects = Array.isArray(parsed)
    ? parsed
    : (parsed as { projects?: unknown })?.projects;
  const rawProjects: unknown[] = Array.isArray(parsedProjects) ? parsedProjects : [];
  const inlineDismissed = Array.isArray(parsed) ? [] : readPathList((parsed as { dismissedPaths?: unknown })?.dismissedPaths);
  const sidecarDismissed = readPathList(await readJsonFile(dismissedFilePath(filePath)));
  return {
    projects: rawProjects.filter(isValidProjectRecord).map((item) => normalizeStoredProject(item)),
    dismissedPaths: normalizeUniquePaths([...inlineDismissed, ...sidecarDismissed]),
  };
}

/** 写入项目存储：项目索引保持纯数组格式，移出记录写同目录独立文件。 */
export async function writeProjectStore(filePath: string, snapshot: ProjectStoreSnapshot): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot.projects, null, 2), "utf8");
  await writeFile(dismissedFilePath(filePath), JSON.stringify(snapshot.dismissedPaths, null, 2), "utf8");
}

/** 项目是否登记在默认项目目录（`<文档>/lfaa`）下一级；只有这类项目受目录同步管理。 */
export function isManagedProjectPath(baseDir: string, targetPath: string): boolean {
  return pathKey(dirname(resolve(targetPath))) === pathKey(baseDir);
}

/**
 * 让项目列表与默认项目目录保持一致：磁盘上被删掉的项目自动移出，
 * 用户（无论经应用新建还是在资源管理器里手建）放进去的项目文件夹自动纳入。
 * 只处理默认项目目录下一级文件夹；绑定到其他位置的项目仍走手动管理，行为不变。
 */
export async function syncDefaultProjectDir(
  snapshot: ProjectStoreSnapshot,
  options: { baseDir: string; ignoredDirs?: string[] },
): Promise<ProjectStoreSnapshot> {
  const baseDir = resolve(options.baseDir);
  const dirEntries = await readdir(baseDir, { withFileTypes: true }).catch(() => null);
  // 目录不存在（尚未创建或被整体移走）时既不扫描也不删记录，避免误清空用户项目。
  if (!dirEntries) return snapshot;

  // 项目外聊天目录与工作树容器都不是项目，跳过。
  const ignoredKeys = new Set((options.ignoredDirs ?? []).filter(Boolean).map((dir) => pathKey(dir)));
  const managedDirs = dirEntries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => join(baseDir, entry.name))
    .filter((dir) => !ignoredKeys.has(pathKey(dir)))
    .filter((dir) => !basename(dir).toLowerCase().endsWith(WORKTREE_CONTAINER_SUFFIX));

  // 1) 移出磁盘上已消失的项目（仅限默认项目目录下的项目）。
  const keptProjects = snapshot.projects.filter((project) => {
    const roots = project.rootPaths.length > 0 ? project.rootPaths : [project.rootPath];
    if (!roots.some((root) => isManagedProjectPath(baseDir, root))) return true;
    return roots.some((root) => existsSync(root));
  });

  // 2) 丢弃已不存在的移出记录：目录重新出现后可以再次被发现。
  const dismissedPaths = snapshot.dismissedPaths.filter((entry) => existsSync(entry));
  const dismissedKeys = new Set(dismissedPaths.map((entry) => pathKey(entry)));

  // 3) 纳入默认项目目录里尚未登记的项目文件夹。
  const knownKeys = new Set<string>();
  const knownNames = new Set<string>();
  for (const project of keptProjects) {
    const roots = project.rootPaths.length > 0 ? project.rootPaths : [project.rootPath];
    for (const root of roots) knownKeys.add(pathKey(root));
    if (project.name.trim()) knownNames.add(project.name.trim().toLowerCase());
  }
  const discovered: WorkspaceProjectSummary[] = [];
  for (const dir of managedDirs) {
    const key = pathKey(dir);
    if (knownKeys.has(key) || dismissedKeys.has(key)) continue;
    const folderName = basename(dir) || dir;
    const name = uniqueProjectName(folderName, knownNames);
    knownNames.add(name.toLowerCase());
    knownKeys.add(key);
    const info = await stat(dir).catch(() => null);
    discovered.push({
      id: randomUUID(),
      name,
      rootPath: dir,
      rootPaths: [dir],
      locationType: "local",
      trusted: true,
      pinned: false,
      sectionId: null,
      chatCount: 0,
      createdAt: info ? Math.round(info.mtimeMs) : Date.now(),
      exists: true,
    });
  }

  const projects = [...keptProjects, ...discovered];
  const projectsUnchanged = projects.length === snapshot.projects.length
    && projects.every((project, index) => project.id === snapshot.projects[index]?.id);
  const dismissedUnchanged = dismissedPaths.length === snapshot.dismissedPaths.length
    && dismissedPaths.every((entry, index) => pathKey(entry) === pathKey(snapshot.dismissedPaths[index]!));
  if (projectsUnchanged && dismissedUnchanged) {
    return { projects: snapshot.projects, dismissedPaths: snapshot.dismissedPaths };
  }
  return { projects, dismissedPaths };
}


/** 构造回收站恢复后的项目快照（保留原 id 与路径并清除移出标记，同名自动追加后缀）。 */
export function buildRestoredProjectSnapshot(
  snapshot: ProjectStoreSnapshot,
  record: {
    id: string;
    name: string;
    rootPath: string;
    rootPaths?: string[];
    sectionId?: string | null;
    pinned?: boolean;
    trusted?: boolean;
    createdAt?: number;
  },
): { project: WorkspaceProjectSummary; nextSnapshot: ProjectStoreSnapshot } {
  const existing = snapshot.projects.find((item) => item.id === record.id);
  if (existing) return { project: existing, nextSnapshot: snapshot };
  const rootPaths = normalizeUniquePaths(record.rootPaths?.length ? record.rootPaths : [record.rootPath]);
  const primary = rootPaths[0] ?? resolve(record.rootPath);
  const usedNames = new Set(snapshot.projects.map((item) => item.name.trim().toLowerCase()));
  let finalName = record.name.trim() || basename(primary) || "未命名项目";
  if (usedNames.has(finalName.toLowerCase())) finalName = `${finalName} (恢复)`;
  const now = Date.now();
  const project: WorkspaceProjectSummary = {
    id: record.id,
    name: finalName,
    rootPath: primary,
    rootPaths,
    exists: existsSync(primary),
    locationType: "local",
    chatCount: 0,
    trusted: true,
    pinned: Boolean(record.pinned),
    sectionId: record.sectionId ?? null,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : now,
  };
  const rootKeys = new Set(rootPaths.map((p) => pathKey(p)));
  const dismissedPaths = snapshot.dismissedPaths.filter((p) => !rootKeys.has(pathKey(p)));
  return { project, nextSnapshot: { projects: [project, ...snapshot.projects], dismissedPaths } };
}
