/**
 * 功能：工具参数 JSON Schema 的受限子集校验器（手写实现，替代 store 中不存在的 zod）。
 * 作用：在注册与执行边界校验工具声明的 schema 与模型回传参数，拒绝越界关键字与非法值。
 * 关联文件：business-tools.ts（每个工具的 schema/parse）、registry.ts（注册时校验）。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tools/json-schema。
 */

/** 任意无损 JSON 值。 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** enum/const 支持的标量值。 */
export type JsonSchemaScalar = string | number | boolean | null;

/** 受限子集内允许的单类型关键字。 */
export type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

/**
 * 受限子集内的一个原始 JSON Schema 节点。调用方应先经 assertSupportedJsonSchema 校验再信任。
 */
export interface JsonSchemaNode {
  /** 省略 type 表示接受任意无损 JSON 值（注解-only schema），或改用 oneOf。 */
  type?: JsonSchemaType;
  /** 恰好命中一个分支；至少两个分支。 */
  oneOf?: JsonSchemaNode[];
  /** 对象属性 schema（仅 type:object）。 */
  properties?: Record<string, JsonSchemaNode>;
  /** 必填属性名；每个必须出现在 properties 中。 */
  required?: string[];
  /** false 拒绝未声明键；缺省/true 遵循 JSON Schema 开放默认。 */
  additionalProperties?: boolean;
  /** 数组元素 schema（仅 type:array）；缺省接受任意 JSON 元素。 */
  items?: JsonSchemaNode;
  /** 标量节点允许值。 */
  enum?: JsonSchemaScalar[];
  /** 标量节点唯一允许值。 */
  const?: JsonSchemaScalar;
  /** 注解，校验时忽略。 */
  description?: string;
  /** 注解，校验时忽略。 */
  title?: string;
  /** 注解，必须是无损 JSON。 */
  default?: JsonValue;
  /** 注解，必须是无损 JSON。 */
  examples?: JsonValue;
}

/** 调用方约束为对象根的 schema。 */
export type ObjectJsonSchema = JsonSchemaNode & { type: 'object' };

/** 原始 schema 越界时抛出；violations 按遍历顺序列出全部问题而非首个。 */
export class JsonSchemaError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super(`unsupported JSON schema: ${violations.join('; ')}`);
    this.name = 'JsonSchemaError';
    this.violations = violations;
  }
}

/** 穷尽联合的收窄辅助。 */
function assertNever(value: never, label: string): never {
  throw new Error(`unexpected ${label}: ${String(value)}`);
}

const CONSTRAINT_KEYWORDS = new Set([
  'type',
  'oneOf',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
]);
const ANNOTATION_KEYWORDS = new Set(['description', 'title', 'default', 'examples']);
const SCHEMA_TYPES: readonly JsonSchemaType[] = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];

/** 是否为本 realm 内建 Object.prototype。 */
function isIntrinsicObjectPrototype(value: object): boolean {
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    const constructor: unknown = descriptor?.value;
    return typeof constructor === 'function'
      && (constructor as { name?: string }).name === 'Object'
      && (constructor as { prototype?: unknown }).prototype === prototype;
  } catch {
    return false;
  }
}

/** 判断是否为跨 realm 通用的纯 JSON 记录（不接受数组/奇异对象）。 */
export function isPlainJsonRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === null || isIntrinsicObjectPrototype(value);
  } catch {
    return false;
  }
}

/** 判断记录是否仅含可枚举字符串自有键。 */
function hasOnlyEnumerableStringKeys(value: object): boolean {
  try {
    return Reflect.ownKeys(value).every(key => typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch {
    return false;
  }
}

/** 判断是否为能存活 JSON 投影的普通 schema 记录。 */
export function isJsonSchemaRecord(value: unknown): value is Record<string, unknown> {
  return isPlainJsonRecord(value) && hasOnlyEnumerableStringKeys(value);
}

/** 判断是否为无装饰的稠密普通数组。 */
export function isPlainJsonArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!isIntrinsicObjectPrototype(prototype as object)) return false;
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** 无损有限 JSON 数字（排除 -0）。 */
function isJsonNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0);
}

