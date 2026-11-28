// 声明工作区包的 Host 侧 Cordis 服务与无 DOM 领域契约，严禁导入 React、DOM 或 CSS。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { draftProjectBrief as buildProjectBriefDraft } from "./project-brief";
import { inspectProjectDirectory, readProjectTextFile } from "./project-fs-read";
import { normalizeProjectDescription, normalizeUniquePaths, resolveWithinProjectRoots } from "./project-records";
import {
  assertDefaultFolderAvailable, buildRestoredProjectSnapshot, isManagedProjectPath,
  pathKey, readProjectStore, syncDefaultProjectDir, writeProjectStore, type ProjectStoreSnapshot,
} from "./project-store";
import { openFolderInExplorer, openNativeFolderPicker, resolveNamedSubfolder, resolveUserDocumentsDir, revealFileInExplorer } from "./system-paths";
import {
  buildDefaultWorkspaceProject,
  CANVAS_PROJECTS_SUBDIR,
  DEFAULT_CANVAS_SAMPLE_SUBDIR,
  DEFAULT_CODE_SUBDIR,
  DEFAULT_OUTSIDE_SUBDIR,
  DEFAULT_WORKSPACE_SUBDIR,
  fallbackDefaultWorkspacePath,
} from "./default-workspace";
import type {
  CreateProjectInput,
  DraftProjectBriefResult,
  FolderPickResult,
  ResolveDefaultPathResult,
  UpdateProjectInput,
  WorkspaceInspection,
  WorkspaceProjectSummary,
} from "./types";

export * from "./types";
export { createWorkspaceHttpHandler } from "./http-handler";
export { readProjectStore, syncDefaultProjectDir, writeProjectStore } from "./project-store";
export type { WorkspacePluginConfig } from "./plugin-config";

import type { WorkspacePluginConfig } from "./plugin-config";
import { ProjectDirResolvers, type ProjectDirResolverPair } from "./dir-resolvers";

const DEFAULT_STORE_PATH = join(homedir(), ".lfaa", "projects.json");

// Host 侧工作区服务：持久化项目列表、动态检测默认工作目录、调起资源管理器选目录并读取真实目录内容。
export class WorkspaceService extends Service {
  private readonly storeFilePath: string;
  private readonly documentsOverride: string | undefined;
  /** 默认目录与「项目外聊天」目录的解析器；装配完成后可由联线插件注入。 */
  private readonly dirResolvers: ProjectDirResolvers;
  private readonly folderPicker: (title?: string, initialDir?: string) => Promise<FolderPickResult>;
  private cachedDocumentsDir: string | null = null;

  constructor(ctx: Context, config: WorkspacePluginConfig = {}) {
    super(ctx, "workspace");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_STORE_PATH;
    this.documentsOverride = config.documentsDir;
    this.dirResolvers = new ProjectDirResolvers(config.defaultProjectsDirResolver, config.outsideProjectDirResolver);
    this.folderPicker = config.folderPicker ?? openNativeFolderPicker;
  }

  /** 装配完成后注入默认目录与「项目外聊天」目录的解析器；返回注销函数。 */
  setProjectDirResolvers(resolvers: ProjectDirResolverPair): () => void {
    return this.dirResolvers.set(resolvers);
  }

  getStorageMode(): "host-fs" { return "host-fs"; }

  private async getBaseWorkspaceRoot(): Promise<{ documentsDir: string; workspaceBaseDir: string }> {
    if (!this.cachedDocumentsDir) {
      this.cachedDocumentsDir = await resolveUserDocumentsDir(this.documentsOverride);
    }
    const configuredDir = !this.documentsOverride && this.dirResolvers.defaultDir
      ? await this.dirResolvers.defaultDir().catch(() => undefined)
      : undefined;
    return {
      documentsDir: this.cachedDocumentsDir,
      workspaceBaseDir: configuredDir?.trim()
        ? resolve(configuredDir.trim())
        : join(this.cachedDocumentsDir, DEFAULT_WORKSPACE_SUBDIR),
    };
  }

  private async readStoredProjects(): Promise<WorkspaceProjectSummary[]> { return (await this.readStore()).projects; }

