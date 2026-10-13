/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-scope。
 * LFAA 适配：保留 LFAA 原有的 App 可见范围判断（AiCapabilityScope 等，execute-turn 在用），
 * 新增 Cordis 作用域原语——ScopeKey / scopeOf / scopeChainOf / bindScopeParent / scopeTarget，
 * 供 skill 系统等按作用域分层注册能力。
 *
 * 文件：index.ts
 * 功能：(1) AI 能力对 App 的可见范围判断；(2) 作用域上下文原语（身份比较的 scope key + 父子链）。
 * 作用：注册按作用域分层（store.ts 的 ScopedLayers），读合并作用域链、最近层同名覆盖。
 * 关联文件：packages/core/agent、packages/core/tools、packages/core/agent-loop、skill 系统。
 */
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

// ===== 既有 LFAA 能力：App 可见范围判断（保持导出兼容，execute-turn 在用）=====

export interface AiCapabilityScope {
  applicationId: ApplicationId;
  /** 缺省表示使用当前 App 已登记的全部工具；空数组表示不暴露任何工具。 */
  allowedToolNames?: readonly string[];
}

export interface AiScopedCapability {
  applicationIds?: readonly ApplicationId[];
  name?: string;
}

/** 未声明 App 范围表示通用扩展；空范围不对任何 App 可见。 */
export function isApplicationInScope(
  applicationIds: readonly ApplicationId[] | undefined,
  applicationId: ApplicationId
): boolean {
  return applicationIds === undefined || applicationIds.includes(applicationId);
}

/** App 范围与可选的子 Agent 工具允许集取交集，保持输入顺序且不修改来源数组。 */
export function isAiCapabilityInScope(
  capability: AiScopedCapability,
  scope: AiCapabilityScope
): boolean {
  if (!isApplicationInScope(capability.applicationIds, scope.applicationId)) return false;
  if (scope.allowedToolNames === undefined) return true;
  return typeof capability.name === "string" && scope.allowedToolNames.includes(capability.name);
}

export function filterAiCapabilitiesInScope<T extends AiScopedCapability>(
  capabilities: readonly T[],
  scope: AiCapabilityScope
): T[] {
  return capabilities.filter((capability) => isAiCapabilityInScope(capability, scope));
}

// ===== 新增：Cordis 作用域原语（对齐 DSH dsh-scope）=====

export { AnonymousEntries, NamedEntries, ScopedLayers } from "./store.js";
export type { ScopeLayer } from "./store.js";

/** 一个不透明、按身份比较的作用域键。 */
export type ScopeKey = object;

/** createScope 写入上下文的标签。 */
const kScope = Symbol("lfaa.scope");

declare const ScopedBrand: unique symbol;

/** 只承载路由事件的接收器；类型参数仅用于分发校验。 */
export type Scoped<T extends object> = object & { readonly [ScopedBrand]: T };

/** 每个 carrier 的路由键。 */
const carrierKeys = new WeakMap<object, ScopeKey | undefined>();

/** 每个 key 的父作用域：一条关系同时支撑注册视图向下继承与事件准入向上延伸。 */
const scopeParents = new WeakMap<ScopeKey, ScopeKey>();

/** 循环检测的写：bind 与 rebind 共用。 */
function linkScopeParent(key: ScopeKey, parent: ScopeKey): void {
  for (let cursor: ScopeKey | undefined = parent; cursor !== undefined; cursor = scopeParents.get(cursor)) {
    if (cursor === key) throw new Error("lfaa-scope: 作用域父链不能成环。");
  }
  scopeParents.set(key, parent);
}

/** 把 parent 绑定为 key 的外层作用域（一次）。返回唯一可 rebind 的句柄。 */
export function bindScopeParent(key: ScopeKey, parent: ScopeKey): { rebind(parent: ScopeKey): void } {
  if (scopeParents.has(key)) throw new Error("lfaa-scope: 该作用域键已绑定父作用域。");
  linkScopeParent(key, parent);
  return { rebind(next: ScopeKey) { linkScopeParent(key, next); } };
}

/** 读一个 key 的外层作用域；根作用域返回 undefined。 */
export function scopeParentOf(key: ScopeKey): ScopeKey | undefined {
  return scopeParents.get(key);
}

/** 从 key 到根祖先的链：最近者在前 [key, parent, grandparent, ...]。 */
export function scopeChainOf(key: ScopeKey | undefined): ScopeKey[] {
  const chain: ScopeKey[] = [];
  for (let cursor = key; cursor !== undefined; cursor = scopeParents.get(cursor)) chain.push(cursor);
  return chain;
}

/** 读一个上下文继承到的最近 scope 标签；无标签返回 undefined。 */
export function scopeOf(ctx: object): ScopeKey | undefined {
  return (ctx as { [kScope]?: ScopeKey })[kScope];
}

/**
 * 构造一个不透明的事件接收器：保留 base 原有过滤、放行全局（无标签）监听者，
 * 放行键匹配或其祖先的监听者——事件沿父链向上流，不向下。
 */
export function scopeTarget<T extends object>(_base: T, key: ScopeKey | undefined): Scoped<T> {
  // carrier 是无状态路由对象；base（被绑定主体）由 key 表达，无需额外存储。
  const carrier: object = {};
  carrierKeys.set(carrier, key);
  return carrier as Scoped<T>;
}

/** 判断一个值是否是 scopeTarget 构造的接收器。 */
export function isScopeCarrier(value: unknown): value is Scoped<object> {
  return typeof value === "object" && value !== null && carrierKeys.has(value);
}

/** 读 carrier 的路由键；非 carrier 返回 undefined。 */
export function carrierKeyOf(value: unknown): ScopeKey | undefined {
  if (!isScopeCarrier(value)) return undefined;
  return carrierKeys.get(value);
}
