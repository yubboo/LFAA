/** 功能：把原子 JSON 文件后端接入通用存储枢纽。作用：提供单文档与逐记录 KV 布局。 */
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import type { KvFacet, KvUnit, KvUnitDescriptor, StorageBackend } from "lfaa-storage-hub/src/index.js";
import { StorageError, validateKvUnitDescriptor } from "lfaa-storage-hub/src/index.js";
import { decode, encode, JsonStorageBackend } from "./index.js";

interface SingleDocument {
  name: string;
  version: number;
  tables: Record<string, Record<string, unknown>>;
  global?: unknown;
}

interface RecordDocument {
  name: string;
  table: string;
  key: string;
  version: number;
  value: unknown;
}

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function recordName(unit: string, table: string, key: string): string { return `r_${digest(unit)}_${digest(table)}_${digest(key)}`; }
function emptyTables(descriptor: KvUnitDescriptor): Record<string, Record<string, unknown>> {
  return Object.fromEntries(descriptor.tables.map(table => [table, Object.create(null) as Record<string, unknown>]));
}
function clone<T>(value: T): T { return structuredClone(value); }
function copyPersistable(value: unknown): unknown {
  const text = encode(value);
  if (typeof text !== "string") throw new TypeError("JSON 存储值必须可编码为 JSON。");
  return decode(text);
}
function snapshotTables(tables: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(Object.entries(tables).map(([table, records]) => [table, Object.fromEntries(Object.entries(records).map(([key, value]) => [key, clone(value)]))]));
}

/** 适配器持有 JSON 介质句柄；枢纽只负责名称注册和生命周期路由。 */
export class JsonStorageKvBackend implements StorageBackend {
  readonly kv: KvFacet = { open: descriptor => this.openUnit(descriptor) };
  private readonly units = new Map<string, JsonStorageKvUnit>();
  private closed = false;

  constructor(private readonly medium: JsonStorageBackend) {}

  async openUnit(descriptor: KvUnitDescriptor): Promise<KvUnit> {
    validateKvUnitDescriptor(descriptor);
    if (this.closed) throw new StorageError("closed", "JSON 存储后端已关闭。");
    if (this.units.has(descriptor.name)) throw new Error(`存储单元“${descriptor.name}”已打开。`);
    const unit = new JsonStorageKvUnit(this.medium, descriptor, () => this.units.delete(descriptor.name));
    this.units.set(descriptor.name, unit);
    try { await unit.loadAll(); return unit; }
    catch (error) { this.units.delete(descriptor.name); throw error; }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all([...this.units.values()].map(unit => unit.close()));
  }
}

class JsonStorageKvUnit implements KvUnit {
  private readonly layout: "single" | "per-record";
  private readonly versionSet: ReadonlySet<number>;
  private readonly dataFile: string;
  private readonly prefix: string;
  private readonly metadataFile: string;
  private readonly globalFile: string;
  private readonly tables: Record<string, Record<string, unknown>>;
  private globalValue: unknown = null;
  private globalPresent = false;
  private closed = false;
  private loaded = false;

  constructor(private readonly medium: JsonStorageBackend, private readonly descriptor: KvUnitDescriptor, private readonly onClose: () => void) {
    this.layout = descriptor.layout ?? "single";
    this.versionSet = new Set([descriptor.version, ...(descriptor.compatibleVersions ?? [])]);
    this.dataFile = `unit_${digest(descriptor.name)}`;
    this.prefix = `r_${digest(descriptor.name)}_`;
    this.metadataFile = `meta_${digest(descriptor.name)}`;
    this.globalFile = `global_${digest(descriptor.name)}`;
    this.tables = emptyTables(descriptor);
  }

  async loadAll(): Promise<{ tables: Record<string, Record<string, unknown>>; global: unknown }> {
    this.assertOpen();
    if (!this.loaded) {
      if (this.layout === "single") this.loadSingle();
      else this.loadPerRecord();
      this.loaded = true;
    }
    return { tables: snapshotTables(this.tables), global: this.globalPresent ? clone(this.globalValue) : null };
  }

  async putRecord(table: string, key: string, value: unknown): Promise<void> {
    this.assertRecord(table, key);
    const copied = copyPersistable(value);
    if (this.layout === "single") {
      const next = clone(this.tables);
      next[table]![key] = copied;
      const document: SingleDocument = { name: this.descriptor.name, version: this.descriptor.version, tables: next };
      if (this.descriptor.hasGlobal && this.globalPresent) document.global = this.globalValue;
      this.medium.write(this.dataFile, document);
      this.tables[table]![key] = copied;
    } else {
      this.ensureRecordMetadata();
      this.medium.write(recordName(this.descriptor.name, table, key), {
        name: this.descriptor.name, table, key, version: this.descriptor.version, value: copied
      } satisfies RecordDocument);
      this.tables[table]![key] = copied;
    }
  }

  async deleteRecord(table: string, key: string): Promise<void> {
    this.assertRecord(table, key);
    if (this.layout === "single") {
      if (!(key in this.tables[table]!)) return;
      const next = clone(this.tables);
      delete next[table]![key];
      const document: SingleDocument = { name: this.descriptor.name, version: this.descriptor.version, tables: next };
      if (this.descriptor.hasGlobal && this.globalPresent) document.global = this.globalValue;
      this.medium.write(this.dataFile, document);
      delete this.tables[table]![key];
    } else {
      this.medium.remove(recordName(this.descriptor.name, table, key));
      delete this.tables[table]![key];
    }
  }