  private readStore(): Promise<ProjectStoreSnapshot> { return readProjectStore(this.storeFilePath); }

  private writeStore(snapshot: ProjectStoreSnapshot): Promise<void> { return writeProjectStore(this.storeFilePath, snapshot); }

  /** 「项目外聊天」目录：优先取设置里的值，缺省回退 `<文档>/lfaa/default-workspace`。 */
  private async resolveOutsideProjectDir(): Promise<string> {
    const configured = (await this.dirResolvers.outsideDir?.())?.trim();
    if (configured) return resolve(configured);
    return join(await resolveUserDocumentsDir(this.documentsOverride), DEFAULT_WORKSPACE_SUBDIR, DEFAULT_OUTSIDE_SUBDIR);
  }

  /** 首次启动自动登记「默认工作区」项目；用户删除后路径进入 dismissedPaths，不再自动创建。 */
  private async ensureDefaultWorkspaceProject(snapshot: ProjectStoreSnapshot): Promise<ProjectStoreSnapshot> {
    if (snapshot.projects.some((item) => item.isDefault)) return snapshot;
    const rootPath = await this.resolveOutsideProjectDir().catch(() => fallbackDefaultWorkspacePath(homedir()));
    // 用户主动移除过就不再重建，删除才算真正生效。
    if (snapshot.dismissedPaths.some((entry) => pathKey(entry) === pathKey(rootPath))) return snapshot;
    await mkdir(join(rootPath, DEFAULT_CODE_SUBDIR), { recursive: true }).catch(() => undefined);
    await mkdir(join(rootPath, DEFAULT_CANVAS_SAMPLE_SUBDIR), { recursive: true }).catch(() => undefined);
    return {
      projects: [...snapshot.projects, buildDefaultWorkspaceProject(rootPath)],
      dismissedPaths: snapshot.dismissedPaths,
    };
  }

  /** 项目列表与默认项目目录对齐：目录被删即移出，手建的项目文件夹自动纳入。 */
  private async syncDefaultProjectDir(snapshot: ProjectStoreSnapshot): Promise<ProjectStoreSnapshot> {
    const { workspaceBaseDir } = await this.getBaseWorkspaceRoot();
    const baseDir = resolve(workspaceBaseDir);
    const outsideProjectDir = await this.resolveOutsideProjectDir().catch(() => "");
    // 默认工作区与平级画布项目容器目录不作为普通代码项目自动扫描。
    const ignoredDirs = [
      outsideProjectDir,
      join(baseDir, DEFAULT_OUTSIDE_SUBDIR),
      join(baseDir, CANVAS_PROJECTS_SUBDIR),
    ].filter(Boolean);
    return syncDefaultProjectDir(snapshot, { baseDir, ignoredDirs });
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

  /** 返回项目列表前先与默认项目目录对齐：目录被删即移出，手建的项目文件夹自动纳入。 */
  async listProjects(): Promise<WorkspaceProjectSummary[]> {
    const stored = await this.readStore();
    const ensured = await this.ensureDefaultWorkspaceProject(stored);
    const snapshot = await this.syncDefaultProjectDir(ensured).catch(() => ensured);
    if (snapshot !== stored) {
      // 同步结果落盘失败不影响本次列表返回，下次请求会重新对齐。
      await this.writeStore(snapshot).catch(() => undefined);
    }
    return snapshot.projects
      .map((item) => ({
        ...item,
        exists: existsSync(item.rootPath),
      }))
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  /** 按 id 读取单个项目，供 Agent 解析项目范围。 */
  async getProject(projectId: string): Promise<WorkspaceProjectSummary | null> {
    const projects = await this.readStoredProjects();
    const project = projects.find((item) => item.id === projectId);
    return project ? { ...project, exists: existsSync(project.rootPath) } : null;
  }

  /** 只读生成项目简介初稿，供创建/编辑弹窗预览；目录不存在时返回兜底文案。 */
  async draftProjectBrief(name: string, rootPath: string): Promise<DraftProjectBriefResult> {
    const trimmedPath = rootPath.trim();
    if (!trimmedPath) throw new Error("请选择项目文件夹后再生成简介。");
    return buildProjectBriefDraft(name, resolve(trimmedPath));
  }

  async resolveDefaultProjectPath(name: string): Promise<ResolveDefaultPathResult> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("请输入项目名称。");
    }
    const existing = await this.readStoredProjects();
    this.assertUniqueInList(existing, trimmed);
    const { documentsDir, workspaceBaseDir } = await this.getBaseWorkspaceRoot();
    const targetPath = resolveNamedSubfolder(workspaceBaseDir, trimmed);
    await assertDefaultFolderAvailable(targetPath);
    return { targetPath, documentsDir, folderName: trimmed };
  }