/** 判断标量是否匹配声明的 schema 类型。 */
function scalarMatches(type: Exclude<JsonSchemaType, 'object' | 'array'>, value: unknown): value is JsonSchemaScalar {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return isJsonNumber(value);
    case 'integer': return isJsonNumber(value) && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: return assertNever(type, 'JsonSchemaType');
  }
}

const ONE_OF_SIBLING_KEYWORDS = ['properties', 'required', 'additionalProperties', 'items', 'enum', 'const'] as const;

/** 对象属性遍历收尾校验。 */
function checkObjectSchemaTail(
  node: Record<string, unknown>,
  path: string,
  properties: unknown,
  violations: string[],
): void {
  const hasRequired = Object.hasOwn(node, 'required');
  const required = hasRequired ? node.required : undefined;
  if (hasRequired) {
    if (!isPlainJsonArray(required) || required.some(entry => typeof entry !== 'string')) {
      violations.push(`${path}.required must be an array of strings`);
    } else {
      const declared = isJsonSchemaRecord(properties) ? properties : {};
      for (const key of required as string[]) {
        if (!Object.hasOwn(declared, key)) violations.push(`${path}.required names "${key}" which is not in properties`);
      }
    }
  }
  if (Object.hasOwn(node, 'additionalProperties') && typeof node.additionalProperties !== 'boolean') {
    violations.push(`${path}.additionalProperties must be a boolean`);
  }
}

