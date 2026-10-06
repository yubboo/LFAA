/**
 * 功能：保存 Provider 配置及应用目录配置，并兼容迁移前的用户设置记录。
 * 作用：关系型配置和凭据留在 SQLite；用户设置与偏好由用户文件 Owner 管理。
 * 关联文件：settings/settings、user-settings-files.ts、games/{minecraft,steamcmd}、identity/auth。
 */
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { decode, encode, FileLease, JsonStorageBackend } from "lfaa-storage-json/src/index.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { withControlLock } from "./control-lock.js";
import { userSettingsFiles, type UserSettingsFileDocument } from "./user-settings-files.js";

export type ConfigurationRecord = Record<string, unknown>;
export interface EncryptedCredentialRecordRow {
  user_id: string;
  provider_id: string;
  record_id: string;
  record_kind: "api-key" | "grant";
  ciphertext: string;
  iv: string;
  tag: string;
  updated_at: string;
}
function matchesFields(record: ConfigurationRecord, changes: ConfigurationRecord): boolean {
  return Object.entries(changes).every(([field, value]) => Object.is(record[field], value) || encode(record[field]) === encode(value));
}
const keys: Record<string, readonly string[]> = {
  user_settings: ["user_id", "category"], user_preferences: ["user_id"], ai_accounts: ["id"],
  minecraft_storage_settings_defaults: ["id"], minecraft_storage_node_settings: ["node_id"],
  steamcmd_configuration_defaults: ["id"], steamcmd_configuration_node_settings: ["node_id"],
  steamcmd_storage_defaults: ["id"], steamcmd_storage_node_settings: ["node_id"]
} as const;
export type ConfigurationTable = "user_settings" | "user_preferences" | "ai_accounts" | "minecraft_storage_settings_defaults" | "minecraft_storage_node_settings" | "steamcmd_configuration_defaults" | "steamcmd_configuration_node_settings" | "steamcmd_storage_defaults" | "steamcmd_storage_node_settings";
export const configurationTables = Object.keys(keys) as ConfigurationTable[];
export class ConfigurationConflict extends Error { readonly code = "ai_account_name_conflict"; }
interface ConfigurationDocument { version: 1; revision: number; tables: Record<ConfigurationTable, ConfigurationRecord[]>; credential_records: EncryptedCredentialRecordRow[] }
function recordKey(table: ConfigurationTable, record: ConfigurationRecord): string { return JSON.stringify(keys[table]!.map(field => record[field])); }
function credentialKey(row: EncryptedCredentialRecordRow): string { return JSON.stringify([row.user_id, row.provider_id, row.record_id]); }

