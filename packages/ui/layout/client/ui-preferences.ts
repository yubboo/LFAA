// 统一管理浏览器端 Shell 交互记忆（路由、左右栏折叠、分组展开、自定义分区折叠、排序与模式），刷新后完整保留用户操作。
import type { WorkspaceMode } from "./navigation";

export type BuiltinGroupName = "pinned" | "projects" | "recent";
export type ProjectSortMode = "created" | "name";
export type NavGroupExpandedPrefs = Partial<Record<BuiltinGroupName, boolean>>;

export interface ActiveRoutePref {
  activeView: string;
  activeProjectId: string | null;
}

export const LEFT_SIDEBAR_STORAGE_KEY = "lfaa:left-sidebar-open";
export const RIGHT_PANEL_STORAGE_KEY = "lfaa:right-panel-open";
export const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = "lfaa:left-sidebar-width";
export const RIGHT_PANEL_WIDTH_STORAGE_KEY = "lfaa:right-panel-width";
export const ACTIVE_ROUTE_STORAGE_KEY = "lfaa:active-route";
export const WORKSPACE_MODE_STORAGE_KEY = "lfaa:workspace-mode";
export const NAV_GROUP_EXPANDED_KEY = "lfaa:nav-group-expanded";
export const SECTION_EXPANDED_KEY = "lfaa:section-expanded";
export const PROJECT_SORT_STORAGE_KEY = "lfaa:project-sort";
export const RECENT_SORT_STORAGE_KEY = "lfaa:recent-sort";

export function readStoredJson<T>(
  key: string,
  fallback: T,
  guard?: (value: unknown) => value is T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (guard && !guard(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储受限时保留当前会话状态，不影响页面交互。
  }
}

export function readBooleanPref(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeBooleanPref(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // 忽略浏览器存储写入限制。
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readActiveRoutePref(): ActiveRoutePref {
  const stored = readStoredJson<unknown>(ACTIVE_ROUTE_STORAGE_KEY, null);
  if (!isPlainRecord(stored) || typeof stored.activeView !== "string" || !stored.activeView.trim()) {
    return { activeView: "workspace", activeProjectId: null };
  }
  return {
    activeView: stored.activeView,
    activeProjectId: typeof stored.activeProjectId === "string" && stored.activeProjectId
      ? stored.activeProjectId
      : null,
  };
}

export function writeActiveRoutePref(activeView: string, activeProjectId: string | null): void {
  writeStoredJson(ACTIVE_ROUTE_STORAGE_KEY, {
    activeView,
    activeProjectId: activeProjectId ?? null,
  });
}

export function readWorkspaceModePref(): WorkspaceMode {
  return readStoredJson<WorkspaceMode>(
    WORKSPACE_MODE_STORAGE_KEY,
    "chatgpt",
    (val): val is WorkspaceMode => val === "chatgpt" || val === "codex",
  );
}

export function writeWorkspaceModePref(mode: WorkspaceMode): void {
  writeStoredJson(WORKSPACE_MODE_STORAGE_KEY, mode);
}

export function readNavGroupExpandedPref(): NavGroupExpandedPrefs {
  const raw = readStoredJson<unknown>(NAV_GROUP_EXPANDED_KEY, null);
  if (!isPlainRecord(raw)) return {};
  const next: NavGroupExpandedPrefs = {};
  for (const key of ["pinned", "projects", "recent"] as const) {
    if (typeof raw[key] === "boolean") next[key] = raw[key];
  }
  return next;
}

export function writeNavGroupExpandedPref(prefs: NavGroupExpandedPrefs): void {
  writeStoredJson(NAV_GROUP_EXPANDED_KEY, prefs);
}

export function readSectionExpandedPref(): Record<string, boolean> {
  const raw = readStoredJson<unknown>(SECTION_EXPANDED_KEY, null);
  if (!isPlainRecord(raw)) return {};
  const next: Record<string, boolean> = {};
  for (const [id, val] of Object.entries(raw)) {
    if (typeof val === "boolean") next[id] = val;
  }
  return next;
}

export function writeSectionExpandedPref(prefs: Record<string, boolean>): void {
  writeStoredJson(SECTION_EXPANDED_KEY, prefs);
}

function readSortModePref(key: string): ProjectSortMode {
  return readStoredJson<ProjectSortMode>(
    key,
    "created",
    (val): val is ProjectSortMode => val === "created" || val === "name",
  );
}

export function readProjectSortPref(): ProjectSortMode {
  return readSortModePref(PROJECT_SORT_STORAGE_KEY);
}

export function writeProjectSortPref(sort: ProjectSortMode): void {
  writeStoredJson(PROJECT_SORT_STORAGE_KEY, sort);
}

export function readRecentSortPref(): ProjectSortMode {
  return readSortModePref(RECENT_SORT_STORAGE_KEY);
}

export function writeRecentSortPref(sort: ProjectSortMode): void {
  writeStoredJson(RECENT_SORT_STORAGE_KEY, sort);
}

export function readPanelWidthPref(key: string, min = 220, max = 440): number | null {
  const value = readStoredJson<unknown>(key, null);
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return Math.round(value);
}

export function writePanelWidthPref(key: string, width: number): void {
  writeStoredJson(key, Math.round(width));
}