/** 栈安全地遍历整棵 schema 树并收集全部违规。 */
function checkSchemaNode(root: unknown, rootPath: string, violations: string[], seen: Set<object>): void {
  type Task =
    | { kind: 'enter'; node: unknown; path: string }
    | { kind: 'leave'; node: object }
    | { kind: 'one-of-tail'; node: Record<string, unknown>; path: string }
    | { kind: 'object-tail'; node: Record<string, unknown>; path: string; properties: unknown };
  const tasks: Task[] = [{ kind: 'enter', node: root, path: rootPath }];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === 'leave') {
      seen.delete(task.node);
      continue;
    }
    if (task.kind === 'one-of-tail') {
      for (const key of ONE_OF_SIBLING_KEYWORDS) {
        if (Object.hasOwn(task.node, key)) violations.push(`${task.path}.${key} is not supported beside oneOf`);
      }
      continue;
    }
    if (task.kind === 'object-tail') {
      checkObjectSchemaTail(task.node, task.path, task.properties, violations);
      continue;
    }

    const { node, path } = task;
    if (!isJsonSchemaRecord(node)) {
      violations.push(`${path} must be a schema object`);
      continue;
    }
    if (seen.has(node)) {
      violations.push(`${path} is circular`);
      continue;
    }
    seen.add(node);
    tasks.push({ kind: 'leave', node });

    for (const key of Object.keys(node)) {
      if (CONSTRAINT_KEYWORDS.has(key)) continue;
      if (ANNOTATION_KEYWORDS.has(key)) {
        if (!isJsonValue(node[key])) violations.push(`${path}.${key} annotation must be lossless JSON data`);
        continue;
      }
      violations.push(`${path}.${key} is not a supported keyword (subset: type/oneOf/properties/required/additionalProperties/items/enum/const + annotations)`);
    }
    if (Object.hasOwn(node, 'description') && typeof node.description !== 'string') {
      violations.push(`${path}.description must be a string`);
    }
    if (Object.hasOwn(node, 'title') && typeof node.title !== 'string') {
      violations.push(`${path}.title must be a string`);
    }

    const hasType = Object.hasOwn(node, 'type');
    const hasOneOf = Object.hasOwn(node, 'oneOf');
    if (hasType && hasOneOf) {
      violations.push(`${path} cannot declare both type and oneOf`);
      continue;
    }
    if (!hasType && !hasOneOf) {
      for (const key of ONE_OF_SIBLING_KEYWORDS) {
        if (Object.hasOwn(node, key)) violations.push(`${path}.${key} requires type or oneOf`);
      }
      continue;
    }

    if (hasOneOf) {
      const oneOf = node.oneOf;
      tasks.push({ kind: 'one-of-tail', node, path });
      if (!isPlainJsonArray(oneOf) || oneOf.length < 2) {
        violations.push(`${path}.oneOf must be an array of at least two schemas`);
      } else {
        for (let index = oneOf.length - 1; index >= 0; index--) {
          tasks.push({ kind: 'enter', node: oneOf[index], path: `${path}.oneOf[${index}]` });
        }
      }
      continue;
    }

    const type = node.type;
    if (typeof type !== 'string' || !(SCHEMA_TYPES as readonly unknown[]).includes(type)) {
      violations.push(`${path}.type must be one of ${SCHEMA_TYPES.join('/')}`);
      continue;
    }
    const schemaType = type as JsonSchemaType;
    const allowedFor: Record<string, JsonSchemaType[]> = {
      properties: ['object'],
      required: ['object'],
      additionalProperties: ['object'],
      items: ['array'],
      enum: ['string', 'number', 'integer', 'boolean', 'null'],
      const: ['string', 'number', 'integer', 'boolean', 'null'],
    };
    for (const [key, types] of Object.entries(allowedFor)) {
      if (Object.hasOwn(node, key) && !types.includes(schemaType)) {
        violations.push(`${path}.${key} is not supported on type "${schemaType}"`);
      }
    }

    switch (schemaType) {
      case 'object': {
        const properties = Object.hasOwn(node, 'properties') ? node.properties : undefined;
        tasks.push({ kind: 'object-tail', node, path, properties });
        if (Object.hasOwn(node, 'properties')) {
          if (!isJsonSchemaRecord(properties)) {
            violations.push(`${path}.properties must be an object of schemas`);
          } else {
            const entries = Object.entries(properties);
            for (let index = entries.length - 1; index >= 0; index--) {
              const entry = entries[index];
              if (entry === undefined) continue;
              tasks.push({ kind: 'enter', node: entry[1], path: `${path}.properties.${entry[0]}` });
            }
          }
        }
        break;
      }
      case 'array': {
        if (Object.hasOwn(node, 'items')) tasks.push({ kind: 'enter', node: node.items, path: `${path}.items` });
        break;
      }
      case 'string':
      case 'number':
      case 'integer':
      case 'boolean':
      case 'null': {
        const hasEnum = Object.hasOwn(node, 'enum');
        const allowed = hasEnum ? node.enum : undefined;
        const enumValid = isPlainJsonArray(allowed)
          && allowed.length > 0
          && allowed.every(entry => scalarMatches(schemaType, entry));
        if (hasEnum && !enumValid) {
          violations.push(`${path}.enum must be a non-empty array of ${schemaType} values`);
        }
        const hasConst = Object.hasOwn(node, 'const');
        const declaredConst = hasConst ? node.const : undefined;
        if (hasConst) {
          if (!scalarMatches(schemaType, declaredConst)) {
            violations.push(`${path}.const must be a ${schemaType} value`);
          } else if (enumValid && !(allowed as JsonSchemaScalar[]).includes(declaredConst as JsonSchemaScalar)) {
            violations.push(`${path}.const must be one of ${path}.enum when both are declared`);
          }
        }
        break;
      }
      default: assertNever(schemaType, 'JsonSchemaType');
    }
  }
}

/** 断言任意原始 schema 仅使用受限子集。 */
export function assertSupportedJsonSchema(schema: unknown): asserts schema is JsonSchemaNode {
  const violations: string[] = [];
  checkSchemaNode(schema, 'schema', violations, new Set());
  if (violations.length > 0) throw new JsonSchemaError(violations);
}

