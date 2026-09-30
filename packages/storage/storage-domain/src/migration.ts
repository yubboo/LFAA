/** 功能：退役已迁入文件的旧表。作用：先保存完整 SQLite 恢复副本，再事务化删除旧权威表；控制面与会话头投影保留。关联文件：configuration.ts、session-persistence-jsonl/repository.ts、storage-sqlite/database.ts。 */
import { mkdirSync, chmodSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { database, migrateWorkspaceSchema, migrateWritingCatalogSchema } from "lfaa-storage-sqlite/src/database.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { JsonStorageBackend } from "lfaa-storage-json/src/index.js";
import { configurationTables } from "./configuration.js";
import { withControlLock } from "./control-lock.js";
export function retireLegacyFileTables(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version >= 31) { migrateWorkspaceSchema(); migrateWritingCatalogSchema(); return; }
  const metadata = new JsonStorageBackend(resolve(config.dataDirectory, "storages"));
  if (!metadata.read("configuration") || !metadata.read("session-migration")) throw new Error("文件存储迁移尚未完成，拒绝退役旧表。");
  const directory = resolve(config.dataDirectory, "credentials", "storage-migration-backups");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `storage-before-file-migration-${randomUUID()}.sqlite`);
  database.prepare("VACUUM INTO ?").run(path); chmodSync(path, 0o600);
  withControlLock(database, () => {
    database.exec("DROP TABLE ai_usage; DROP TABLE ai_messages;");
    for (const table of configurationTables) database.exec(`DROP TABLE ${table};`);
    database.exec("ALTER TABLE ai_sessions ADD COLUMN jsonl_revision TEXT;");
    database.exec("PRAGMA user_version = 31;");
  });
  migrateWorkspaceSchema();
  migrateWritingCatalogSchema();
}
