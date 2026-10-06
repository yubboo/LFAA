/**
 * 功能：按账户和应用保存 AI Work 尚未发送的输入。
 * 作用：通过共享浏览器持久化层按账户与 App 隔离短期聊天草稿；服务端已发送会话仍是消息正文的唯一权威来源。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、apps/cli/tests/client-persistence.test.mjs。
 */
import { createBrowserPersistence, createClientPersistenceKey, stringPersistenceCodec, type BrowserStorageAdapter, type BrowserPersistence } from "./browser-persistence.js";

/** 保持既有键格式，确保此次抽取共享层后现存草稿仍可读取。 */
export function createAiWorkDraftPersistence(userId: string, appId: string, storage?: BrowserStorageAdapter | null): BrowserPersistence<string> {
  return createBrowserPersistence({
    key: createClientPersistenceKey("ai-work-draft", 1, [userId, appId]),
    codec: stringPersistenceCodec,
    storage
  });
}

/** 浏览器存储不可用或读取失败时，将草稿视为空值且不影响当前会话。 */
export function readAiWorkDraft(userId: string, appId: string, storage?: BrowserStorageAdapter | null): string {
  if (!userId || !appId) return "";
  return createAiWorkDraftPersistence(userId, appId, storage).read() ?? "";
}

/** 空草稿删除单个账户/App 键；重复写入同一文本时不触发额外存储 I/O。 */
export function writeAiWorkDraft(userId: string, appId: string, draft: string, storage?: BrowserStorageAdapter | null): void {
  if (!userId || !appId) return;
  const persistence = createAiWorkDraftPersistence(userId, appId, storage);
  if (!draft) persistence.remove();
  else persistence.write(draft);
}
