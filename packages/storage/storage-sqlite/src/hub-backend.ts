/** 功能：把控制端 SQLite 数据库接入通用存储枢纽。作用：复用当前数据库连接，不另开数据库或改变业务表归属。 */
import type { KvFacet, KvUnit, KvUnitDescriptor, StorageBackend } from "lfaa-storage-hub/src/index.js";
import { StorageError, validateKvUnitDescriptor } from "lfaa-storage-hub/src/index.js";
import { database } from "./database.js";

interface StoredUnit { version: number; descriptor_json: string }
interface StoredRecord { table_name: string; record_key: string; value_json: string }

function normalizedDescriptor(descriptor: KvUnitDescriptor): string {
  return JSON.stringify({
    name: descriptor.name, version: descriptor.version, tables: [...descriptor.tables].sort(),
    hasGlobal: descriptor.hasGlobal, layout: descriptor.layout ?? "single"
  });
}

function parseValue(text: string, location: string): unknown {
  try { return JSON.parse(text) as unknown; }
  catch (error) { throw new StorageError("malformed-medium", `SQLite 存储记录“${location}”不是有效 JSON。`, { cause: error }); }
}

function stringifyValue(value: unknown): string {
  const text = JSON.stringify(value);
  if (text === undefined) throw new TypeError("SQLite 存储值必须可编码为 JSON。");
  return text;
}

function snapshotTables(tables: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(Object.entries(tables).map(([table, records]) => [table, Object.fromEntries(Object.entries(records))]));
}

/** SQLite 适配器只操作专用通用 KV 表；账户、设置和领域业务仍由原包负责。 */
export class SqliteStorageKvBackend implements StorageBackend {
  readonly kv: KvFacet = { open: descriptor => this.openUnit(descriptor) };
  private readonly units = new Map<string, SqliteStorageKvUnit>();
  private closed = false;

  private assertSchemaReady(): void {
    // database.ts 在打开数据库时完成 v40 事务迁移；缺表表示迁移没有成功，插件必须失败关闭。
    try {
      database.prepare("SELECT name FROM lfaa_hub_storage_units LIMIT 0");
      database.prepare("SELECT unit_name FROM lfaa_hub_storage_records LIMIT 0");
      database.prepare("SELECT unit_name FROM lfaa_hub_storage_globals LIMIT 0");
    } catch (error) {
      throw new StorageError("backend-not-ready", "SQLite 存储 Hub 迁移尚未完成，暂不允许打开 KV 单元。", { cause: error });
    }
  }

  async openUnit(descriptor: KvUnitDescriptor): Promise<KvUnit> {
    validateKvUnitDescriptor(descriptor);
    if (this.closed) throw new StorageError("closed", "SQLite 存储后端已关闭。");
    this.assertSchemaReady();
    if (this.units.has(descriptor.name)) throw new StorageError("malformed-medium", `存储单元“${descriptor.name}”已打开。`);
    const stored = database.prepare("SELECT version, descriptor_json FROM lfaa_hub_storage_units WHERE name = ?").get(descriptor.name) as StoredUnit | undefined;
    const expected = normalizedDescriptor(descriptor);
    if (!stored) {
      database.prepare("INSERT INTO lfaa_hub_storage_units(name, version, descriptor_json) VALUES (?, ?, ?)").run(descriptor.name, descriptor.version, expected);
    } else if (stored.version !== descriptor.version) {
      throw new StorageError("version-mismatch", `SQLite 存储单元“${descriptor.name}”版本不匹配。`);
    } else if (stored.descriptor_json !== expected) {
      throw new StorageError("malformed-medium", `SQLite 存储单元“${descriptor.name}”的表结构描述与当前插件不一致。`);
    }
    const unit = new SqliteStorageKvUnit(descriptor, () => this.units.delete(descriptor.name));
    this.units.set(descriptor.name, unit);
    return unit;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all([...this.units.values()].map(unit => unit.close()));
  }
}

class SqliteStorageKvUnit implements KvUnit {
  private closed = false;
  constructor(private readonly descriptor: KvUnitDescriptor, private readonly onClose: () => void) {}

  async loadAll(): Promise<{ tables: Record<string, Record<string, unknown>>; global: unknown }> {
    this.assertOpen();
    const tables = Object.fromEntries(this.descriptor.tables.map(table => [table, Object.create(null) as Record<string, unknown>]));
    const records = database.prepare("SELECT table_name, record_key, value_json FROM lfaa_hub_storage_records WHERE unit_name = ? ORDER BY table_name, record_key").all(this.descriptor.name) as unknown as StoredRecord[];
    for (const record of records) {
      if (!this.descriptor.tables.includes(record.table_name)) throw new StorageError("malformed-medium", `SQLite 存储单元“${this.descriptor.name}”包含未声明的数据表。`);
      tables[record.table_name]![record.record_key] = parseValue(record.value_json, `${record.table_name}/${record.record_key}`);
    }
    const global = this.descriptor.hasGlobal
      ? database.prepare("SELECT value_json FROM lfaa_hub_storage_globals WHERE unit_name = ?").get(this.descriptor.name) as { value_json: string } | undefined
      : undefined;
    return { tables: snapshotTables(tables), global: global ? parseValue(global.value_json, `${this.descriptor.name}/global`) : null };
  }

  async putRecord(table: string, key: string, value: unknown): Promise<void> {
    this.assertRecord(table, key);
    database.prepare(`
      INSERT INTO lfaa_hub_storage_records(unit_name, table_name, record_key, value_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(unit_name, table_name, record_key) DO UPDATE SET value_json = excluded.value_json
    `).run(this.descriptor.name, table, key, stringifyValue(value));
  }

  async deleteRecord(table: string, key: string): Promise<void> {
    this.assertRecord(table, key);
    database.prepare("DELETE FROM lfaa_hub_storage_records WHERE unit_name = ? AND table_name = ? AND record_key = ?").run(this.descriptor.name, table, key);
  }

  async setGlobal(value: unknown): Promise<void> {
    this.assertOpen();
    if (!this.descriptor.hasGlobal) throw new StorageError("malformed-medium", `存储单元“${this.descriptor.name}”未声明全局记录。`);
    database.prepare(`
      INSERT INTO lfaa_hub_storage_globals(unit_name, value_json) VALUES (?, ?)
      ON CONFLICT(unit_name) DO UPDATE SET value_json = excluded.value_json
    `).run(this.descriptor.name, stringifyValue(value));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }

  private assertRecord(table: string, key: string): void {
    this.assertOpen();
    if (!this.descriptor.tables.includes(table)) throw new StorageError("malformed-medium", `存储表“${table}”未在单元中声明。`);
    if ((this.descriptor.layout ?? "single") === "per-record" && !/^[A-Za-z0-9_-]+$/u.test(key)) {
      throw new StorageError("malformed-medium", "逐记录布局的记录键只允许字母、数字、下划线和连字符。");
    }
  }

  private assertOpen(): void { if (this.closed) throw new StorageError("closed", `SQLite 存储单元“${this.descriptor.name}”已关闭。`); }
}
