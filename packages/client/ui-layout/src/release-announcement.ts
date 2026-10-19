import { createBrowserPersistence, createClientPersistenceKey, stringPersistenceCodec, type BrowserPersistence, type BrowserStorageAdapter } from "lfaa-client-store/src/browser-persistence.js";

export function createReleaseAnnouncementPersistence(userId: string, storage?: BrowserStorageAdapter | null): BrowserPersistence<string> {
  if (typeof userId !== "string" || !userId.trim()) throw new TypeError("版本公告确认状态需要有效账户 ID。");
  return createBrowserPersistence({
    key: createClientPersistenceKey("release-announcement-ack", 1, [userId]),
    codec: stringPersistenceCodec,
    ...(storage === undefined ? {} : { storage })
  });
}