export class ConfigurationDomain {
  private readonly backend = new JsonStorageBackend(resolve(config.dataDirectory, "storages"));
  private readonly lease = new FileLease(resolve(this.backend.root, ".configuration.lock"), action => withControlLock(database, action));
  private document: ConfigurationDocument;
  private mode: "legacy-json" | "sqlite" = "legacy-json";
  private sourceFormat: "legacy-json-v1" | "legacy-sqlite-v0-30" = "legacy-json-v1";
  private pending: ConfigurationDocument | null = null;
  private changed = false;
  private failed = false;
  constructor() {
    try {
      const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
      this.sourceFormat = version <= 30 ? "legacy-sqlite-v0-30" : "legacy-json-v1";
      const state = version >= 47 ? database.prepare("SELECT id FROM configuration_storage_state WHERE id = 1").get() : undefined;
      if (version >= 47 && state) { this.document = this.readSqliteDocument(); this.mode = "sqlite"; }
      else this.document = this.readLegacyDocument(version);
    } catch (error) { this.lease.close(); throw error; }
  }
  private normalizeDocument(saved: unknown): ConfigurationDocument {
    const parsed = saved as ConfigurationDocument;
    // 旧版设置文档没有凭据记录区；惰性补空数组，凭据仍以既有加密字段保存。
    const document = parsed && Object.hasOwn(parsed, "credential_records") ? parsed : { ...parsed, credential_records: [] };
    this.validate(document);
    return document;
  }
  private readLegacyDocument(version: number): ConfigurationDocument {
    const saved = this.backend.read("configuration");
    if (saved !== undefined) return this.normalizeDocument(saved);
    if (version > 30) throw new Error("配置文件和 SQLite 配置迁移标记均缺失；请恢复同一数据根目录的完整备份。");
    return withControlLock(database, () => {
      const tables = Object.fromEntries(configurationTables.map(table => [table, database.prepare(`SELECT * FROM ${table}`).all()])) as ConfigurationDocument["tables"];
      const imported: ConfigurationDocument = { version: 1, revision: 0, tables, credential_records: [] };
      this.validate(imported); this.backend.write("configuration", imported);
      if (encode(this.backend.read("configuration")) !== encode(imported)) throw new Error("配置文件迁移回读校验失败。");
      return imported;
    });
  }
  private readSqliteDocument(): ConfigurationDocument {
    const state = database.prepare("SELECT revision FROM configuration_storage_state WHERE id = 1").get() as { revision?: number | bigint } | undefined;
    if (!state || !Number.isSafeInteger(Number(state.revision)) || Number(state.revision) < 0) throw new Error("SQLite 配置迁移状态无效。");
    const tables = Object.fromEntries(configurationTables.map(table => [table, [] as ConfigurationRecord[]])) as ConfigurationDocument["tables"];
    const rows = database.prepare("SELECT table_name, record_key, value_json FROM configuration_records ORDER BY rowid").all() as Array<{ table_name: string; record_key: string; value_json: string }>;
    for (const row of rows) {
      if (!configurationTables.includes(row.table_name as ConfigurationTable)) throw new Error("SQLite 配置记录域无效。");
      const table = row.table_name as ConfigurationTable;
      const record = decode(row.value_json) as ConfigurationRecord;
      if (!record || typeof record !== "object" || Array.isArray(record) || recordKey(table, record) !== row.record_key) throw new Error("SQLite 配置记录主键与内容不一致。");
      tables[table].push(record);
    }
    const credentialRecords = database.prepare("SELECT user_id, provider_id, record_id, record_kind, ciphertext, iv, tag, updated_at FROM configuration_credentials ORDER BY user_id, provider_id, record_id").all() as unknown as EncryptedCredentialRecordRow[];
    const document: ConfigurationDocument = { version: 1, revision: Number(state.revision), tables, credential_records: credentialRecords };
    this.validate(document);
    return document;
  }

