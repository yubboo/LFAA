/**
 * 功能：提供凭据引用、加密记录存储适配与提供方注册服务。
 * 作用：按账户和插件范围路由秘密；凭据内容只在授权消费或 Flow 执行期间进入内存。
 * 关联文件：packages/settings/settings/src/index.ts 注册唯一加密记录存储；packages/credentials/credential-flows/src/index.ts 执行授权 Flow。
 */
import type { Context } from "@deepseek-ai/cordis";

export const name = "lfaaCredentials";

const providerIdPattern = /^[a-z][a-z0-9-]{0,63}$/u;
const referenceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const consumerIdPattern = /^[a-z][a-z0-9-]{0,63}$/u;
const maximumRecordBytes = 65_536;

export interface CredentialReference {
  readonly providerId: string;
  readonly id: string;
}

export interface CredentialDescription {
  readonly configured: boolean;
  readonly source?: string;
  readonly writable: boolean;
}

export type CredentialRecord =
  | { readonly kind: "api-key"; readonly key?: string; readonly env?: Readonly<Record<string, string>> }
  | { readonly kind: "grant"; readonly payload: unknown };

export interface CredentialRecordMetadata {
  readonly reference: CredentialReference;
  readonly kind: CredentialRecord["kind"];
  readonly updatedAt: string;
}

/** Settings 是唯一持久化适配器；载荷以加密记录形式进出本接口。 */
export interface CredentialRecordStore {
  get(ownerId: string, reference: CredentialReference): CredentialRecord | null;
  set(ownerId: string, reference: CredentialReference, record: CredentialRecord): void;
  delete(ownerId: string, reference: CredentialReference): boolean;
  list(ownerId: string): readonly CredentialRecordMetadata[];
}

export interface CredentialSource {
  readonly consumers: readonly string[];
  resolve(ownerId: string, referenceId: string): string | null;
  describe(ownerId: string, referenceId: string): CredentialDescription;
}

export interface CredentialConsumer {
  resolve(ownerId: string, reference: CredentialReference): string | null;
  describe(ownerId: string, reference: CredentialReference): CredentialDescription;
  readRecord(ownerId: string, reference: CredentialReference): CredentialRecord | null;
  describeRecord(ownerId: string, reference: CredentialReference): CredentialRecordMetadata | null;
}

export interface CredentialRegistry {
  register(caller: Context, source: CredentialSource): () => void;
  registerRecordStore(caller: Context, store: CredentialRecordStore): () => void;
  registerRecordOwner(caller: Context, consumers: readonly string[]): () => void;
  createConsumer(caller: Context): CredentialConsumer;
  /** 仅授权 Flow 与凭据提供插件使用；Settings 仍负责加密和持久化。 */
  commitRecord(caller: Context, ownerId: string, reference: CredentialReference, record: CredentialRecord): void;
  deleteRecord(caller: Context, ownerId: string, reference: CredentialReference): boolean;
  listRecords(caller: Context, ownerId: string): readonly CredentialRecordMetadata[];
  providers(): readonly string[];
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaCredentials: CredentialRegistry }
  interface Events {
    "credentials/record-updated"(ownerId: string, reference: CredentialReference, operation: "set" | "delete"): void;
  }
}

export class CredentialReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialReferenceError";
  }
}

export function credentialReference(providerId: string, id: string): CredentialReference {
  if (!providerIdPattern.test(providerId)) throw new CredentialReferenceError("凭据来源标识无效。");
  if (!referenceIdPattern.test(id)) throw new CredentialReferenceError("凭据引用标识无效。");
  return Object.freeze({ providerId, id });
}

/** 从活动插件 Fiber 名称派生稳定的小写连字符范围 ID，调用方不能自行声明其他插件身份。 */
export function credentialPluginId(context: Context): string {
  const fiber = context?.fiber;
  if (!fiber || !fiber.runtime || fiber.uid === 0 || fiber.ctx !== context) throw new CredentialReferenceError("凭据操作必须来自当前运行中的 Cordis 插件上下文。");
  try { fiber.assertActive(); } catch { throw new CredentialReferenceError("凭据操作的 Cordis 插件已经卸载。"); }
  const rawName = fiber.name;
  const pluginId = typeof rawName === "string"
    ? rawName.replace(/([a-z0-9])([A-Z])/gu, "$1-$2").replace(/([A-Z])([A-Z][a-z])/gu, "$1-$2").toLowerCase()
    : "";
  if (!providerIdPattern.test(pluginId)) throw new CredentialReferenceError("Cordis 插件名称不能转换成有效凭据所有者标识。");
  return pluginId;
}

