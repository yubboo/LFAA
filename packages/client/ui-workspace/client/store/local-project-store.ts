// 通过同源 /api/workspace/* RPC 与 Host WorkspaceService 同步真实本地项目和目录信息，并缓存快照实现首屏秒开与静默刷新。
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import type { ProjectWorktreeItem, ProjectWorktreeMergePreview } from "../shared/worktree-types";
import type {
  CreateProjectInput,
  DraftProjectBriefResult,
  FolderPickResult,
  ResolveDefaultPathResult,
  UpdateProjectInput,
  WorkspaceInspection,
  WorkspaceProjectSummary,
} from "@lfaa/workspace/contract";

const PROJECTS_CACHE_KEY = "lfaa:cache-projects";

function isProjectArray(value: unknown): value is WorkspaceProjectSummary[] {
  return Array.isArray(value) && value.every(
    (item) => typeof item === "object"
      && item !== null
      && typeof (item as WorkspaceProjectSummary).id === "string"
      && typeof (item as WorkspaceProjectSummary).name === "string",
  );
}

function hasCachedKey(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

async function readJsonSafe<T>(response: Response): Promise<(T & { error?: string }) | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return null;
  }
}

/** 维护本机项目缓存与订阅，将创建、编辑和检查交给工作区 Host。 */
export class LocalProjectStore {
  private readonly listeners = new Set<() => void>();
  private projects: WorkspaceProjectSummary[] = readStoredJson(PROJECTS_CACHE_KEY, [], isProjectArray);
  private loaded = hasCachedKey(PROJECTS_CACHE_KEY);
  private disposed = false;
  private detachWindowRefresh: (() => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      void this.refreshProjects();
      this.attachWindowRefresh();
    }
  }

  /**
   * 窗口重新获得焦点时静默刷新：用户在资源管理器里新建或删除项目文件夹后，
   * 切回应用即可看到列表变化，不必手动刷新页面。
   */
  private attachWindowRefresh(): void {
    if (typeof window.addEventListener !== "function") return;
    let lastRefreshAt = 0;
    const refreshSoon = () => {
      const now = Date.now();
      // 拖动窗口或连续切换焦点时避免重复请求。
      if (now - lastRefreshAt < 800) return;
      lastRefreshAt = now;
      void this.refreshProjects();
    };
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refreshSoon();
    };
    window.addEventListener("focus", refreshSoon);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    this.detachWindowRefresh = () => {
      window.removeEventListener("focus", refreshSoon);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      this.detachWindowRefresh = null;
    };
  }

  private commitProjects(nextProjects: WorkspaceProjectSummary[]): boolean {
    const changed = JSON.stringify(nextProjects) !== JSON.stringify(this.projects);
    this.projects = nextProjects;
    writeStoredJson(PROJECTS_CACHE_KEY, nextProjects);
    return changed;
  }

  dispose(): void {
    this.disposed = true;
    this.detachWindowRefresh?.();
    this.detachWindowRefresh = null;
    this.listeners.clear();
  }

  private emit(): void {
    if (this.disposed) return;
    for (const listener of this.listeners) listener();
  }

  getProjects = (): WorkbenchProjectItem[] => this.projects;

  hasLoaded = (): boolean => this.loaded;

  hasProjectName(name: string, excludeProjectId?: string): boolean {
    const key = name.trim().toLowerCase();
    if (!key) return false;
    return this.projects.some(
      (item) => item.id !== excludeProjectId && item.name.trim().toLowerCase() === key,
    );
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async refreshProjects(): Promise<void> {
    if (typeof window === "undefined") return;
    let changed = !this.loaded;
    try {
      const response = await fetch("/api/workspace/projects");
      if (!response.ok) return;
      const data = await readJsonSafe<{ projects?: WorkspaceProjectSummary[] }>(response);
      if (data && Array.isArray(data.projects)) {
        if (this.commitProjects(data.projects)) {
          changed = true;
        }
      }
    } catch {
      // 保留当前缓存快照，避免短暂请求异常清空界面状态。
    } finally {
      this.loaded = true;
      if (changed) this.emit();
    }
  }

  async pickLocalFolder(options?: { title?: string; initialDir?: string }): Promise<FolderPickResult> {
    const desktopDialog = typeof window !== "undefined"
      ? (window as unknown as { __LFAA_DESKTOP_DIALOG__?: { pickFolder: (opts?: { title?: string; defaultPath?: string }) => Promise<FolderPickResult> } }).__LFAA_DESKTOP_DIALOG__
      : undefined;
    if (desktopDialog) {
      return desktopDialog.pickFolder({
        ...(options?.title ? { title: options.title } : {}),
        ...(options?.initialDir ? { defaultPath: options.initialDir } : {}),
      });
    }
    const response = await fetch("/api/workspace/pick-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options ?? {}),
    });
    const data = await readJsonSafe<FolderPickResult>(response);
    if (!response.ok || !data) {
      return { cancelled: true, error: data?.error ?? `打开资源管理器失败（HTTP ${response.status}）。` };
    }
    return data;
  }

  async validateLocalFolder(folderPath: string): Promise<{ path: string; name: string }> {
    const response = await fetch("/api/workspace/validate-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: folderPath }),
    });
    const data = await readJsonSafe<{ path: string; name: string }>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `校验本地文件夹失败（HTTP ${response.status}）。`);
    }
    return data;
  }

  async resolveDefaultPath(name: string): Promise<ResolveDefaultPathResult> {
    const response = await fetch("/api/workspace/projects/resolve-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await readJsonSafe<ResolveDefaultPathResult>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `无法解析默认项目路径（HTTP ${response.status}）。`);
    }
    return data;
  }

  async draftProjectBrief(rootPath: string, name: string): Promise<DraftProjectBriefResult> {
    const response = await fetch("/api/workspace/projects/draft-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootPath, name }),
    });
    const data = await readJsonSafe<DraftProjectBriefResult>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `生成项目简介失败（HTTP ${response.status}）。`);
    }
    return data;
  }

  async createProject(input: CreateProjectInput): Promise<WorkspaceProjectSummary> {
    const response = await fetch("/api/workspace/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await readJsonSafe<{ project?: WorkspaceProjectSummary }>(response);
    if (!response.ok || !data?.project) {
      throw new Error(data?.error ?? `创建项目失败（HTTP ${response.status}）。`);
    }
    this.commitProjects([data.project, ...this.projects.filter((item) => item.id !== data.project?.id)]);
    this.loaded = true;
    this.emit();
    return data.project;
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<WorkspaceProjectSummary> {
    const response = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await readJsonSafe<{ project?: WorkspaceProjectSummary }>(response);
    if (!response.ok || !data?.project) {
      throw new Error(data?.error ?? `更新项目失败（HTTP ${response.status}）。`);
    }
    this.commitProjects(this.projects.map((item) => (item.id === data.project?.id ? data.project : item)));
    this.emit();
    return data.project;
  }

  async togglePinProject(projectId: string): Promise<void> {
    const target = this.projects.find((item) => item.id === projectId);
    if (!target) return;
    await this.updateProject(projectId, { pinned: !target.pinned });
  }

  async assignSection(projectId: string, sectionId: string | null): Promise<void> {
    const target = this.projects.find((item) => item.id === projectId);
    if (!target) return;
    await this.updateProject(projectId, { sectionId, ...(sectionId ? { pinned: false } : {}) });
  }

  async removeProject(projectId: string): Promise<boolean> {
    const response = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
    if (!response.ok) return false;
    this.commitProjects(this.projects.filter((item) => item.id !== projectId));
    this.emit();
    return true;
  }

  async openProjectInExplorer(projectId: string): Promise<{ opened: boolean; error?: string }> {
    const response = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/open-explorer`, {
      method: "POST",
    });
    const data = await readJsonSafe<{ opened?: boolean; error?: string }>(response);
    if (!response.ok || !data) {
      return { opened: false, error: data?.error ?? `打开资源管理器失败（HTTP ${response.status}）。` };
    }
    return {
      opened: data.opened === true,
      ...(data.error ? { error: data.error } : {}),
    };
  }

  async inspectProject(projectId: string, rootPath?: string): Promise<WorkspaceInspection> {
    const query = rootPath ? `?path=${encodeURIComponent(rootPath)}` : "";
    const response = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/inspect${query}`);
    const data = await readJsonSafe<WorkspaceInspection>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `读取项目目录失败（HTTP ${response.status}）。`);
    }
    return data;
  }

  /** 读取主工作区信息：创建弹窗提示“基于哪个分支 / 有多少未提交改动”。 */
  async getWorktreeRepository(projectId: string): Promise<{ repositoryRoot: string; branch: string; dirtyCount: number }> {
    const response = await fetch(`/api/worktrees/repository?projectId=${encodeURIComponent(projectId)}`);
    const data = await readJsonSafe<{ repositoryRoot?: string; branch?: string; dirtyCount?: number; error?: string }>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `读取仓库信息失败（HTTP ${response.status}）。`);
    }
    return {
      repositoryRoot: data.repositoryRoot ?? "",
      branch: data.branch ?? "HEAD",
      dirtyCount: typeof data.dirtyCount === "number" ? data.dirtyCount : 0,
    };
  }

  async listWorktrees(projectId: string): Promise<ProjectWorktreeItem[]> {
    const response = await fetch(`/api/worktrees?projectId=${encodeURIComponent(projectId)}`);
    const data = await readJsonSafe<{ worktrees?: ProjectWorktreeItem[] }>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `读取工作树失败（HTTP ${response.status}）。`);
    }
    return Array.isArray(data.worktrees) ? data.worktrees : [];
  }

  async createWorktree(projectId: string, branch: string, from?: string): Promise<ProjectWorktreeItem> {
    const response = await fetch("/api/worktrees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, branch, ...(from?.trim() ? { from: from.trim() } : {}) }),
    });
    const data = await readJsonSafe<{ worktree?: ProjectWorktreeItem }>(response);
    if (!response.ok || !data?.worktree) {
      throw new Error(data?.error ?? `创建工作树失败（HTTP ${response.status}）。`);
    }
    return data.worktree;
  }

  async removeWorktree(worktreeId: string, force = false): Promise<boolean> {
    const response = await fetch(`/api/worktrees/${encodeURIComponent(worktreeId)}${force ? "?force=1" : ""}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await readJsonSafe<{ error?: string }>(response);
      throw new Error(data?.error ?? `删除工作树失败（HTTP ${response.status}）。`);
    }
    return true;
  }

  /** 删除工作树后安全删除已合并分支；未合并分支由 Git 拒绝并返回原因。 */
  async removeWorktreeWithBranch(worktreeId: string): Promise<{ removed: boolean; branchDeleted: boolean; error?: string }> {
    const response = await fetch(`/api/worktrees/${encodeURIComponent(worktreeId)}?deleteBranch=1`, { method: "DELETE" });
    const data = await readJsonSafe<{ removed?: boolean; branchDeleted?: boolean; error?: string }>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `删除工作树失败（HTTP ${response.status}）。`);
    }
    return {
      removed: data.removed === true,
      branchDeleted: data.branchDeleted === true,
      ...(data.error ? { error: data.error } : {}),
    };
  }

  /** 清理目录已不存在的失效工作树记录，返回清理数量。 */
  async pruneWorktrees(): Promise<number> {
    const response = await fetch("/api/worktrees/prune", { method: "POST" });
    const data = await readJsonSafe<{ removed?: number; error?: string }>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `清理工作树失败（HTTP ${response.status}）。`);
    }
    return typeof data.removed === "number" ? data.removed : 0;
  }

  /** 只读合并预演：不写主工作区，仅返回能否干净合并与冲突文件。 */
  async previewWorktreeMerge(worktreeId: string): Promise<ProjectWorktreeMergePreview> {
    const response = await fetch(`/api/worktrees/${encodeURIComponent(worktreeId)}/merge-preview`, { method: "POST" });
    const data = await readJsonSafe<ProjectWorktreeMergePreview>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `合并预演失败（HTTP ${response.status}）。`);
    }
    return data;
  }

  /** 将已预演通过的工作树分支合并回主仓库当前检出的基线分支。 */
  async mergeWorktree(worktreeId: string): Promise<{ merged: boolean; upToDate: boolean; branch: string; baseRef: string }> {
    const response = await fetch(`/api/worktrees/${encodeURIComponent(worktreeId)}/merge`, { method: "POST" });
    const data = await readJsonSafe<{ merged?: boolean; upToDate?: boolean; branch?: string; baseRef?: string; error?: string }>(response);
    if (!response.ok || !data) {
      throw new Error(data?.error ?? `合并工作树失败（HTTP ${response.status}）。`);
    }
    return {
      merged: data.merged === true,
      upToDate: data.upToDate === true,
      branch: data.branch ?? "",
      baseRef: data.baseRef ?? "",
    };
  }
}