  async pickLocalFolder(title?: string, initialDir?: string): Promise<FolderPickResult> {
    return this.folderPicker(title, initialDir);
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
    const snapshot = await this.readStore();
    const existing = snapshot.projects;
    this.assertUniqueInList(existing, name);

    const projectKind = input.kind === "canvas" ? "canvas" : "workspace";
    let resolvedPath: string;
    if (input.rootPath && input.rootPath.trim()) {
      resolvedPath = resolve(input.rootPath.trim());
      const info = await stat(resolvedPath).catch(() => null);
      if (!info || !info.isDirectory()) {
        throw new Error(`找不到所选文件夹：${resolvedPath}`);
      }
    } else if (projectKind === "canvas") {
      // 画布项目统一落在 <默认新建项目目录>/canvas-projects/<名称>，与 default-workspace 平级隔离。
      const { workspaceBaseDir } = await this.getBaseWorkspaceRoot();
      const canvasRoot = join(workspaceBaseDir, CANVAS_PROJECTS_SUBDIR);
      resolvedPath = resolveNamedSubfolder(canvasRoot, name);
      await assertDefaultFolderAvailable(resolvedPath);
      await mkdir(resolvedPath, { recursive: true });
    } else {
      const defaultTarget = await this.resolveDefaultProjectPath(name);
      resolvedPath = defaultTarget.targetPath;
      if (input.confirmedDefaultPath !== undefined
          && (!isAbsolute(input.confirmedDefaultPath) || relative(input.confirmedDefaultPath, resolvedPath))) {
        throw new Error("默认项目路径已变化，请重新确认要信任的文件夹。");
      }
      await mkdir(resolvedPath, { recursive: true });
      if (!await assertDefaultFolderAvailable(resolvedPath)) {
        throw new Error("默认项目文件夹已变化，请重新确认要信任的文件夹。");
      }
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
      kind: projectKind,
      canvasFolderId: projectKind === "canvas" ? (input.canvasFolderId ?? null) : null,
      createdAt: Date.now(),
      exists: true,
    };
    // 用户未填写时按目录内容生成初稿，保证项目内新会话一开始就有范围依据。
    const description = normalizeProjectDescription(input.description)
      ?? (await this.draftProjectBrief(name, resolvedPath)).brief;
    if (description) project.description = description;

    await this.writeStore({
      projects: [project, ...existing],
      // 显式创建即视为重新收编：清掉同路径的移出记录，避免后续再次被跳过。
      dismissedPaths: snapshot.dismissedPaths.filter((entry) => pathKey(entry) !== pathKey(resolvedPath)),
    });
    return project;
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<WorkspaceProjectSummary | null> {
    const snapshot = await this.readStore();
    const existing = snapshot.projects;
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
      canvasFolderId: input.canvasFolderId !== undefined ? input.canvasFolderId : (current.canvasFolderId ?? null),
      exists: true,
    };
    if (input.description !== undefined) {
      const description = normalizeProjectDescription(input.description);
      if (description) updated.description = description;
      else delete updated.description;
    }

    const nextList = [...existing];
    nextList[index] = updated;
    await this.writeStore({ projects: nextList, dismissedPaths: snapshot.dismissedPaths });
    return updated;
  }

  async clearSection(sectionId: string): Promise<void> {
    const snapshot = await this.readStore();
    let changed = false;
    const next = snapshot.projects.map((item) => {
      if (item.sectionId !== sectionId) return item;
      changed = true;
      return { ...item, sectionId: null };
    });
    if (changed) {
      await this.writeStore({ projects: next, dismissedPaths: snapshot.dismissedPaths });
    }
  }

