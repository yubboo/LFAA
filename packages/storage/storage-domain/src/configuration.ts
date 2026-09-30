/**
 * 功能：保存账户设置、Provider 配置及应用目录配置的 JSON 权威文档。
 * 作用：首次从既有 SQLite 完整导入；后续只读写文件，原子提交 Provider 激活等配置操作。
 * 关联文件：settings/settings、games/{minecraft,steamcmd}、storage-json、identity/auth；SQLite 只校验账户和节点归属。
 */
import { resolve } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { encode, FileLease, JsonStorageBackend } from "lfaa-storage-json/src/index.js";
import { withControlLock } from "./control-lock.js";

export type ConfigurationRecord = Record<string, unknown>;
const keys: Record<string, readonly string[]> = {
  user_settings: ["user_id", "category"], user_preferences: ["user_id"], ai_accounts: ["id"],
  minecraft_storage_settings_defaults: ["id"], minecraft_storage_node_settings: ["node_id"],
  steamcmd_configuration_defaults: ["id"], steamcmd_configuration_node_settings: ["node_id"],
  steamcmd_storage_defaults: ["id"], steamcmd_storage_node_settings: ["node_id"]
} as const;
export type ConfigurationTable = "user_settings" | "user_preferences" | "ai_accounts" | "minecraft_storage_settings_defaults" | "minecraft_storage_node_settings" | "steamcmd_configuration_defaults" | "steamcmd_configuration_node_settings" | "steamcmd_storage_defaults" | "steamcmd_storage_node_settings";
export const configurationTables = Object.keys(keys) as ConfigurationTable[];
export class ConfigurationConflict extends Error { readonly code = "ai_account_name_conflict"; }
interface ConfigurationDocument { version: 1; revision: number; tables: Record<ConfigurationTable, ConfigurationRecord[]> }

export class ConfigurationDomain {
  private readonly backend = new JsonStorageBackend(resolve(config.dataDirectory, "storages"));
  private readonly lease = new FileLease(resolve(this.backend.root, ".configuration.lock"), action => withControlLock(database, action));
  private document: ConfigurationDocument;
  private pending: ConfigurationDocument | null = null;
  private failed = false;
  constructor() {
    try {
      const saved = this.backend.read("configuration");
      if (saved === undefined) {
        const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
        if (version > 30) throw new Error("配置文件缺失，但旧配置已经迁移；请恢复同一数据根目录的完整备份。");
        this.document = withControlLock(database, () => {
          const tables = Object.fromEntries(configurationTables.map(table => [table, database.prepare(`SELECT * FROM ${table}`).all()])) as ConfigurationDocument["tables"];
          const imported: ConfigurationDocument = { version: 1, revision: 0, tables };
          this.validate(imported); this.backend.write("configuration", imported);
          if (encode(this.backend.read("configuration")) !== encode(imported)) throw new Error("配置文件迁移回读校验失败。");
          return imported;
        });
      } else { this.document = saved as ConfigurationDocument; this.validate(this.document); }
    } catch (error) { this.lease.close(); throw error; }
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
        if (table === "user_settings" && (!["general", "appearance", "shortcuts", "ai-runtime", "permissions", "plugins"].includes(String(record.category)) || typeof record.value_json !== "string")) throw new Error("用户设置记录无效。");
        if (table === "user_preferences" && (!["steamcmd", "minecraft", "writing", "workspace"].includes(String(record.selected_app)) || !["normal", "ai-work"].includes(String(record.selected_mode)))) throw new Error("应用偏好记录无效。");
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
  }
  private assertReady(): void { if (this.failed) throw new Error("配置文件提交失败，必须重启并重新读取后再继续。"); }
  private current(): ConfigurationDocument { this.assertReady(); return this.pending ?? this.document; }
  all(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean = () => true, descending?: string): unknown[] {
    const rows = this.current().tables[table].filter(predicate);
    if (descending) rows.sort((a, b) => String(b[descending]).localeCompare(String(a[descending])));
    return structuredClone(rows);
  }
  get(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean): unknown { return structuredClone(this.current().tables[table].find(predicate)); }
  begin(): void { this.assertReady(); if (this.pending) throw new Error("配置事务不可嵌套。"); this.pending = structuredClone(this.document); }
  commit(): void {
    if (!this.pending) throw new Error("配置事务尚未开始。");
    const next = this.pending; this.validate(next); next.revision = this.document.revision + 1;
    // 重命名后刷新磁盘失败时文件可能已提交；停止服务读取旧缓存，重启后以文件为准。
    try { this.backend.write("configuration", next); }
    catch (error) { this.failed = true; throw error; }
    this.document = next; this.pending = null;
  }
  rollback(): void { this.pending = null; }
  transaction<T>(action: () => T): T { this.begin(); try { const result = action(); this.commit(); return result; } catch (error) { this.rollback(); throw error; } }
  private mutate(action: () => void): void { if (this.pending) action(); else this.transaction(action); }
  save(table: ConfigurationTable, record: ConfigurationRecord): void {
    if (typeof record.user_id === "string" && !database.prepare("SELECT id FROM users WHERE id = ?").get(record.user_id)) throw new Error("配置所属账户不存在。");
    if (typeof record.node_id === "string" && !database.prepare("SELECT id FROM daemon_nodes WHERE id = ?").get(record.node_id)) throw new Error("配置所属节点不存在。");
    this.mutate(() => {
      const records = this.current().tables[table];
      const position = records.findIndex(item => keys[table]!.every(key => item[key] === record[key]));
      const now = new Date().toISOString();
      const saved = { ...(position >= 0 ? records[position] : { created_at: now }), ...structuredClone(record), updated_at: now };
      if (position >= 0) records[position] = saved; else records.push(saved);
    });
  }
  insert(table: ConfigurationTable, record: ConfigurationRecord): void {
    if (this.current().tables[table].some(item => keys[table]!.every(key => item[key] === record[key]))) throw new Error("配置记录主键重复。");
    this.save(table, { ...(table === "ai_accounts" ? { is_active: 0 } : {}), ...record });
  }
  update(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean, changes: ConfigurationRecord): void { this.mutate(() => { this.current().tables[table] = this.current().tables[table].map(record => predicate(record) ? { ...record, ...structuredClone(changes), updated_at: new Date().toISOString() } : record); }); }
  remove(table: ConfigurationTable, predicate: (record: ConfigurationRecord) => boolean): void { this.mutate(() => { this.current().tables[table] = this.current().tables[table].filter(record => !predicate(record)); }); }
  removeUser(userId: string): void { this.transaction(() => { for (const table of configurationTables) this.remove(table, record => record.user_id === userId); }); }
  close(): void { this.lease.close(); }
}
export const configuration = new ConfigurationDomain();