  /** 在 v47 schema 和会话/旧表迁移完成后幂等导入旧配置，并切换后续读写到 SQLite。 */
  activateSqliteStorage(): void {
    if (this.mode === "sqlite") { this.activateFileBackedUserSettings(); return; }
    if (Number(database.prepare("PRAGMA user_version").get()!.user_version) < 47) throw new Error("SQLite 配置结构迁移尚未完成。");
    const source = this.backend.read("configuration");
    if (source === undefined) throw new Error("SQLite 配置导入来源缺失；请恢复原始配置文件。");
    const sourceDocument = this.normalizeDocument(source);
    if (encode(sourceDocument) !== encode(this.document)) throw new Error("配置来源在迁移期间发生变化；拒绝覆盖，请重启后重试。");
    const sourceHash = createHash("sha256").update(encode(sourceDocument)).digest("hex");
    try {
      withControlLock(database, () => {
        const existing = database.prepare("SELECT id FROM configuration_storage_state WHERE id = 1").get();
        if (existing) return;
        const insert = database.prepare("INSERT INTO configuration_records (table_name, record_key, user_id, node_id, value_json) VALUES (?, ?, ?, ?, ?)");
        for (const table of configurationTables) for (const record of sourceDocument.tables[table]) {
          insert.run(table, recordKey(table, record), typeof record.user_id === "string" ? record.user_id : null, typeof record.node_id === "string" ? record.node_id : null, encode(record));
        }
        const insertCredential = database.prepare("INSERT INTO configuration_credentials (user_id, provider_id, record_id, record_kind, ciphertext, iv, tag, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        for (const row of sourceDocument.credential_records) insertCredential.run(row.user_id, row.provider_id, row.record_id, row.record_kind, row.ciphertext, row.iv, row.tag, row.updated_at);
        database.prepare("INSERT INTO configuration_storage_state (id, revision, source_format, source_sha256, migrated_at) VALUES (1, ?, ?, ?, ?)").run(sourceDocument.revision, this.sourceFormat, sourceHash, new Date().toISOString());
      });
      this.document = this.readSqliteDocument();
      this.mode = "sqlite";
      this.activateFileBackedUserSettings();
    } catch (error) { throw new Error(`SQLite 配置迁移失败，原始配置已保留：${error instanceof Error ? error.message : String(error)}`); }
  }

  /** 将已验证的账户设置从 v47 配置记录迁入用户目录；无需增加 SQLite schema 版本。 */
  private activateFileBackedUserSettings(): void {
    const accountIds = (database.prepare("SELECT id FROM users ORDER BY id").all() as Array<{ id: string }>).map(row => row.id);
    const accountSet = new Set(accountIds);
    for (const table of ["user_settings", "user_preferences"] as const) {
      for (const row of this.document.tables[table]) {
        if (!accountSet.has(String(row.user_id))) throw new Error(`配置域 ${table} 引用了不存在的账户；拒绝丢弃孤立记录。`);
      }
    }

    const fileDocuments = new Map<string, UserSettingsFileDocument>();
    let hasLegacySqlRows = false;
    for (const userId of accountIds) {
      const rows = this.document.tables.user_settings.filter(row => row.user_id === userId);
      const preference = this.document.tables.user_preferences.find(row => row.user_id === userId) ?? null;
      const saved = userSettingsFiles.read(userId);
      if (saved && (rows.length > 0 || preference !== null)) {
        if (encode(saved.settings) !== encode(rows) || encode(saved.preferences) !== encode(preference)) {
          throw new Error(`账户 ${userId} 的 SQLite 配置与用户设置文件冲突；两份来源均保留，拒绝覆盖。`);
        }
      } else if (!saved && (rows.length > 0 || preference !== null)) {
        userSettingsFiles.write(userId, rows, preference, null);
      }
      const loaded = userSettingsFiles.read(userId);
      if (loaded) fileDocuments.set(userId, loaded);
      if (rows.length > 0 || preference !== null) hasLegacySqlRows = true;
    }

    if (hasLegacySqlRows) {
      withControlLock(database, () => {
        const state = database.prepare("SELECT revision FROM configuration_storage_state WHERE id = 1").get() as { revision?: number | bigint } | undefined;
        if (!state || Number(state.revision) !== this.document.revision) throw new Error("迁移期间 SQLite 配置修订发生变化；请重启后重试。");
        for (const table of ["user_settings", "user_preferences"] as const) {
          const currentRows = (database.prepare("SELECT record_key, value_json FROM configuration_records WHERE table_name = ? ORDER BY record_key").all(table) as Array<{ record_key: string; value_json: string }>)
            .map(row => decode(row.value_json) as ConfigurationRecord);
          const expectedRows = this.document.tables[table].slice().sort((left, right) => recordKey(table, left).localeCompare(recordKey(table, right)));
          if (encode(currentRows) !== encode(expectedRows)) throw new Error(`迁移期间 SQLite 配置域 ${table} 发生变化；拒绝清理来源。`);
        }
        database.prepare("DELETE FROM configuration_records WHERE table_name IN ('user_settings', 'user_preferences')").run();
        const updated = database.prepare("UPDATE configuration_storage_state SET revision = revision + 1 WHERE id = 1 AND revision = ?").run(this.document.revision);
        if (Number(updated.changes) !== 1) throw new Error("用户设置文件迁移修订冲突。");
      });
    }

    const refreshed = this.readSqliteDocument();
    refreshed.tables.user_settings = accountIds.flatMap(userId => fileDocuments.get(userId)?.settings ?? []);
    refreshed.tables.user_preferences = accountIds.flatMap(userId => {
      const preference = fileDocuments.get(userId)?.preferences;
      return preference ? [preference] : [];
    });
    this.validate(refreshed);
    this.document = refreshed;
  }
  private validate(document: ConfigurationDocument): void {
    if (document?.version !== 1 || !Number.isSafeInteger(document.revision) || document.revision < 0 || !document.tables || Object.keys(document.tables).length !== configurationTables.length) throw new Error("配置文档损坏或版本不支持。");
    for (const table of configurationTables) {
      const records = document.tables[table];
      if (!Array.isArray(records)) throw new Error(`配置域 ${table} 损坏。`);
      const seen = new Set<string>();
      const accountNames = new Set<string>(), activeUsers = new Set<string>();
      for (const record of records) {
        if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`配置域 ${table} 的记录无效。`);
        const key = JSON.stringify(keys[table]!.map(field => record[field]));
        if (keys[table]!.some(field => record[field] === null || record[field] === undefined) || seen.has(key)) throw new Error(`配置域 ${table} 的主键缺失或重复。`);
        seen.add(key);
        if (table === "user_settings" && (!["general", "appearance", "shortcuts", "ai-runtime", "minecraft-runtime", "git", "permissions", "plugins", "personalization", "computer-control"].includes(String(record.category)) || typeof record.value_json !== "string")) throw new Error("用户设置记录无效。");
        if (table === "user_preferences" && (!APPLICATION_IDS.includes(String(record.selected_app) as ApplicationId) || !["normal", "ai-work"].includes(String(record.selected_mode)))) throw new Error("应用偏好记录无效。");
        if ("install_mode" in record && !["online", "manual"].includes(String(record.install_mode))) throw new Error("SteamCMD 安装模式无效。");
        if ("id" in record && table.endsWith("defaults") && record.id !== 1) throw new Error("应用默认配置主键无效。");
        if (table === "ai_accounts") {
          const name = JSON.stringify([record.user_id, record.display_name]);
          if (accountNames.has(name)) throw new ConfigurationConflict("此用户下已有同名 AI 账户。");
          accountNames.add(name);
          if (![0, 1].includes(Number(record.is_active))) throw new Error("AI 账户激活状态无效。");
          if (record.is_active === 1) { const user = String(record.user_id); if (activeUsers.has(user)) throw new Error("同一用户只能激活一个 AI 账户。"); activeUsers.add(user); }
        }
      }
    }
    if (!Array.isArray(document.credential_records)) throw new Error("加密凭据记录区损坏。");
    const credentialKeys = new Set<string>();
    for (const row of document.credential_records) {
      if (!row || typeof row !== "object"
        || typeof row.user_id !== "string" || !row.user_id.trim() || row.user_id.length > 160
        || !/^[a-z][a-z0-9-]{0,63}$/u.test(row.provider_id)
        || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(row.record_id)
        || !["api-key", "grant"].includes(row.record_kind)
        || !/^[A-Za-z0-9_-]{1,90000}$/u.test(row.ciphertext)
        || !/^[A-Za-z0-9_-]{16}$/u.test(row.iv)
        || !/^[A-Za-z0-9_-]{22}$/u.test(row.tag)
        || typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) {
        throw new Error("加密凭据记录无效。");
      }
      const key = JSON.stringify([row.user_id, row.provider_id, row.record_id]);
      if (credentialKeys.has(key)) throw new Error("加密凭据记录主键重复。");
      credentialKeys.add(key);
    }
  }
  private assertReady(): void { if (this.failed) throw new Error("配置文件提交失败，必须重启并重新读取后再继续。"); }
  private current(): ConfigurationDocument { this.assertReady(); return this.pending ?? this.document; }
  all(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean = () => true, descending?: string): unknown[] {
    const rows = this.current().tables[table].filter(predicate);
    if (descending) rows.sort((a, b) => String(b[descending]).localeCompare(String(a[descending])));
    return structuredClone(rows);
  }
  get(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean): unknown { return structuredClone(this.current().tables[table].find(predicate)); }
  begin(): void { this.assertReady(); if (this.pending) throw new Error("配置事务不可嵌套。"); this.pending = structuredClone(this.document); this.changed = false; }
  commit(): void {
    if (!this.pending) throw new Error("配置事务尚未开始。");
    // 相同偏好、配置或空删除不产生新修订，也不触发同步原子刷盘；真实变更仍完整校验和提交。
    if (!this.changed) { this.pending = null; return; }
    const next = this.pending; this.validate(next);
    try {
      if (this.mode === "sqlite") {
        const fileTablesChanged = this.hasTableChanges(next, new Set(["user_settings", "user_preferences"]));
        const sqliteTablesChanged = this.hasTableChanges(next, new Set(configurationTables.filter(table => table !== "user_settings" && table !== "user_preferences")))
          || encode(this.document.credential_records) !== encode(next.credential_records);
        if (fileTablesChanged && sqliteTablesChanged) throw new Error("单个配置事务不能同时提交用户文件和 SQLite 记录。");
        next.revision = this.document.revision + (sqliteTablesChanged ? 1 : 0);
        if (fileTablesChanged) this.persistUserSettingsFiles(next);
        if (sqliteTablesChanged) this.persistSqlite(next);
      } else {
        next.revision = this.document.revision + 1;
        this.backend.write("configuration", next);
      }
    }
    catch (error) { this.failed = true; throw error; }
    this.document = next; this.pending = null; this.changed = false;
  }

