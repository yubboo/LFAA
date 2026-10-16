/**
 * 功能：保存小鱼智能体左侧会话栏的置顶会话 ID。
 * 作用：将展示偏好按账户隔离并限制容量，不改变 Session Owner 中的会话数据。
 * 关联文件：packages/client/ui-workspace/src/ApplicationWorkspace.tsx、apps/cli/tests/client-persistence.test.mjs。
 */
import { createBrowserPersistence, createClientPersistenceKey, createJsonPersistenceCodec, type BrowserStorageAdapter } from "./browser-persistence.js";

export const MAX_PINNED_AI_SESSIONS = 200;

function isPinnedSessionIds(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= MAX_PINNED_AI_SESSIONS
    && value.every((item, index) => typeof item === "string" && item.length > 0 && item.length <= 128 && value.indexOf(item) === index);
}

function createPinnedSessionPersistence(userId: string, storage?: BrowserStorageAdapter | null) {
  return createBrowserPersistence({
    key: createClientPersistenceKey("ai-session-pins", 1, [userId]),
    codec: createJsonPersistenceCodec(isPinnedSessionIds),
    storage
  });
}

/** 浏览器存储不可用或数据失效时返回空列表，不影响会话读取。 */
export function readPinnedAiSessionIds(userId: string, storage?: BrowserStorageAdapter | null): string[] {
  if (!userId) return [];
  return createPinnedSessionPersistence(userId, storage).read() ?? [];
}

/** 去重并有界保存；空列表删除键，重复值不引发多余存储写入。 */
export function writePinnedAiSessionIds(userId: string, sessionIds: readonly string[], storage?: BrowserStorageAdapter | null): boolean {
  if (!userId) return false;
  const boundedIds = [...new Set(sessionIds.filter(item => typeof item === "string" && item.length > 0 && item.length <= 128))]
    .slice(0, MAX_PINNED_AI_SESSIONS);
  const persistence = createPinnedSessionPersistence(userId, storage);
  return boundedIds.length ? persistence.write(boundedIds) : persistence.remove();
}
