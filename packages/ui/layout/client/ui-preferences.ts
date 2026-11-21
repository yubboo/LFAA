// 统一管理浏览器端 Shell 交互记忆（路由、左右栏折叠、分组展开、自定义分区折叠、排序与模式），刷新后完整保留用户操作。
import type { WorkspaceMode } from "./navigation";

export type BuiltinGroupName = "pinned" | "projects" | "recent";
export type ProjectSortMode = "created" | "name";
export type NavGroupExpandedPrefs = Partial<Record<BuiltinGroupName, boolean>>;

/** 描述重新打开工作台时可恢复的最近视图和项目。 */
export interface ActiveRoutePref {
  activeView: string;
  activeProjectId: string | null;
}

/** 这一组键持久化本机工作台的侧栏、路由、折叠和排序偏好。 */
export const LEFT_SIDEBAR_STORAGE_KEY = "lfaa:left-sidebar-open";
export const RIGHT_PANEL_STORAGE_KEY = "lfaa:right-panel-open";
export const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = "lfaa:left-sidebar-width";
export const RIGHT_PANEL_WIDTH_STORAGE_KEY = "lfaa:right-panel-width";
export const ACTIVE_ROUTE_STORAGE_KEY = "lfaa:active-route";
export const LIBRARY_TAB_STORAGE_KEY = "lfaa:library-tab";
export const WORKSPACE_MODE_STORAGE_KEY = "lfaa:workspace-mode";
export const NAV_GROUP_EXPANDED_KEY = "lfaa:nav-group-expanded";
export const SECTION_EXPANDED_KEY = "lfaa:section-expanded";
export const PROJECT_SORT_STORAGE_KEY = "lfaa:project-sort";
export const RECENT_SORT_STORAGE_KEY = "lfaa:recent-sort";

/** 读取并校验浏览器偏好，存储不可用或值无效时回退到给定默认值。 */
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

/** 将工作台偏好保存到浏览器，对禁用的存储保持可用的内存交互。 */
export function writeStoredJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储受限时保留当前会话状态，不影响页面交互。
  }
}

/** 读取侧栏开关等布尔偏好，识别缺失值并提供回退。 */
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

/** 将布尔偏好写成与读取规则一致的持久化格式。 */
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

/** 恢复最近打开的视图与项目，避免使用无效历史数据。 */
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

/** 记录当前视图和项目，使下次载入可恢复同一工作位置。 */
export function writeActiveRoutePref(activeView: string, activeProjectId: string | null): void {
  writeStoredJson(ACTIVE_ROUTE_STORAGE_KEY, {
    activeView,
    activeProjectId: activeProjectId ?? null,
  });
}

/** 恢复工作模式，非法值沿用默认模式。 */
export function readWorkspaceModePref(): WorkspaceMode {
  return readStoredJson<WorkspaceMode>(
    WORKSPACE_MODE_STORAGE_KEY,
    "chatgpt",
    (val): val is WorkspaceMode => val === "chatgpt" || val === "codex",
  );
}

/** 保存当前工作模式，供打开工作台时恢复。 */
export function writeWorkspaceModePref(mode: WorkspaceMode): void {
  writeStoredJson(WORKSPACE_MODE_STORAGE_KEY, mode);
}

/** 恢复内建导航分组的展开偏好。 */
export function readNavGroupExpandedPref(): NavGroupExpandedPrefs {
  const raw = readStoredJson<unknown>(NAV_GROUP_EXPANDED_KEY, null);
  if (!isPlainRecord(raw)) return {};
  const next: NavGroupExpandedPrefs = {};
  for (const key of ["pinned", "projects", "recent"] as const) {
    if (typeof raw[key] === "boolean") next[key] = raw[key];
  }
  return next;
}

/** 保存内建导航组的展开状态。 */
export function writeNavGroupExpandedPref(prefs: NavGroupExpandedPrefs): void {
  writeStoredJson(NAV_GROUP_EXPANDED_KEY, prefs);
}

/** 恢复每个自定义分区的展开偏好。 */
export function readSectionExpandedPref(): Record<string, boolean> {
  const raw = readStoredJson<unknown>(SECTION_EXPANDED_KEY, null);
  if (!isPlainRecord(raw)) return {};
  const next: Record<string, boolean> = {};
  for (const [id, val] of Object.entries(raw)) {
    if (typeof val === "boolean") next[id] = val;
  }
  return next;
}

/** 保存自定义分区的展开状态映射。 */
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

/** 单独恢复项目列表的排序方式。 */
export function readProjectSortPref(): ProjectSortMode {
  return readSortModePref(PROJECT_SORT_STORAGE_KEY);
}

/** 记录项目列表的排序偏好。 */
export function writeProjectSortPref(sort: ProjectSortMode): void {
  writeStoredJson(PROJECT_SORT_STORAGE_KEY, sort);
}

/** 单独恢复最近会话的排序方式。 */
export function readRecentSortPref(): ProjectSortMode {
  return readSortModePref(RECENT_SORT_STORAGE_KEY);
}

/** 记录最近会话的排序偏好。 */
export function writeRecentSortPref(sort: ProjectSortMode): void {
  writeStoredJson(RECENT_SORT_STORAGE_KEY, sort);
}

/** 保留有效的侧栏宽度偏好，实际显示由当前桌面布局按比例约束。 */
export function readPanelWidthPref(key: string, min = 1, max = Infinity): number | null {
  const value = readStoredJson<unknown>(key, null);
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return Math.round(value);
}

/** 持久化侧栏确认后的宽度，供下次载入恢复。 */
export function writePanelWidthPref(key: string, width: number): void {
  writeStoredJson(key, Math.round(width));
}
