/**
 * 功能：定义 LFAA Typert 的 Remote 描述、调用和错误协议。
 * 作用：让插件、Host 适配器和 Client 生成物共用稳定类型，并在跨进程边界限制为有界 JSON。
 * 关联文件：packages/typert/registry、packages/typert/loader、后续 Remote Host/Client 适配器。
 */

/** Remote 线协议接受的有限 JSON 值。 */
export type TypertJsonValue = null | boolean | number | string | readonly TypertJsonValue[] | { readonly [key: string]: TypertJsonValue };
export const MAX_TYPERT_JSON_BYTES = 4 * 1024 * 1024;

/** 运行时解析器；解析成功后返回可安全交给业务处理的值。 */
export interface TypertSchema<Value = unknown> { parse(value: unknown): Value }

/** 生成器输出的 JSON Schema 子集；只描述 Remote 的 JSON 数据形状。 */
export interface TypertJsonSchema {
  readonly $schema?: string;
  readonly type?: "object" | "array" | "string" | "number" | "boolean" | "null";
  readonly const?: string | number | boolean | null;
  readonly anyOf?: readonly TypertJsonSchema[];
  readonly properties?: Readonly<Record<string, TypertJsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | TypertJsonSchema;
  readonly items?: TypertJsonSchema;
}

/** 将生成的 JSON Schema 形状包装为运行时解析器；业务约束仍由对应能力 Owner 追加校验。 */
export function createTypertJsonSchema<Value = unknown>(schema: TypertJsonSchema): TypertSchema<Value> {
  return {
    parse(value: unknown): Value {
      if (!matchesTypertJsonSchema(schema, value, 0)) throw new TypeError("Remote 数据不符合生成的 JSON Schema。");
      return value as Value;
    }
  };
}

/** 一次 Host 调用中由认证 Host 创建的上下文。 */
export interface TypertCallContext<Principal = unknown> {
  readonly requestId: string;
  readonly principal: Principal;
  readonly signal: AbortSignal;
}

/** Client 单次调用选项；取消只表示客户端不再等待，不承诺撤销已发生的业务副作用。 */
export interface TypertRemoteCallOptions { readonly signal?: AbortSignal }

/** 双端共享的一元方法类型映射；构建生成器后续会从 Host 贡献推导这份映射。 */
export interface TypertRemoteClientContract {
  readonly [endpoint: string]: { readonly input: unknown; readonly output: unknown };
}

/** 可由代码生成器输出、同时用于描述与 Host 执行的 Remote 方法。 */
export interface TypertHostMethod {
  readonly id: string;
  readonly namespace: string;
  readonly method: string;
  readonly input: TypertSchema<unknown>;
  readonly output: TypertSchema<unknown>;
  readonly authorize: (context: TypertCallContext<unknown>) => boolean | void | Promise<boolean | void>;
  readonly invoke: (input: unknown, context: TypertCallContext<unknown>) => unknown | Promise<unknown>;
}

/** 一个第一方插件贡献的 Remote 方法集合。 */
export interface TypertContribution { readonly package: string; readonly methods: readonly TypertHostMethod[] }

/** 可公开给生成 Client 的方法描述；不包含 Host 处理函数。 */
export interface TypertRemoteDescriptor {
  readonly id: string;
  readonly package: string;
  readonly namespace: string;
  readonly method: string;
}

/** Typert 协议的稳定错误码；认证和业务错误仍由现有 Owner 决定。 */
export type TypertErrorCode = "invalid_contribution" | "duplicate_method" | "method_not_found" | "invalid_input" | "invalid_output" | "forbidden" | "cancelled" | "closed";

/** Remote 协议错误，保留底层原因供 Host 日志诊断，不应直接序列化 cause。 */
export class TypertError extends Error {
  constructor(readonly code: TypertErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TypertError";
  }
}

/** 组合稳定 Remote endpoint 键。 */
export function typertEndpoint(namespace: string, method: string): string { return `${namespace}/${method}`; }

function matchesTypertJsonSchema(schema: TypertJsonSchema, value: unknown, depth: number): boolean {
  if (depth > 64) return false;
  if (schema.anyOf && !schema.anyOf.some((variant) => matchesTypertJsonSchema(variant, value, depth + 1))) return false;
  if (Object.hasOwn(schema, "const") && !Object.is(schema.const, value)) return false;
  if (schema.type === "string" && typeof value !== "string") return false;
  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return false;
  if (schema.type === "boolean" && typeof value !== "boolean") return false;
  if (schema.type === "null" && value !== null) return false;
  if (schema.type === "array") {
    return Array.isArray(value) && (!schema.items || value.every((item) => matchesTypertJsonSchema(schema.items!, item, depth + 1)));
  }
  if (schema.type !== "object") return true;
  if (!isTypertPlainRecord(value)) return false;
  const properties = schema.properties ?? {};
  for (const property of schema.required ?? []) {
    if (!Object.hasOwn(value, property)) return false;
  }
  for (const [key, item] of Object.entries(value)) {
    const propertySchema = properties[key];
    if (propertySchema) {
      if (!matchesTypertJsonSchema(propertySchema, item, depth + 1)) return false;
      continue;
    }
    if (schema.additionalProperties === false || schema.additionalProperties === undefined) return false;
    if (schema.additionalProperties !== true && !matchesTypertJsonSchema(schema.additionalProperties, item, depth + 1)) return false;
  }
  return true;
}

function isTypertPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** 校验协议输入和输出是否能在有界 JSON 传输中保持语义。 */
export function assertTypertJsonValue(value: unknown): asserts value is TypertJsonValue {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  const encoder = new TextEncoder();
  let visited = 0;
  let encodedBytes = 0;
  const charge = (text: string): void => {
    encodedBytes += encoder.encode(text).byteLength;
    if (encodedBytes > MAX_TYPERT_JSON_BYTES) throw new TypertError("invalid_contribution", "Remote JSON 总字节数超过 4 MiB 协议上限。");
  };
  while (pending.length) {
    const current = pending.pop()!;
    visited += 1;
    if (visited > 100_000 || current.depth > 64) throw new TypertError("invalid_contribution", "Remote 数据超过协议深度或节点上限。");
    const item = current.value;
    if (item === null || typeof item === "boolean") { charge(JSON.stringify(item)); continue; }
    if (typeof item === "string") {
      if (item.length > 1_000_000) throw new TypertError("invalid_contribution", "Remote 字符串超过协议上限。");
      charge(JSON.stringify(item));
      continue;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item) || Object.is(item, -0)) throw new TypertError("invalid_contribution", "Remote 数值必须是有限且可无损传输的数字。");
      charge(JSON.stringify(item));
      continue;
    }
    if (typeof item !== "object") throw new TypertError("invalid_contribution", "Remote 数据包含非 JSON 值。");
    if (seen.has(item)) throw new TypertError("invalid_contribution", "Remote 数据包含循环引用或重复对象。");
    seen.add(item);
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype || item.length > 100_000) throw new TypertError("invalid_contribution", "Remote 数组不是受支持的有界普通数组。");
      charge("[");
      const keys = Reflect.ownKeys(item);
      if (keys.length !== item.length + 1) throw new TypertError("invalid_contribution", "Remote 数组包含稀疏项或额外属性。");
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypertError("invalid_contribution", "Remote 数组必须只包含可枚举的数据项。");
        if (index > 0) charge(",");
        pending.push({ value: descriptor.value, depth: current.depth + 1 });
      }
      charge("]");
      continue;
    }
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== Object.prototype && prototype !== null) throw new TypertError("invalid_contribution", "Remote 对象必须是普通对象。");
    const keys = Reflect.ownKeys(item);
    if (keys.length > 10_000) throw new TypertError("invalid_contribution", "Remote 对象字段过多。");
    charge("{");
    let keyIndex = 0;
    for (const key of keys) {
      if (typeof key !== "string") throw new TypertError("invalid_contribution", "Remote 对象不能包含 Symbol 字段。");
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypertError("invalid_contribution", "Remote 对象必须只包含可枚举的数据字段。");
      if (keyIndex > 0) charge(",");
      charge(JSON.stringify(key));
      charge(":");
      pending.push({ value: descriptor.value, depth: current.depth + 1 });
      keyIndex += 1;
    }
    charge("}");
  }
}

/** 校验一个插件贡献；调用方仍须保留原始解析器与处理函数。 */
export function validateTypertContribution(contribution: TypertContribution): void {
  if (!contribution || typeof contribution !== "object" || !isPackageName(contribution.package)) throw new TypertError("invalid_contribution", "Typert 插件贡献必须声明有效包名。");
  if (!Array.isArray(contribution.methods)) throw new TypertError("invalid_contribution", "Typert 插件贡献必须提供方法数组。");
  const ids = new Set<string>();
  const endpoints = new Set<string>();
  for (const candidate of contribution.methods as readonly unknown[]) {
    if (!candidate || typeof candidate !== "object") throw new TypertError("invalid_contribution", "Typert 方法描述必须是对象。");
    const method = candidate as Partial<TypertHostMethod>;
    if (!isIdentifier(method.id) || !isIdentifier(method.namespace) || !isIdentifier(method.method)) throw new TypertError("invalid_contribution", "Typert 方法 ID、命名空间或方法名无效。");
    if (!method.input || typeof method.input.parse !== "function" || !method.output || typeof method.output.parse !== "function" || typeof method.authorize !== "function" || typeof method.invoke !== "function") {
      throw new TypertError("invalid_contribution", `Typert 方法 ${method.namespace}/${method.method} 缺少解析器、授权器或执行函数。`);
    }
    const endpoint = typertEndpoint(method.namespace, method.method);
    if (ids.has(method.id) || endpoints.has(endpoint)) throw new TypertError("duplicate_method", `Typert 贡献中存在重复方法：${endpoint}。`);
    ids.add(method.id);
    endpoints.add(endpoint);
  }
}

/** 将泛型方法声明安全擦除为运行注册表可保存的形式。 */
export function defineTypertMethod<Input, Output, Principal = unknown>(method: {
  readonly id: string;
  readonly namespace: string;
  readonly method: string;
  readonly input: TypertSchema<Input>;
  readonly output: TypertSchema<Output>;
  readonly authorize: (context: TypertCallContext<Principal>) => boolean | void | Promise<boolean | void>;
  readonly invoke: (input: Input, context: TypertCallContext<Principal>) => Output | Promise<Output>;
}): TypertHostMethod {
  return method as unknown as TypertHostMethod;
}

function isIdentifier(value: unknown): value is string { return typeof value === "string" && value.length <= 128 && /^[a-z0-9][a-z0-9._-]*$/u.test(value); }
function isPackageName(value: unknown): value is string { return typeof value === "string" && value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(value); }
