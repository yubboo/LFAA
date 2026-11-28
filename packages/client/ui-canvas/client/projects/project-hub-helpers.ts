// 无限画布「我的项目」大厅纯逻辑：合并项目与画布摘要、按关键字筛选、按时间/名称排序与相对时间格式化。
// 关联：packages/client/ui-canvas/client/projects/Canvas-Projects-Hub.tsx；运行环境：浏览器与 Node 测试。
import type { CanvasProjectSummary } from "@lfaa/canvas/contract";

export type ProjectHubSort = "recent" | "name";
export type ProjectHubViewMode = "grid" | "list";

export interface HubProjectCardItem {
  id: string;
  name: string;
  boardCount: number;
  latestCanvasId: string;
  latestTitle: string;
  updatedAt: number;
  coverAssetId?: string;
  isDefault?: boolean;
  canvasFolderId?: string | null;
}

/** 硬边界过滤：画布大厅只收录画布项目（kind === "canvas"）与内置默认工作区样板，绝不混入代码项目。 */
export function buildHubProjectItems(
  projects: ReadonlyArray<{
    id: string;
    name: string;
    createdAt?: number;
    kind?: "workspace" | "canvas";
    isDefault?: boolean;
    canvasFolderId?: string | null;
  }>,
  summaries: readonly CanvasProjectSummary[],
): HubProjectCardItem[] {
  const byId = new Map(summaries.map((item) => [item.projectId, item]));
  const result: HubProjectCardItem[] = [];
  for (const project of projects) {
    if (project.kind !== "canvas" && !project.isDefault) continue;
    const summary = byId.get(project.id);
    result.push({
      id: project.id,
      name: project.name,
      boardCount: summary?.boardCount ?? 0,
      latestCanvasId: summary?.latestCanvasId ?? "",
      latestTitle: summary?.latestTitle ?? "",
      updatedAt: summary?.updatedAt ?? project.createdAt ?? 0,
      ...(summary?.coverAssetId ? { coverAssetId: summary.coverAssetId } : {}),
      ...(project.isDefault ? { isDefault: true } : {}),
      canvasFolderId: project.isDefault ? null : (project.canvasFolderId ?? null),
    });
  }
  return result;
}

/** 按关键字与排序方式筛选并排列画布项目。 */
export function filterAndSortHubProjects(
  items: readonly HubProjectCardItem[],
  query: string,
  sort: ProjectHubSort,
): HubProjectCardItem[] {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? items.filter((item) =>
      item.name.toLowerCase().includes(needle) || item.latestTitle.toLowerCase().includes(needle))
    : [...items];

  if (sort === "name") {
    return filtered.sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"));
  }
  return filtered.sort((left, right) => right.updatedAt - left.updatedAt);
}

/** 将时间戳格式化为简短相对时间（如「刚刚 / 2 小时前 / 9 天前」）。 */
export function formatRelativeEditedTime(timestamp: number, now: number, isZh: boolean): string {
  const diffMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return isZh ? "刚刚" : "just now";
  if (minutes < 60) return isZh ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isZh ? `${hours} 小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return isZh ? `${days} 天前` : `${days}d ago`;
  const months = Math.floor(days / 30);
  return isZh ? `${months} 个月前` : `${months}mo ago`;
}

/** 根据项目 ID 稳定挑选一张用户资料库图片作为封面回退，刷新不抖动且不同项目尽量错开。 */
export function pickFallbackCoverPath(projectId: string, imagePaths: readonly string[]): string | undefined {
  if (imagePaths.length === 0) return undefined;
  let hash = 2166136261;
  for (let i = 0; i < projectId.length; i += 1) {
    hash ^= projectId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return imagePaths[Math.abs(hash) % imagePaths.length];
}


const CUSTOM_COVERS_KEY = "lfaa-canvas-custom-covers";

/** 读取用户手动修改的项目自定义封面映射（projectId -> dataUrl）。 */
export function readCustomCovers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CUSTOM_COVERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** 压缩本地图片文件为轻量封面 dataUrl（最大宽 480px）并持久化。 */
export async function saveCustomCoverFile(projectId: string, file: File): Promise<Record<string, string>> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("图片格式不支持"));
      img.onload = () => {
        const maxW = 480;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
  const next = { ...readCustomCovers(), [projectId]: dataUrl };
  localStorage.setItem(CUSTOM_COVERS_KEY, JSON.stringify(next));
  return next;
}


export type CanvasWorkspaceScreen = "hub" | "editor";

export interface PersistedCanvasWorkspaceState {
  screen: CanvasWorkspaceScreen;
  projectId: string | null;
  boardId: string;
}

const CANVAS_WORKSPACE_STATE_KEY = "lfaa-canvas-workspace-state";

/** 读取无限画布上次停留的大厅/编辑器位置，F5 刷新后原地恢复。 */
export function readPersistedCanvasState(): PersistedCanvasWorkspaceState {
  if (typeof window === "undefined") return { screen: "hub", projectId: null, boardId: "" };
  try {
    const raw = window.localStorage.getItem(CANVAS_WORKSPACE_STATE_KEY);
    if (!raw) return { screen: "hub", projectId: null, boardId: "" };
    const parsed = JSON.parse(raw) as Partial<PersistedCanvasWorkspaceState>;
    const screen: CanvasWorkspaceScreen = parsed.screen === "editor" && typeof parsed.projectId === "string" && parsed.projectId
      ? "editor"
      : "hub";
    return {
      screen,
      projectId: typeof parsed.projectId === "string" && parsed.projectId ? parsed.projectId : null,
      boardId: typeof parsed.boardId === "string" ? parsed.boardId : "",
    };
  } catch {
    return { screen: "hub", projectId: null, boardId: "" };
  }
}

/** 持久化无限画布当前所在大厅/项目与画布 ID。 */
export function writePersistedCanvasState(state: PersistedCanvasWorkspaceState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CANVAS_WORKSPACE_STATE_KEY, JSON.stringify(state));
  } catch {
    // 忽略本地存储写入限制。
  }
}
