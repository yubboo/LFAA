/**
 * 功能：保存 AI Work 侧栏的分区开合、项目折叠和分批显示偏好。
 * 作用：按账户与 App 隔离有界的浏览器 UI 状态，不保存或改变 Session/Workspace 领域数据。
 * 关联文件：packages/client/ui-workspace/src/ApplicationWorkspace.tsx、apps/cli/tests/client-persistence.test.mjs。
 */
import { createBrowserPersistence, createClientPersistenceKey, createJsonPersistenceCodec, type BrowserStorageAdapter } from "./browser-persistence.js";

export const MAX_AI_WORK_SIDEBAR_GROUP_PREFERENCES = 400;
export const MAX_AI_WORK_SIDEBAR_VISIBLE_SESSIONS = 200;

export interface AiWorkSidebarPreferences {
  pinnedExpanded: boolean;
  projectsExpanded: boolean;
  recentSessionsExpanded: boolean;
  collapsedProjectGroups: string[];
  projectSessionVisibleCounts: Record<string, number>;
}

export function createDefaultAiWorkSidebarPreferences(): AiWorkSidebarPreferences {
  return {
    pinnedExpanded: true,
    projectsExpanded: false,
    recentSessionsExpanded: false,
    collapsedProjectGroups: [],
    projectSessionVisibleCounts: {},
  };
}

function isValidGroupKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function isAiWorkSidebarPreferences(value: unknown): value is AiWorkSidebarPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const collapsed = candidate.collapsedProjectGroups;
  const visibleCounts = candidate.projectSessionVisibleCounts;
  if (typeof candidate.pinnedExpanded !== "boolean"
    || typeof candidate.projectsExpanded !== "boolean"
    || typeof candidate.recentSessionsExpanded !== "boolean"
    || !Array.isArray(collapsed)
    || collapsed.length > MAX_AI_WORK_SIDEBAR_GROUP_PREFERENCES
    || !collapsed.every((key, index) => isValidGroupKey(key) && collapsed.indexOf(key) === index)
    || typeof visibleCounts !== "object"
    || visibleCounts === null
    || Array.isArray(visibleCounts)) return false;

  const entries = Object.entries(visibleCounts);
  return entries.length <= MAX_AI_WORK_SIDEBAR_GROUP_PREFERENCES
    && entries.every(([key, count]) => isValidGroupKey(key)
      && typeof count === "number"
      && Number.isSafeInteger(count)
      && count >= 5
      && count <= MAX_AI_WORK_SIDEBAR_VISIBLE_SESSIONS);
}

function createAiWorkSidebarPreferencesPersistence(userId: string, appId: string, storage?: BrowserStorageAdapter | null) {
  return createBrowserPersistence({
    key: createClientPersistenceKey("ai-work-sidebar", 1, [userId, appId]),
    codec: createJsonPersistenceCodec(isAiWorkSidebarPreferences),
    storage,
  });
}

/** 浏览器存储不可用、格式失效或作用域缺失时返回首次使用默认值。 */
export function readAiWorkSidebarPreferences(userId: string, appId: string, storage?: BrowserStorageAdapter | null): AiWorkSidebarPreferences {
  if (!userId || !appId) return createDefaultAiWorkSidebarPreferences();
  return createAiWorkSidebarPreferencesPersistence(userId, appId, storage).read() ?? createDefaultAiWorkSidebarPreferences();
}

/** 仅保存通过运行时校验的有界偏好；存储失败不影响侧栏交互。 */
export function writeAiWorkSidebarPreferences(userId: string, appId: string, preferences: AiWorkSidebarPreferences, storage?: BrowserStorageAdapter | null): boolean {
  if (!userId || !appId) return false;
  return createAiWorkSidebarPreferencesPersistence(userId, appId, storage).write(preferences);
}