export function normalizeCredentialRecord(input: CredentialRecord): CredentialRecord {
  let encoded: string | undefined;
  try { encoded = JSON.stringify(input); } catch { throw new CredentialReferenceError("凭据记录必须是可序列化的 JSON 数据。"); }
  if (!encoded || Buffer.byteLength(encoded, "utf8") > maximumRecordBytes) throw new CredentialReferenceError("凭据记录不能为空且不得超过 64 KiB。");
  let value: unknown;
  try { value = JSON.parse(encoded) as unknown; } catch { throw new CredentialReferenceError("凭据记录不是有效的 JSON 数据。"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CredentialReferenceError("凭据记录格式无效。");
  const record = value as Record<string, unknown>;
  if (record.kind === "api-key") {
    if (Object.keys(record).some(key => key !== "kind" && key !== "key" && key !== "env")) throw new CredentialReferenceError("API Key 凭据记录包含未知字段。");
    if (record.key !== undefined && (typeof record.key !== "string" || !record.key.trim() || record.key.length > 16_384 || record.key.includes("\0"))) {
      throw new CredentialReferenceError("API Key 凭据记录中的密钥无效。");
    }
    let env: Record<string, string> | undefined;
    if (record.env !== undefined) {
      if (!record.env || typeof record.env !== "object" || Array.isArray(record.env)) throw new CredentialReferenceError("凭据环境变量必须是名称和值组成的对象。");
      const entries = Object.entries(record.env as Record<string, unknown>);
      if (entries.length > 128 || entries.some(([key, item]) => !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(key)
        || typeof item !== "string" || item.length > 4096 || item.includes("\0"))) {
        throw new CredentialReferenceError("凭据环境变量名称或值无效。");
      }
      env = Object.fromEntries(entries) as Record<string, string>;
    }
    return Object.freeze({ kind: "api-key", ...(record.key !== undefined ? { key: record.key } : {}), ...(env ? { env: Object.freeze(env) } : {}) });
  }
  if (record.kind === "grant") {
    if (Object.keys(record).length !== 2 || !Object.hasOwn(record, "payload")) throw new CredentialReferenceError("授权凭据记录必须仅包含 kind 与 payload。");
    return Object.freeze({ kind: "grant", payload: record.payload });
  }
  throw new CredentialReferenceError("不支持的凭据记录类型。");
}

class CredentialRegistryImpl implements CredentialRegistry {
  private readonly sources = new Map<string, CredentialSource>();
  private readonly recordOwners = new Map<string, Map<string, number>>();
  private recordStore: CredentialRecordStore | null = null;

  constructor(private readonly context: Context) {}

  register(caller: Context, source: CredentialSource): () => void {
    const providerId = resolvePluginId(caller, this.context);
    if (!providerIdPattern.test(providerId)) throw new CredentialReferenceError("凭据来源标识无效。");
    if (!source || !Array.isArray(source.consumers) || source.consumers.length === 0
      || source.consumers.some(consumer => !consumerIdPattern.test(consumer))
      || typeof source.resolve !== "function" || typeof source.describe !== "function") {
      throw new CredentialReferenceError("凭据来源必须提供读取、状态说明方法和至少一个明确消费者。");
    }
    if (this.sources.has(providerId)) throw new CredentialReferenceError(`凭据来源重复注册：${providerId}`);
    this.sources.set(providerId, Object.freeze({ ...source, consumers: Object.freeze([...new Set(source.consumers)]) }));
    const registeredSource = this.sources.get(providerId)!;
    return () => { if (this.sources.get(providerId) === registeredSource) this.sources.delete(providerId); };
  }

  registerRecordStore(caller: Context, store: CredentialRecordStore): () => void {
    const ownerId = resolvePluginId(caller, this.context);
    if (ownerId !== "lfaa-settings") throw new CredentialReferenceError("通用凭据记录存储只能由 lfaa-settings Owner 注册。");
    if (!store || typeof store.get !== "function" || typeof store.set !== "function" || typeof store.delete !== "function" || typeof store.list !== "function") {
      throw new CredentialReferenceError("凭据记录存储适配器不完整。");
    }
    if (this.recordStore) throw new CredentialReferenceError("凭据记录存储只能由一个 Settings Owner 注册。");
    this.recordStore = store;
    let registered = true;
    return () => { if (registered && this.recordStore === store) this.recordStore = null; registered = false; };
  }

  registerRecordOwner(caller: Context, consumers: readonly string[]): () => void {
    const providerId = resolvePluginId(caller, this.context);
    if (!providerIdPattern.test(providerId) || !Array.isArray(consumers) || consumers.length === 0 || consumers.length > 64
      || consumers.some(consumer => !consumerIdPattern.test(consumer))) {
      throw new CredentialReferenceError("凭据记录所有者必须声明有效的插件标识和消费者名单。");
    }
    const ownerConsumers = new Set([providerId, ...consumers]);
    const registrations = this.recordOwners.get(providerId) ?? new Map<string, number>();
    for (const consumer of ownerConsumers) registrations.set(consumer, (registrations.get(consumer) ?? 0) + 1);
    this.recordOwners.set(providerId, registrations);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      if (this.recordOwners.get(providerId) !== registrations) return;
      for (const consumer of ownerConsumers) {
        const count = registrations.get(consumer) ?? 0;
        if (count <= 1) registrations.delete(consumer); else registrations.set(consumer, count - 1);
      }
      if (registrations.size === 0) this.recordOwners.delete(providerId);
    };
  }

  createConsumer(caller: Context): CredentialConsumer {
    const consumerId = resolvePluginId(caller, this.context);
    return Object.freeze({
      resolve: (ownerId: string, reference: CredentialReference) => this.resolveFor(consumerId, ownerId, reference),
      describe: (ownerId: string, reference: CredentialReference) => this.describeFor(consumerId, ownerId, reference),
      readRecord: (ownerId: string, reference: CredentialReference) => this.readRecordFor(consumerId, ownerId, reference),
      describeRecord: (ownerId: string, reference: CredentialReference) => this.describeRecordFor(consumerId, ownerId, reference)
    });
  }

  commitRecord(caller: Context, ownerId: string, rawReference: CredentialReference, input: CredentialRecord): void {
    const reference = validateReference(ownerId, rawReference);
    if (resolvePluginId(caller, this.context) !== reference.providerId) throw new CredentialReferenceError("插件只能写入自己所有的凭据记录范围。");
    if (!this.recordOwners.has(reference.providerId)) throw new CredentialReferenceError("凭据记录所有者未登记或已经卸载。");
    if (!this.recordStore) throw new CredentialReferenceError("凭据记录存储尚未就绪。");
    const record = normalizeCredentialRecord(input);
    this.recordStore.set(ownerId, reference, record);
    this.emitRecordUpdated(ownerId, reference, "set");
  }

  deleteRecord(caller: Context, ownerId: string, rawReference: CredentialReference): boolean {
    const reference = validateReference(ownerId, rawReference);
    if (resolvePluginId(caller, this.context) !== reference.providerId) throw new CredentialReferenceError("插件只能删除自己所有的凭据记录范围。");
    if (!this.recordOwners.has(reference.providerId)) throw new CredentialReferenceError("凭据记录所有者未登记或已经卸载。");
    if (!this.recordStore) throw new CredentialReferenceError("凭据记录存储尚未就绪。");
    const removed = this.recordStore.delete(ownerId, reference);
    if (removed) this.emitRecordUpdated(ownerId, reference, "delete");
    return removed;
  }

  listRecords(caller: Context, ownerId: string): readonly CredentialRecordMetadata[] {
    const consumerId = resolvePluginId(caller, this.context);
    validateOwner(ownerId);
    if (!this.recordStore) return Object.freeze([]);
    return Object.freeze(this.recordStore.list(ownerId).map(row => validateMetadata(row))
      .filter(row => row.reference.providerId === consumerId || this.recordOwners.get(row.reference.providerId)?.has(consumerId)));
  }

  providers(): readonly string[] { return Object.freeze([...this.sources.keys()].sort()); }

  private emitRecordUpdated(ownerId: string, reference: CredentialReference, operation: "set" | "delete"): void {
    try { this.context.emit("credentials/record-updated", ownerId, reference, operation); }
    catch (error) {
      const errorName = error instanceof Error ? error.name : "Error";
      this.context.logger("credentials").warn("凭据记录已提交，但变更监听器失败（%s/%s，%s）。", reference.providerId, reference.id, errorName);
    }
  }

  private resolveFor(consumerId: string, ownerId: string, rawReference: CredentialReference): string | null {
    const { source, reference } = this.sourceFor(consumerId, ownerId, rawReference);
    if (!source) return null;
    const value = source.resolve(ownerId, reference.id);
    if (value === null) return null;
    if (typeof value !== "string" || !value.trim() || value.length > 16_384 || value.includes("\0")) {
      throw new CredentialReferenceError("凭据来源返回了无效值。");
    }
    return value;
  }

  private describeFor(consumerId: string, ownerId: string, rawReference: CredentialReference): CredentialDescription {
    const { source, reference } = this.sourceFor(consumerId, ownerId, rawReference);
    if (!source) return Object.freeze({ configured: false, writable: false });
    const value = source.describe(ownerId, reference.id);
    if (typeof value.configured !== "boolean" || typeof value.writable !== "boolean"
      || value.source !== undefined && typeof value.source !== "string") {
      throw new CredentialReferenceError("凭据来源返回了无效状态。");
    }
    return Object.freeze({ ...value });
  }

  private readRecordFor(consumerId: string, ownerId: string, rawReference: CredentialReference): CredentialRecord | null {
    const reference = validateReference(ownerId, rawReference);
    const consumers = this.recordOwners.get(reference.providerId);
    if (!consumers) return null;
    if (!consumers.has(consumerId)) throw new CredentialReferenceError(`凭据消费者“${consumerId}”未获准读取所有者“${reference.providerId}”的记录。`);
    if (!this.recordStore) return null;
    const record = this.recordStore.get(ownerId, reference);
    return record === null ? null : normalizeCredentialRecord(record);
  }

  private describeRecordFor(consumerId: string, ownerId: string, rawReference: CredentialReference): CredentialRecordMetadata | null {
    const reference = validateReference(ownerId, rawReference);
    const consumers = this.recordOwners.get(reference.providerId);
    if (!consumers) return null;
    if (!consumers.has(consumerId)) throw new CredentialReferenceError(`凭据消费者“${consumerId}”未获准读取所有者“${reference.providerId}”的记录。`);
    if (!this.recordStore) return null;
    const row = this.recordStore.list(ownerId).find(item => item.reference.providerId === reference.providerId && item.reference.id === reference.id);
    return row ? validateMetadata(row) : null;
  }

  private sourceFor(consumerId: string, ownerId: string, rawReference: CredentialReference): { source: CredentialSource | undefined; reference: CredentialReference } {
    const reference = validateReference(ownerId, rawReference);
    const source = this.sources.get(reference.providerId);
    if (source && !source.consumers.includes(consumerId)) {
      throw new CredentialReferenceError(`凭据消费者“${consumerId}”未获准读取来源“${reference.providerId}”。`);
    }
    return { source, reference };
  }
}

function validateReference(ownerId: string, reference: CredentialReference): CredentialReference {
  validateOwner(ownerId);
  if (!reference || typeof reference !== "object") throw new CredentialReferenceError("凭据引用格式无效。");
  return credentialReference(reference.providerId, reference.id);
}

function validateOwner(ownerId: string): void {
  if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 160 || /[\u0000-\u001f\u007f]/u.test(ownerId)) {
    throw new CredentialReferenceError("凭据所有者标识无效。");
  }
}

function resolvePluginId(caller: Context, serviceContext: Context): string {
  if (!caller || typeof caller !== "object" || caller.root !== serviceContext.root) throw new CredentialReferenceError("凭据操作不能跨 Cordis Profile。");
  return credentialPluginId(caller);
}

function validateMetadata(input: CredentialRecordMetadata): CredentialRecordMetadata {
  if (!input || typeof input !== "object" || !input.reference || (input.kind !== "api-key" && input.kind !== "grant")
    || typeof input.updatedAt !== "string" || !Number.isFinite(Date.parse(input.updatedAt))) {
    throw new CredentialReferenceError("凭据记录状态无效。");
  }
  return Object.freeze({ reference: credentialReference(input.reference.providerId, input.reference.id), kind: input.kind, updatedAt: input.updatedAt });
}

export function apply(ctx: Context): void {
  ctx.provide(name, new CredentialRegistryImpl(ctx));
}