  private hasTableChanges(next: ConfigurationDocument, selected: Set<string>): boolean {
    for (const table of configurationTables) {
      if (!selected.has(table)) continue;
      const previous = new Map(this.document.tables[table].map(record => [recordKey(table, record), record]));
      const current = new Map(next.tables[table].map(record => [recordKey(table, record), record]));
      if (previous.size !== current.size) return true;
      for (const [key, record] of current) if (encode(previous.get(key)) !== encode(record)) return true;
    }
    return false;
  }

  private persistUserSettingsFiles(next: ConfigurationDocument): void {
    const userIds = new Set([
      ...this.document.tables.user_settings.map(row => String(row.user_id)),
      ...next.tables.user_settings.map(row => String(row.user_id)),
      ...this.document.tables.user_preferences.map(row => String(row.user_id)),
      ...next.tables.user_preferences.map(row => String(row.user_id))
    ]);
    withControlLock(database, () => {
      for (const userId of userIds) {
        if (!database.prepare("SELECT id FROM users WHERE id = ?").get(userId)) throw new Error("用户设置所属账户不存在。");
        const previousSettings = this.document.tables.user_settings.filter(row => row.user_id === userId);
        const previousPreference = this.document.tables.user_preferences.find(row => row.user_id === userId) ?? null;
        const saved = userSettingsFiles.read(userId);
        if (encode(saved?.settings ?? []) !== encode(previousSettings) || encode(saved?.preferences ?? null) !== encode(previousPreference)) {
          throw new Error("用户设置文件与当前进程读取的版本不一致；请重启并重新读取后再保存。");
        }
        const settings = next.tables.user_settings.filter(row => row.user_id === userId);
        const preference = next.tables.user_preferences.find(row => row.user_id === userId) ?? null;
        if (settings.length === 0 && preference === null) userSettingsFiles.removeSettings(userId);
        else userSettingsFiles.write(userId, settings, preference, saved);
      }
    });
  }
  private persistSqlite(next: ConfigurationDocument): void {
    withControlLock(database, () => {
      const state = database.prepare("SELECT revision FROM configuration_storage_state WHERE id = 1").get() as { revision?: number | bigint } | undefined;
      if (!state || Number(state.revision) !== this.document.revision) throw new Error("SQLite 配置修订已变化，请重启并重新读取后再保存。");
      const removeRecord = database.prepare("DELETE FROM configuration_records WHERE table_name = ? AND record_key = ?");
      const writeRecord = database.prepare(`INSERT INTO configuration_records (table_name, record_key, user_id, node_id, value_json) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(table_name, record_key) DO UPDATE SET user_id = excluded.user_id, node_id = excluded.node_id, value_json = excluded.value_json`);
      for (const table of configurationTables) {
        if (table === "user_settings" || table === "user_preferences") continue;
        const previous = new Map(this.document.tables[table].map(record => [recordKey(table, record), record]));
        const current = new Map(next.tables[table].map(record => [recordKey(table, record), record]));
        for (const key of previous.keys()) if (!current.has(key)) removeRecord.run(table, key);
        for (const [key, record] of current) {
          const before = previous.get(key);
          if (before && encode(before) === encode(record)) continue;
          writeRecord.run(table, key, typeof record.user_id === "string" ? record.user_id : null, typeof record.node_id === "string" ? record.node_id : null, encode(record));
        }
      }
      const removeCredential = database.prepare("DELETE FROM configuration_credentials WHERE user_id = ? AND provider_id = ? AND record_id = ?");
      const writeCredential = database.prepare(`INSERT INTO configuration_credentials (user_id, provider_id, record_id, record_kind, ciphertext, iv, tag, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, provider_id, record_id) DO UPDATE SET record_kind = excluded.record_kind, ciphertext = excluded.ciphertext, iv = excluded.iv, tag = excluded.tag, updated_at = excluded.updated_at`);
      const previousCredentials = new Map(this.document.credential_records.map(row => [credentialKey(row), row]));
      const currentCredentials = new Map(next.credential_records.map(row => [credentialKey(row), row]));
      for (const row of previousCredentials.values()) if (!currentCredentials.has(credentialKey(row))) removeCredential.run(row.user_id, row.provider_id, row.record_id);
      for (const [key, row] of currentCredentials) {
        const before = previousCredentials.get(key);
        if (before && encode(before) === encode(row)) continue;
        writeCredential.run(row.user_id, row.provider_id, row.record_id, row.record_kind, row.ciphertext, row.iv, row.tag, row.updated_at);
      }
      const updated = database.prepare("UPDATE configuration_storage_state SET revision = ? WHERE id = 1 AND revision = ?").run(next.revision, this.document.revision);
      if (Number(updated.changes) !== 1) throw new Error("SQLite 配置修订并发冲突。");
    });
  }
  rollback(): void { this.pending = null; this.changed = false; }
  transaction<T>(action: () => T): T { this.begin(); try { const result = action(); this.commit(); return result; } catch (error) { this.rollback(); throw error; } }
  private mutate(action: () => boolean): void {
    const apply = () => { this.changed = action() || this.changed; };
    if (this.pending) apply(); else this.transaction(apply);
  }
  save(table: ConfigurationTable, record: ConfigurationRecord): void {
    if (typeof record.user_id === "string" && !database.prepare("SELECT id FROM users WHERE id = ?").get(record.user_id)) throw new Error("配置所属账户不存在。");
    if (typeof record.node_id === "string" && !database.prepare("SELECT id FROM daemon_nodes WHERE id = ?").get(record.node_id)) throw new Error("配置所属节点不存在。");
    const existing = this.current().tables[table].find(item => keys[table]!.every(key => item[key] === record[key]));
    if (existing && matchesFields(existing, record)) return;
    this.mutate(() => {
      const records = this.current().tables[table];
      const position = records.findIndex(item => keys[table]!.every(key => item[key] === record[key]));
      const now = new Date().toISOString();
      const saved = { ...(position >= 0 ? records[position] : { created_at: now }), ...structuredClone(record), updated_at: now };
      if (position >= 0) records[position] = saved; else records.push(saved);
      return true;
    });
  }
  insert(table: ConfigurationTable, record: ConfigurationRecord): void {
    if (this.current().tables[table].some(item => keys[table]!.every(key => item[key] === record[key]))) throw new Error("配置记录主键重复。");
    this.save(table, { ...(table === "ai_accounts" ? { is_active: 0 } : {}), ...record });
  }
  update(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean, changes: ConfigurationRecord): void {
    if (!this.current().tables[table].some(record => predicate(record) && !matchesFields(record, changes))) return;
    this.mutate(() => {
      let changed = false;
      this.current().tables[table] = this.current().tables[table].map(record => {
        if (!predicate(record) || matchesFields(record, changes)) return record;
        changed = true;
        return { ...record, ...structuredClone(changes), updated_at: new Date().toISOString() };
      });
      return changed;
    });
  }
  remove(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean): void {
    if (!this.current().tables[table].some(predicate)) return;
    this.mutate(() => {
      const records = this.current().tables[table];
      const remaining = records.filter(record => !predicate(record));
      if (remaining.length === records.length) return false;
      this.current().tables[table] = remaining;
      return true;
    });
  }
  getCredentialRecord(userId: string, providerId: string, recordId: string): EncryptedCredentialRecordRow | undefined {
    return structuredClone(this.current().credential_records.find(row => row.user_id === userId && row.provider_id === providerId && row.record_id === recordId));
  }
  listCredentialRecords(userId: string): EncryptedCredentialRecordRow[] {
    return structuredClone(this.current().credential_records.filter(row => row.user_id === userId));
  }
  saveCredentialRecord(record: Omit<EncryptedCredentialRecordRow, "updated_at">): void {
    if (!database.prepare("SELECT id FROM users WHERE id = ?").get(record.user_id)) throw new Error("凭据所属账户不存在。");
    this.mutate(() => {
      const records = this.current().credential_records;
      const position = records.findIndex(row => row.user_id === record.user_id && row.provider_id === record.provider_id && row.record_id === record.record_id);
      const next: EncryptedCredentialRecordRow = { ...structuredClone(record), updated_at: new Date().toISOString() };
      if (position >= 0) records[position] = next; else records.push(next);
      return true;
    });
  }
  removeCredentialRecord(userId: string, providerId: string, recordId: string): boolean {
    if (!this.current().credential_records.some(row => row.user_id === userId && row.provider_id === providerId && row.record_id === recordId)) return false;
    let removed = false;
    this.mutate(() => {
      const records = this.current().credential_records;
      const remaining = records.filter(row => !(row.user_id === userId && row.provider_id === providerId && row.record_id === recordId));
      removed = remaining.length !== records.length;
      this.current().credential_records = remaining;
      return removed;
    });
    return removed;
  }
  removeUser(userId: string): void {
    this.assertReady();
    userSettingsFiles.removeUserDirectory(userId);
    const next = structuredClone(this.document);
    for (const table of configurationTables) next.tables[table] = next.tables[table].filter(record => record.user_id !== userId);
    next.credential_records = next.credential_records.filter(row => row.user_id !== userId);
    const sqliteChanged = this.hasTableChanges(next, new Set(configurationTables.filter(table => table !== "user_settings" && table !== "user_preferences")))
      || encode(this.document.credential_records) !== encode(next.credential_records);
    if (sqliteChanged) {
      next.revision = this.document.revision + 1;
      try { this.persistSqlite(next); } catch (error) { this.failed = true; throw error; }
    }
    this.document = next;
  }
  close(): void { this.lease.close(); }
}
export const configuration = new ConfigurationDomain();