  /** 删除画布分类文件夹时，将该文件夹下的画布项目安全退回根目录。 */
  async clearCanvasFolder(folderId: string): Promise<void> {
    const snapshot = await this.readStore();
    let changed = false;
    const next = snapshot.projects.map((item) => {
      if (item.canvasFolderId !== folderId) return item;
      changed = true;
      return { ...item, canvasFolderId: null };
    });
    if (changed) {
      await this.writeStore({ projects: next, dismissedPaths: snapshot.dismissedPaths });
    }
  }

  /** 移出项目；默认工作区与默认项目目录下的项目记录移出路径避免自动复活，支持整删默认工作区磁盘目录。 */
  async removeProject(projectId: string, options?: { deleteDisk?: boolean }): Promise<boolean> {
    const snapshot = await this.readStore();
    const target = snapshot.projects.find((item) => item.id === projectId);
    if (!target) return false;
    const next = snapshot.projects.filter((item) => item.id !== projectId);

    const managedRoots: string[] = [];
    const { workspaceBaseDir } = await this.getBaseWorkspaceRoot().catch(() => ({ documentsDir: "", workspaceBaseDir: "" }));
    const baseDir = workspaceBaseDir ? resolve(workspaceBaseDir) : "";
    if (target.isDefault) {
      managedRoots.push(target.rootPath);
      if (options?.deleteDisk) {
        await rm(target.rootPath, { recursive: true, force: true }).catch(() => undefined);
      }
    } else if (baseDir) {
      for (const root of target.rootPaths.length > 0 ? target.rootPaths : [target.rootPath]) {
        if (isManagedProjectPath(baseDir, root)) managedRoots.push(root);
      }
    }
    const dismissedPaths = managedRoots.length > 0
      ? normalizeUniquePaths([...snapshot.dismissedPaths, ...managedRoots])
      : snapshot.dismissedPaths;

    await this.writeStore({ projects: next, dismissedPaths });
    return true;
  }

  /** 从回收站按原 ID 还原项目注册记录并清除移出标记，保证原画布自动重新关联。 */
  async restoreProject(record: Parameters<typeof buildRestoredProjectSnapshot>[1]): Promise<WorkspaceProjectSummary> {
    const { project, nextSnapshot } = buildRestoredProjectSnapshot(await this.readStore(), record);
    await this.writeStore(nextSnapshot);
    return project;
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

  /** 在文件资源管理器中定位并高亮项目内指定文件。 */
  async revealProjectFileInExplorer(
    projectId: string,
    requestedPath: string,
  ): Promise<{ opened: boolean; path?: string; error?: string }> {
    const projects = await this.readStoredProjects();
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return { opened: false, error: "项目不存在。" };
    }
    const resolved = resolveWithinProjectRoots(project, requestedPath);
    if (!resolved) {
      return { opened: false, error: "文件路径超出当前项目授权目录边界。" };
    }
    const result = await revealFileInExplorer(resolved.resolvedPath);
    return { ...result, path: resolved.resolvedPath };
  }

  // 对已登记的项目目录（及其任意子目录）执行只读检查，严格限制在项目根目录边界内。
  async inspectProject(projectId: string, requestedRootPath?: string): Promise<WorkspaceInspection | null> {
    const projects = await this.readStoredProjects();
    const project = projects.find((item) => item.id === projectId);
    return project ? inspectProjectDirectory(project, requestedRootPath) : null;
  }

  /** 安全只读项目内单个文本文件，拦截路径穿越并限制最大预览字节数。 */
  async readProjectFile(
    projectId: string,
    requestedPath: string,
  ): Promise<{ path: string; relativePath: string; content: string; truncated: boolean; size: number } | null> {
    const projects = await this.readStoredProjects();
    const project = projects.find((item) => item.id === projectId);
    return project ? readProjectTextFile(project, requestedPath) : null;
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
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default workspacePlugin;
export { buildFolderPickerPowerShell } from "./system-paths";
