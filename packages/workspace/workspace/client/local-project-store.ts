// 通过同源 /api/workspace/* RPC 与 Host WorkspaceService 同步真实本地项目和目录信息，并缓存快照实现首屏秒开与静默刷新。
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import type {
  CreateProjectInput,
  FolderPickResult,
  ResolveDefaultPathResult,
  UpdateProjectInput,
  WorkspaceInspection,
  WorkspaceProjectSummary,
} from "../src/types";

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

export class LocalProjectStore {
  private readonly listeners = new Set<() => void>();
  private projects: WorkspaceProjectSummary[] = readStoredJson(PROJECTS_CACHE_KEY, [], isProjectArray);
  private loaded = hasCachedKey(PROJECTS_CACHE_KEY);
  private disposed = false;

  constructor() {
    if (typeof window !== "undefined") {
      void this.refreshProjects();
    }
  }

  private commitProjects(nextProjects: WorkspaceProjectSummary[]): boolean {
    const changed = JSON.stringify(nextProjects) !== JSON.stringify(this.projects);
    this.projects = nextProjects;
    writeStoredJson(PROJECTS_CACHE_KEY, nextProjects);
    return changed;
  }

  dispose(): void {
    this.disposed = true;
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

  async pickLocalFolder(): Promise<FolderPickResult> {
    const response = await fetch("/api/workspace/pick-folder", { method: "POST" });
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
}
