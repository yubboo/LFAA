// 声明工作区包的 Host 侧 Cordis 服务与无 DOM 领域契约，严禁导入 React、DOM 或 CSS。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { openFolderInExplorer, openNativeFolderPicker, resolveUniqueSubfolder, resolveUserDocumentsDir } from "./system-paths";
import type {
  CreateProjectInput,
  FolderPickResult,
  ResolveDefaultPathResult,
  UpdateProjectInput,
  WorkspaceDirectoryEntry,
  WorkspaceInspection,
  WorkspaceProjectSummary,
} from "./types";

export * from "./types";
export { createWorkspaceHttpHandler } from "./http-handler";

export interface WorkspacePluginConfig {
  storeFilePath?: string;
  documentsDir?: string;
  folderPicker?: () => Promise<FolderPickResult>;
}

const DEFAULT_STORE_PATH = join(homedir(), ".lfaa", "projects.json");
const DEFAULT_WORKSPACE_SUBDIR = "lfaa";
const MAX_TREE_ENTRIES = 200;

function isValidProjectRecord(item: unknown): item is WorkspaceProjectSummary {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.name === "string"
    && typeof record.rootPath === "string"
    && typeof record.createdAt === "number";
}

function normalizeUniquePaths(rawPaths: string[]): string[] {
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

// Host 侧工作区服务：持久化项目列表、动态检测默认工作目录、调起资源管理器选目录并读取真实目录内容。
export class WorkspaceService extends Service {
  private readonly storeFilePath: string;
  private readonly documentsOverride: string | undefined;
  private readonly folderPicker: () => Promise<FolderPickResult>;
  private cachedDocumentsDir: string | null = null;

  constructor(ctx: Context, config: WorkspacePluginConfig = {}) {
    super(ctx, "workspace");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_STORE_PATH;
    this.documentsOverride = config.documentsDir;
    this.folderPicker = config.folderPicker ?? (() => openNativeFolderPicker("选择项目文件夹"));
  }

  getStorageMode(): "host-fs" {
    return "host-fs";
  }

  private async getBaseWorkspaceRoot(): Promise<{ documentsDir: string; workspaceBaseDir: string }> {
    if (!this.cachedDocumentsDir) {
      this.cachedDocumentsDir = await resolveUserDocumentsDir(this.documentsOverride);
    }
    return {
      documentsDir: this.cachedDocumentsDir,
      workspaceBaseDir: join(this.cachedDocumentsDir, DEFAULT_WORKSPACE_SUBDIR),
    };
  }

  private async readStoredProjects(): Promise<WorkspaceProjectSummary[]> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidProjectRecord).map((item) => {
        const storedRecord = item as WorkspaceProjectSummary & { rootPaths?: unknown; pinned?: unknown; chatCount?: unknown };
        const rawList = Array.isArray(storedRecord.rootPaths)
          ? storedRecord.rootPaths.filter((entry): entry is string => typeof entry === "string")
          : [];
        const rootPaths = normalizeUniquePaths(rawList.length ? rawList : [item.rootPath]);
        const primaryPath = rootPaths[0] ?? resolve(item.rootPath);
        return {
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
      });
    } catch {
      return [];
    }
  }

  private async writeStoredProjects(projects: WorkspaceProjectSummary[]): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(projects, null, 2), "utf8");
  }

  private assertUniqueInList(projects: WorkspaceProjectSummary[], rawName: string, excludeProjectId?: string): void {
    const targetKey = rawName.trim().toLowerCase();
    if (!targetKey) return;
    const conflict = projects.find(
      (item) => item.id !== excludeProjectId && item.name.trim().toLowerCase() === targetKey,
    );
    if (conflict) {
      throw new Error(`项目名称“${rawName.trim()}”已存在，请更换其他名称。`);
    }
  }

  async listProjects(): Promise<WorkspaceProjectSummary[]> {
    const projects = await this.readStoredProjects();
    return projects
      .map((item) => ({
        ...item,
        exists: existsSync(item.rootPath),
      }))
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  async resolveDefaultProjectPath(name: string): Promise<ResolveDefaultPathResult> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("请输入项目名称。");
    }
    const existing = await this.readStoredProjects();
    this.assertUniqueInList(existing, trimmed);
    const { documentsDir, workspaceBaseDir } = await this.getBaseWorkspaceRoot();
    const { targetPath, folderName } = resolveUniqueSubfolder(workspaceBaseDir, trimmed);
    return { targetPath, documentsDir, folderName };
  }

  async pickLocalFolder(): Promise<FolderPickResult> {
    return this.folderPicker();
  }

  async validateLocalFolder(folderPath: string): Promise<{ path: string; name: string }> {
    const trimmed = folderPath.trim();
    if (!trimmed) {
      throw new Error("请输入本地文件夹路径。");
    }
    const resolvedPath = resolve(trimmed);
    const info = await stat(resolvedPath).catch(() => null);
    if (!info || !info.isDirectory()) {
      throw new Error(`找不到所选文件夹：${resolvedPath}`);
    }
    return {
      path: resolvedPath,
      name: basename(resolvedPath) || resolvedPath,
    };
  }

  async createProject(input: CreateProjectInput): Promise<WorkspaceProjectSummary> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("请输入项目名称。");
    }
    if (!input.trusted) {
      throw new Error("需要先确认信任项目文件夹后才能创建。");
    }
    const existing = await this.readStoredProjects();
    this.assertUniqueInList(existing, name);

    let resolvedPath: string;
    if (input.rootPath && input.rootPath.trim()) {
      resolvedPath = resolve(input.rootPath.trim());
      const info = await stat(resolvedPath).catch(() => null);
      if (!info || !info.isDirectory()) {
        throw new Error(`找不到所选文件夹：${resolvedPath}`);
      }
    } else {
      const defaultTarget = await this.resolveDefaultProjectPath(name);
      resolvedPath = defaultTarget.targetPath;
      await mkdir(resolvedPath, { recursive: true });
    }

    const project: WorkspaceProjectSummary = {
      id: randomUUID(),
      name,
      rootPath: resolvedPath,
      rootPaths: [resolvedPath],
      locationType: "local",
      trusted: true,
      pinned: false,
      sectionId: null,
      chatCount: 0,
      createdAt: Date.now(),
      exists: true,
    };

    await this.writeStoredProjects([project, ...existing]);
    return project;
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<WorkspaceProjectSummary | null> {
    const existing = await this.readStoredProjects();
    const index = existing.findIndex((item) => item.id === projectId);
    if (index < 0) return null;
    const current = existing[index]!;

    const nextName = input.name !== undefined ? input.name.trim() : current.name;
    if (!nextName) {
      throw new Error("请输入项目名称。");
    }
    if (input.name !== undefined) {
      this.assertUniqueInList(existing, nextName, projectId);
    }

    let nextRootPaths = current.rootPaths;
    if (input.rootPaths !== undefined) {
      const normalized = normalizeUniquePaths(input.rootPaths);
      if (normalized.length === 0) {
        throw new Error("请至少保留或添加一个源文件夹。");
      }
      for (const folder of normalized) {
        const info = await stat(folder).catch(() => null);
        if (!info || !info.isDirectory()) {
          throw new Error(`找不到所选文件夹：${folder}`);
        }
      }
      nextRootPaths = normalized;
    }

    const updated: WorkspaceProjectSummary = {
      ...current,
      name: nextName,
      rootPaths: nextRootPaths,
      rootPath: nextRootPaths[0] ?? current.rootPath,
      pinned: input.pinned !== undefined ? input.pinned : current.pinned,
      sectionId: input.sectionId !== undefined ? input.sectionId : current.sectionId,
      exists: true,
    };

    const nextList = [...existing];
    nextList[index] = updated;
    await this.writeStoredProjects(nextList);
    return updated;
  }

  async clearSection(sectionId: string): Promise<void> {
    const existing = await this.readStoredProjects();
    let changed = false;
    const next = existing.map((item) => {
      if (item.sectionId !== sectionId) return item;
      changed = true;
      return { ...item, sectionId: null };
    });
    if (changed) {
      await this.writeStoredProjects(next);
    }
  }

  async removeProject(projectId: string): Promise<boolean> {
    const existing = await this.readStoredProjects();
    const next = existing.filter((item) => item.id !== projectId);
    if (next.length === existing.length) return false;
    await this.writeStoredProjects(next);
    return true;
  }

  async openProjectFolderInExplorer(projectId: string): Promise<{ opened: boolean; path?: string; error?: string }> {
    const existing = await this.readStoredProjects();
    const project = existing.find((item) => item.id === projectId);
    if (!project) {
      return { opened: false, error: "项目不存在。" };
    }
    const result = await openFolderInExplorer(project.rootPath);
    return { ...result, path: project.rootPath };
  }

  async inspectProject(projectId: string, requestedRootPath?: string): Promise<WorkspaceInspection | null> {
    const projects = await this.readStoredProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) return null;

    const targetRoot = requestedRootPath && project.rootPaths.includes(requestedRootPath)
      ? requestedRootPath
      : project.rootPath;

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
}

// 注册工作区 Host Cordis 插件；未传配置时使用系统默认文档目录与存储路径。
export function workspacePlugin(context: Context, config: WorkspacePluginConfig = {}): void {
  new WorkspaceService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    workspace: WorkspaceService;
  }
}