/** 断言受限子集外加对象根约束（结构化输出场景）。 */
export function assertObjectJsonSchema(schema: unknown): asserts schema is ObjectJsonSchema {
  const violations: string[] = [];
  checkSchemaNode(schema, 'schema', violations, new Set());
  if (violations.length === 0
    && (!isJsonSchemaRecord(schema) || !Object.hasOwn(schema, 'type') || schema.type !== 'object')) {
    violations.push('schema.type must be "object" (structured output is object-rooted)');
  }
  if (violations.length > 0) throw new JsonSchemaError(violations);
}

/** 安全判断无损 JSON 边界（getter 可能抛错）。 */
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.values(record).every(isJsonValue);
  }
  return false;
}

function diagnosticPath(path: string): string {
  return path === '' ? 'arguments' : path;
}

function propertyPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

interface ValueChild {
  readonly node: JsonSchemaNode;
  readonly value: unknown;
  readonly path: string;
}

interface ValueFrame {
  readonly node: JsonSchemaNode;
  readonly value: unknown;
  readonly path: string;
  catches: boolean;
  phase: 'start' | 'children';
  kind?: 'oneOf' | 'object' | 'array';
  children: ValueChild[];
  childIndex: number;
  violations: string[];
  tailViolations: string[];
  matches: number;
}

function losslessValueViolation(path: string): string[] {
  return [`"${diagnosticPath(path)}" must be a lossless JSON value`];
}

function appendViolations(target: string[], source: readonly string[]): void {
  for (const violation of source) target.push(violation);
}

function valueFrame(node: JsonSchemaNode, value: unknown, path: string): ValueFrame {
  return {
    node, value, path,
    catches: false,
    phase: 'start',
    children: [],
    childIndex: 0,
    violations: [],
    tailViolations: [],
    matches: 0,
  };
}

