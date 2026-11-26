// 输入区草稿记忆：按「项目新会话 / 已有会话」保存未发送的文字与附件（含图片文件），
// 切换会话或刷新页面后恢复；空草稿自动删除，避免留下无意义记录。
import type { ComposerAttachment } from "./composer-context";

/** 一个分区里尚未发送的输入内容。 */
export interface ComposerDraftSnapshot {
  text: string;
  attachments: ComposerAttachment[];
}

/** IndexedDB 中保存的记录：附件里的 File 由结构化克隆直接持久化，无需 base64。 */
interface StoredComposerDraft extends ComposerDraftSnapshot {
  scope: string;
  updatedAt: number;
}

const DB_NAME = "lfaa-composer-drafts";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

// 同一页面内先走内存：切换会话即时恢复，不闪烁；持久化只作为刷新后的兜底。
const memory = new Map<string, ComposerDraftSnapshot>();
let databasePromise: Promise<IDBDatabase | null> | null = null;

/** 生成草稿分区键：已打开会话按会话，新会话按项目（无项目时落到全局）。 */
export function composerDraftScope(input: { sessionId?: string | null; projectId?: string | null }): string {
  return input.sessionId ? `session:${input.sessionId}` : `new:${input.projectId ?? "global"}`;
}

/** 空草稿不占记忆：只有空白文字且没有任何附件时视为无需保存。 */
export function isComposerDraftEmpty(snapshot: ComposerDraftSnapshot): boolean {
  return snapshot.text.trim().length === 0 && snapshot.attachments.length === 0;
}

function copySnapshot(snapshot: ComposerDraftSnapshot): ComposerDraftSnapshot {
  return { text: snapshot.text, attachments: [...snapshot.attachments] };
}

/** 读取当前页面内已记忆的草稿；命中时不走异步存储，切换会话无闪烁。 */
export function readComposerDraftSync(scope: string): ComposerDraftSnapshot | null {
  const found = memory.get(scope);
  return found ? copySnapshot(found) : null;
}

/** 打开本地草稿库；浏览器禁用 IndexedDB 时静默退回内存，不影响输入。 */
function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "scope" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return databasePromise;
}

function readStored(db: IDBDatabase, scope: string): Promise<StoredComposerDraft | null> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(scope);
      request.onsuccess = () => resolve((request.result as StoredComposerDraft | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function writeStored(db: IDBDatabase, scope: string, snapshot: ComposerDraftSnapshot): Promise<void> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ scope, ...copySnapshot(snapshot), updatedAt: Date.now() });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function deleteStored(db: IDBDatabase, scope: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(scope);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 读取分区草稿：优先内存，其次本地持久化。 */
export async function readComposerDraft(scope: string): Promise<ComposerDraftSnapshot | null> {
  const cached = readComposerDraftSync(scope);
  if (cached) return cached;
  const db = await openDatabase();
  if (!db) return null;
  const stored = await readStored(db, scope);
  if (!stored) return null;
  const snapshot = { text: stored.text, attachments: stored.attachments };
  memory.set(scope, snapshot);
  return copySnapshot(snapshot);
}

/** 写入分区草稿；内容清空时连同持久化记录一起删除。 */
export async function writeComposerDraft(scope: string, snapshot: ComposerDraftSnapshot): Promise<void> {
  const next = copySnapshot(snapshot);
  const db = await openDatabase();
  if (isComposerDraftEmpty(next)) {
    memory.delete(scope);
    if (db) await deleteStored(db, scope);
    return;
  }
  memory.set(scope, next);
  if (db) await writeStored(db, scope, next);
}

/** 显式清除一个分区的草稿记忆（会话删除、草稿提交失败等场景使用）。 */
export async function clearComposerDraft(scope: string): Promise<void> {
  memory.delete(scope);
  const db = await openDatabase();
  if (db) await deleteStored(db, scope);
}