  async backupRecord(table: string, key: string): Promise<string> {
    this.assertRecord(table, key);
    if (this.layout !== "per-record") throw new StorageError("malformed-medium", "单文档布局不支持逐记录备份。");
    const source = resolve(this.medium.root, `${recordName(this.descriptor.name, table, key)}.json`);
    const backup = `backup_${randomUUID().replaceAll("-", "")}`;
    if (this.medium.read(recordName(this.descriptor.name, table, key)) === undefined) return "";
    renameSync(source, resolve(this.medium.root, `${backup}.json`));
    delete this.tables[table]![key];
    return backup;
  }

  async setGlobal(value: unknown): Promise<void> {
    this.assertOpen();
    if (!this.descriptor.hasGlobal) throw new StorageError("malformed-medium", `存储单元“${this.descriptor.name}”未声明全局记录。`);
    const copied = copyPersistable(value);
    if (this.layout === "single") {
      const document: SingleDocument = { name: this.descriptor.name, version: this.descriptor.version, tables: clone(this.tables), global: copied };
      this.medium.write(this.dataFile, document);
    } else {
      this.ensureRecordMetadata();
      this.medium.write(this.globalFile, { name: this.descriptor.name, version: this.descriptor.version, value: copied });
    }
    this.globalPresent = true;
    this.globalValue = copied;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }

  private loadSingle(): void {
    const saved = this.medium.read(this.dataFile);
    if (saved === undefined) return;
    const document = this.asRecord(saved, "单文档") as unknown as SingleDocument;
    if (document.name !== this.descriptor.name || document.version !== this.descriptor.version) {
      throw new StorageError("version-mismatch", `JSON 存储单元“${this.descriptor.name}”版本不匹配。`);
    }
    this.loadTables(document.tables);
    if (this.descriptor.hasGlobal && Object.hasOwn(document, "global")) {
      this.globalPresent = true;
      this.globalValue = document.global;
    }
  }

  private loadPerRecord(): void {
    const meta = this.medium.read(this.metadataFile);
    if (meta !== undefined) {
      const record = this.asRecord(meta, "单元元数据");
      if (record.name !== this.descriptor.name || record.version !== this.descriptor.version) {
        throw new StorageError("version-mismatch", `JSON 存储单元“${this.descriptor.name}”版本不匹配。`);
      }
    }
    const filenames = readdirSync(this.medium.root).filter(file => file.startsWith(this.prefix) && file.endsWith(".json"));
    for (const filename of filenames) {
      const name = filename.slice(0, -5);
      const value = this.medium.read(name);
      if (value === undefined) continue;
      const record = this.asRecord(value, "逐记录文档") as unknown as RecordDocument;
      if (record.name !== this.descriptor.name || !this.descriptor.tables.includes(record.table) || typeof record.key !== "string") {
        throw new StorageError("malformed-medium", `JSON 存储单元“${this.descriptor.name}”包含无效记录。`);
      }
      if (!this.versionSet.has(record.version)) continue;
      this.tables[record.table]![record.key] = record.value;
    }
    if (this.descriptor.hasGlobal) {
      const saved = this.medium.read(this.globalFile);
      if (saved !== undefined) {
        const record = this.asRecord(saved, "全局记录");
        if (record.name !== this.descriptor.name || !this.versionSet.has(Number(record.version))) {
          throw new StorageError("version-mismatch", `JSON 存储单元“${this.descriptor.name}”全局记录版本不匹配。`);
        }
        this.globalPresent = true;
        this.globalValue = record.value;
      }
    }
  }

  private loadTables(value: unknown): void {
    const saved = this.asRecord(value, "数据表");
    for (const [table, records] of Object.entries(saved)) {
      if (!this.descriptor.tables.includes(table) || records === null || typeof records !== "object" || Array.isArray(records)) {
        throw new StorageError("malformed-medium", `JSON 存储单元“${this.descriptor.name}”的数据表无效。`);
      }
      this.tables[table] = Object.assign(Object.create(null) as Record<string, unknown>, records);
    }
  }

  private ensureRecordMetadata(): void {
    if (this.medium.read(this.metadataFile) !== undefined) return;
    this.medium.write(this.metadataFile, {
      name: this.descriptor.name, version: this.descriptor.version, tables: this.descriptor.tables,
      hasGlobal: this.descriptor.hasGlobal, layout: this.layout
    });
  }

  private asRecord(value: unknown, label: string): Record<string, unknown> {
    try {
      const copied = decode(JSON.stringify(value));
      if (!copied || typeof copied !== "object" || Array.isArray(copied)) throw new Error("对象格式无效");
      return copied as Record<string, unknown>;
    } catch (error) {
      throw new StorageError("malformed-medium", `JSON 存储单元“${this.descriptor.name}”的${label}损坏。`, { cause: error });
    }
  }

  private assertRecord(table: string, key: string): void {
    this.assertOpen();
    if (!this.descriptor.tables.includes(table)) throw new StorageError("malformed-medium", `存储表“${table}”未在单元中声明。`);
    if (this.layout === "per-record" && !/^[A-Za-z0-9_-]+$/u.test(key)) {
      throw new StorageError("malformed-medium", "逐记录布局的记录键只允许字母、数字、下划线和连字符。");
    }
  }

  private assertOpen(): void { if (this.closed) throw new StorageError("closed", `JSON 存储单元“${this.descriptor.name}”已关闭。`); }
}
