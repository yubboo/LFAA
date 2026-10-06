/** 功能：定义具名存储后端与 KV 单元合同。作用：解耦存储介质和领域数据语义。 */
export const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/u;

export interface StorageBackend {
  readonly kv?: KvFacet;
  close(): Promise<void>;
}

export interface KvFacet {
  open(descriptor: KvUnitDescriptor): Promise<KvUnit>;
}

export interface KvUnitDescriptor {
  readonly name: string;
  readonly version: number;
  readonly tables: readonly string[];
  readonly hasGlobal: boolean;
  readonly layout?: "single" | "per-record";
  readonly compatibleVersions?: readonly number[];
}

export interface KvUnit {
  loadAll(): Promise<{ tables: Record<string, Record<string, unknown>>; global: unknown }>;
  putRecord(table: string, key: string, value: unknown): Promise<void>;
  deleteRecord(table: string, key: string): Promise<void>;
  backupRecord?(table: string, key: string): Promise<string>;
  setGlobal(value: unknown): Promise<void>;
  close(): Promise<void>;
}
