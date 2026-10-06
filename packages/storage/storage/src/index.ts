/** 功能：提供插件化存储枢纽。作用：登记多个介质后端和领域数据形式，不持有数据或执行 IO。 */
import type { Context } from "@deepseek-ai/cordis";
import type { KvUnitDescriptor } from "./backend.js";
import { UNIT_NAME_RE } from "./backend.js";
import { BackendRegistry } from "./registry.js";
import { StorageError } from "./error.js";

export { BackendRegistry } from "./registry.js";
export { StorageError } from "./error.js";
export type { StorageErrorCode } from "./error.js";
export { UNIT_NAME_RE } from "./backend.js";
export type { StorageBackend, KvFacet, KvUnit, KvUnitDescriptor } from "./backend.js";

export function storageBackendServiceKey(name: string): string { return `lfaa.storage.backend.${name}`; }

export interface StorageForms {}

export function validateKvUnitDescriptor(descriptor: KvUnitDescriptor): void {
  if (!UNIT_NAME_RE.test(descriptor.name)) throw new TypeError(`存储单元名称无效：“${descriptor.name}”。`);
  if (!Number.isSafeInteger(descriptor.version) || descriptor.version < 0) throw new TypeError("存储单元版本必须是非负安全整数。");
  if (typeof descriptor.hasGlobal !== "boolean") throw new TypeError("存储单元必须明确声明是否包含全局记录。");
  const tables = new Set<string>();
  for (const table of descriptor.tables) {
    if (!UNIT_NAME_RE.test(table)) throw new TypeError(`存储表名称无效：“${table}”。`);
    if (tables.has(table)) throw new TypeError(`存储单元重复声明数据表：“${table}”。`);
    tables.add(table);
  }
  if (tables.size === 0) throw new TypeError("存储单元至少需要声明一个数据表。");
  if (descriptor.layout !== undefined && descriptor.layout !== "single" && descriptor.layout !== "per-record") {
    throw new TypeError("存储单元布局只支持 single 或 per-record。");
  }
  const versions = new Set<number>();
  for (const version of descriptor.compatibleVersions ?? []) {
    if (!Number.isSafeInteger(version) || version < 0 || version === descriptor.version || versions.has(version)) {
      throw new TypeError("兼容版本必须是非负、唯一且不同于当前版本的安全整数。");
    }
    versions.add(version);
  }
}

export class StorageHub {
  readonly backend = new BackendRegistry();
  private readonly forms = new Map<keyof StorageForms, unknown>();

  mount<K extends keyof StorageForms>(form: K, facility: StorageForms[K]): () => void {
    if (this.forms.has(form)) throw new StorageError("duplicate-mount", `存储数据形式“${String(form)}”已挂载。`);
    this.forms.set(form, facility);
    return () => { if (this.forms.get(form) === facility) this.forms.delete(form); };
  }

  form<K extends keyof StorageForms>(form: K): StorageForms[K] {
    if (!this.forms.has(form)) throw new StorageError("form-not-mounted", `存储数据形式“${String(form)}”尚未挂载。`);
    return this.forms.get(form) as StorageForms[K];
  }

  get domain(): StorageForms extends { domain: infer Domain } ? Domain : never {
    return this.form("domain" as keyof StorageForms);
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaStorageHub: StorageHub }
}

export const name = "lfaaStorageHub";
export function apply(ctx: Context): void {
  const hub = new StorageHub();
  ctx.provide(name, hub);
}