function checkScalarValue(node: JsonSchemaNode, value: unknown, path: string): string[] {
  const allowed = Object.hasOwn(node, 'enum') ? node.enum : undefined;
  if (allowed !== undefined && !allowed.includes(value as JsonSchemaScalar)) {
    return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(allowed)}`];
  }
  if (Object.hasOwn(node, 'const') && value !== node.const) {
    return [`"${diagnosticPath(path)}" must be ${JSON.stringify(node.const)}`];
  }
  return [];
}

/** 栈安全地按已断言的 schema 校验候选值，返回路径级违规（空数组即合法）。 */
export function validateJsonSchemaValue(schema: JsonSchemaNode, value: unknown, path = 'value'): string[] {
  const frames: ValueFrame[] = [valueFrame(schema, value, path)];
  let rootResult: string[] | undefined;

  const receive = (result: string[]): void => {
    const parent = frames.at(-1);
    if (parent === undefined) {
      rootResult = result;
      return;
    }
    if (parent.kind === 'oneOf') {
      if (result.length === 0) parent.matches++;
    } else {
      appendViolations(parent.violations, result);
    }
  };
  const finish = (result: string[]): void => {
    frames.pop();
    receive(result);
  };

  while (frames.length > 0) {
    const frame = frames.at(-1);
    if (frame === undefined) break;
    try {
      if (frame.phase === 'children') {
        if (frame.childIndex < frame.children.length) {
          const child = frame.children[frame.childIndex];
          if (child === undefined) throw new Error('missing schema-value child frame');
          frame.childIndex++;
          frames.push(valueFrame(child.node, child.value, child.path));
          continue;
        }
        if (frame.kind === 'oneOf') {
          finish(frame.matches === 1 ? [] : [`"${diagnosticPath(frame.path)}" must match exactly one oneOf branch (matched ${frame.matches})`]);
          continue;
        }
        appendViolations(frame.violations, frame.tailViolations);
        if (frame.violations.length > 0) {
          finish(frame.violations);
        } else if (frame.kind === 'object') {
          finish(isJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a lossless JSON object`]);
        } else {
          finish(isJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a dense lossless JSON array`]);
        }
        continue;
      }

      const nodeType = Object.hasOwn(frame.node, 'type') ? frame.node.type : undefined;
      frame.catches = !(nodeType !== undefined && !(SCHEMA_TYPES as readonly unknown[]).includes(nodeType));
      const oneOf = Object.hasOwn(frame.node, 'oneOf') ? frame.node.oneOf : undefined;
      if (oneOf !== undefined) {
        frame.kind = 'oneOf';
        frame.children = oneOf.map(branch => ({ node: branch, value: frame.value, path: frame.path }));
        frame.childIndex = 0;
        frame.matches = 0;
        frame.phase = 'children';
        continue;
      }
      if (nodeType === undefined) {
        finish(isJsonValue(frame.value) ? [] : losslessValueViolation(frame.path));
        continue;
      }

      switch (nodeType) {
        case 'object': {
          if (!isPlainJsonRecord(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an object`]);
            break;
          }
          const properties = Object.hasOwn(frame.node, 'properties') ? frame.node.properties ?? {} : {};
          const violations: string[] = [];
          const required = Object.hasOwn(frame.node, 'required') ? frame.node.required ?? [] : [];
          for (const key of required) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined) {
              violations.push(`missing required property "${propertyPath(frame.path, key)}"`);
            }
          }
          const children: ValueChild[] = [];
          for (const [key, child] of Object.entries(properties)) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === undefined) continue;
            children.push({ node: child, value: frame.value[key], path: propertyPath(frame.path, key) });
          }
          const tailViolations: string[] = [];
          if (Object.hasOwn(frame.node, 'additionalProperties') && frame.node.additionalProperties === false) {
            for (const key of Object.keys(frame.value)) {
              if (!Object.hasOwn(properties, key)) {
                tailViolations.push(`"${propertyPath(frame.path, key)}" is not a declared property (additionalProperties: false)`);
              }
            }
          }
          frame.kind = 'object';
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = violations;
          frame.tailViolations = tailViolations;
          frame.phase = 'children';
          break;
        }
        case 'array': {
          if (!Array.isArray(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an array`]);
            break;
          }
          const items = Object.hasOwn(frame.node, 'items') ? frame.node.items : undefined;
          const children = items === undefined
            ? []
            : frame.value.flatMap((entry, index): ValueChild[] => [{ node: items, value: entry, path: `${frame.path}[${index}]` }]);
          frame.kind = 'array';
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = [];
          frame.phase = 'children';
          break;
        }
        case 'string':
          finish(typeof frame.value === 'string'
            ? checkScalarValue(frame.node, frame.value, frame.path)
            : [`"${diagnosticPath(frame.path)}" must be a string`]);
          break;
        case 'number':
          finish(typeof frame.value !== 'number'
            ? [`"${diagnosticPath(frame.path)}" must be a number`]
            : !isJsonNumber(frame.value)
              ? [`"${diagnosticPath(frame.path)}" must be a finite JSON number`]
              : checkScalarValue(frame.node, frame.value, frame.path));
          break;
        case 'integer':
          finish(!isJsonNumber(frame.value) || !Number.isInteger(frame.value)
            ? [`"${diagnosticPath(frame.path)}" must be an integer`]
            : checkScalarValue(frame.node, frame.value, frame.path));
          break;
        case 'boolean':
          finish(typeof frame.value === 'boolean'
            ? checkScalarValue(frame.node, frame.value, frame.path)
            : [`"${diagnosticPath(frame.path)}" must be a boolean`]);
          break;
        case 'null':
          finish(frame.value === null
            ? checkScalarValue(frame.node, frame.value, frame.path)
            : [`"${diagnosticPath(frame.path)}" must be null`]);
          break;
        default:
          finish(assertNever(nodeType, 'JsonSchemaType'));
      }
    } catch (error) {
      let failed = frames.pop();
      while (failed !== undefined && !failed.catches) failed = frames.pop();
      if (failed === undefined) throw error;
      receive(losslessValueViolation(failed.path));
    }
  }

  return rootResult ?? losslessValueViolation(path);
}
