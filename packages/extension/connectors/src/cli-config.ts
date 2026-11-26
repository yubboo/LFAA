// 校验 CLI 连接器配置与动作模板：占位符、参数 schema、argv 结构与危险字符都在这里拦住，执行层不再兜底。
import { isAbsolute } from "node:path";
import type {
  CliActionConfig,
  CliArgConfig,
  CliConnectorConfig,
  CliParamConfig,
  CliParamType,
  ConnectorTrust,
} from "../contract";

export class ConnectorConfigError extends Error {}

const CONNECTOR_ID = /^[a-z][a-z0-9-]{0,39}$/u;
const ACTION_ID = /^[a-z][a-z0-9_]{0,39}$/u;
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/u;
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu;

const MAX_ACTIONS = 24;
const MAX_PARAMS = 16;
const MAX_ARGV = 40;
const MAX_TEXT = 512;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConnectorConfigError("Expected a JSON object.");
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== "string" || value.includes("\0")) throw new ConnectorConfigError(`${field} must be text.`);
  if (value.length > max) throw new ConnectorConfigError(`${field} is too long.`);
  return value;
}

function optionalText(value: unknown, field: string, fallback: string, max = MAX_TEXT): string {
  return value === undefined ? fallback : text(value, field, max).trim();
}

function paramType(value: unknown): CliParamType {
  return value === "number" || value === "boolean" ? value : "string";
}

function parseParam(name: string, input: unknown): CliParamConfig {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/u.test(name)) throw new ConnectorConfigError("Parameter names must be alphanumeric.");
  const raw = record(input);
  const type = paramType(raw.type);
  const description = optionalText(raw.description, `Parameter ${name} description`, "");
  const param: CliParamConfig = { type, description };
  if (typeof raw.required === "boolean") param.required = raw.required;
  if (raw.enum !== undefined) {
    if (!Array.isArray(raw.enum) || raw.enum.length === 0 || raw.enum.length > 32) {
      throw new ConnectorConfigError(`Parameter ${name} has an invalid enum.`);
    }
    if (type !== "string") throw new ConnectorConfigError(`Parameter ${name}: only string parameters can use enum.`);
    param.enum = raw.enum.map((item) => text(item, `Parameter ${name} enum`, 64));
    if (new Set(param.enum).size !== param.enum.length) throw new ConnectorConfigError(`Parameter ${name} has duplicate enum values.`);
  }
  if (raw.default !== undefined) {
    const fallback = raw.default;
    const valid = type === "number" ? typeof fallback === "number" && Number.isFinite(fallback)
      : type === "boolean" ? typeof fallback === "boolean" : typeof fallback === "string";
    if (!valid) throw new ConnectorConfigError(`Parameter ${name} default does not match its type.`);
    param.default = fallback as string | number | boolean;
    if (param.enum && typeof param.default === "string" && !param.enum.includes(param.default)) {
      throw new ConnectorConfigError(`Parameter ${name} default is not in its enum.`);
    }
  }
  return param;
}

function collectPlaceholders(value: string, where: string, params: Record<string, CliParamConfig>): void {
  for (const match of value.matchAll(PLACEHOLDER)) {
    const name = match[1] ?? "";
    if (!Object.hasOwn(params, name)) throw new ConnectorConfigError(`${where} references unknown parameter "${name}".`);
  }
}

function parseArg(input: unknown, index: number, params: Record<string, CliParamConfig>): CliArgConfig {
  if (typeof input === "string") {
    const value = text(input, `argv[${index}]`);
    if (!value.trim()) throw new ConnectorConfigError(`argv[${index}] must not be empty.`);
    collectPlaceholders(value, `argv[${index}]`, params);
    return value;
  }
  const raw = record(input);
  const arg = text(raw.arg, `argv[${index}].arg`, 256);
  if (!arg.trim()) throw new ConnectorConfigError(`argv[${index}].arg must not be empty.`);
  collectPlaceholders(arg, `argv[${index}].arg`, params);
  const entry: CliArgConfig = { arg };
  if (raw.when !== undefined) {
    const when = text(raw.when, `argv[${index}].when`, 64);
    if (!Object.hasOwn(params, when) || params[when]?.type !== "boolean") {
      throw new ConnectorConfigError(`argv[${index}].when must reference a boolean parameter.`);
    }
    entry.when = when;
  }
  if (raw.value !== undefined) {
    const value = text(raw.value, `argv[${index}].value`);
    collectPlaceholders(value, `argv[${index}].value`, params);
    entry.value = value;
  }
  return entry;
}

function parseAction(input: unknown, used: Set<string>): CliActionConfig {
  const raw = record(input);
  const id = text(raw.id, "Action id", 40);
  if (!ACTION_ID.test(id)) throw new ConnectorConfigError("Action ids use lowercase letters, digits and underscores.");
  if (used.has(id)) throw new ConnectorConfigError(`Duplicate action id "${id}".`);
  used.add(id);
  const title = text(raw.title ?? id, "Action title", 120).trim() || id;
  const description = optionalText(raw.description, "Action description", title);
  const params: Record<string, CliParamConfig> = {};
  const rawParams = raw.params === undefined ? {} : record(raw.params);
  if (Object.keys(rawParams).length > MAX_PARAMS) throw new ConnectorConfigError(`Action ${id} has too many parameters.`);
  for (const [name, value] of Object.entries(rawParams)) params[name] = parseParam(name, value);
  if (!Array.isArray(raw.argv) || raw.argv.length === 0 || raw.argv.length > MAX_ARGV) {
    throw new ConnectorConfigError(`Action ${id} needs 1–${MAX_ARGV} argv entries.`);
  }
  const action: CliActionConfig = {
    id,
    title,
    description,
    readOnly: raw.readOnly === true,
    argv: raw.argv.map((entry, index) => parseArg(entry, index, params)),
    params,
  };
  if (raw.trust !== undefined) {
    if (raw.trust !== "ask" && raw.trust !== "trusted") throw new ConnectorConfigError(`Action ${id} has an invalid approval policy.`);
    action.trust = raw.trust;
  }
  if (raw.timeoutMs !== undefined) {
    const timeout = Number(raw.timeoutMs);
    if (!Number.isFinite(timeout)) throw new ConnectorConfigError(`Action ${id} has an invalid timeout.`);
    action.timeoutMs = Math.min(300_000, Math.max(1_000, Math.round(timeout)));
  }
  return action;
}

/** 校验并归一化一个 CLI 连接器；更新时未出现的字段沿用上一版。 */
export function parseCliConnector(id: string, input: unknown, previous?: CliConnectorConfig): CliConnectorConfig {
  const trimmedId = id.trim();
  if (!CONNECTOR_ID.test(trimmedId)) throw new ConnectorConfigError("Connector ids use lowercase letters, digits and dashes.");
  const patch = record(input);
  const enabled = patch.enabled ?? previous?.enabled ?? true;
  if (typeof enabled !== "boolean") throw new ConnectorConfigError("Invalid enabled status.");
  const trust = (patch.trust ?? previous?.trust ?? "ask") as ConnectorTrust;
  if (trust !== "ask" && trust !== "trusted") throw new ConnectorConfigError("Invalid approval policy.");
  const project = Object.hasOwn(patch, "projectId") ? patch.projectId : previous?.projectId ?? null;
  const projectId = project === null ? null : text(project, "Project", 120);
  const executable = optionalText(patch.executable, "Executable", previous?.executable ?? "").trim();
  if (!executable) throw new ConnectorConfigError("Enter an executable name or path.");
  const cwd = optionalText(patch.cwd, "Working directory", previous?.cwd ?? "").trim();
  if (cwd && !isAbsolute(cwd)) throw new ConnectorConfigError("Working directory must be an absolute path.");
  const rawEnv = patch.env === undefined ? previous?.env ?? {} : record(patch.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    if (!ENV_KEY.test(key)) throw new ConnectorConfigError(`Invalid environment variable name "${key}".`);
    env[key] = text(value, `Environment variable ${key}`, 2048);
  }
  const probeArgs = patch.probeArgs === undefined ? previous?.probeArgs ?? ["--version"] : patch.probeArgs;
  if (!Array.isArray(probeArgs) || probeArgs.length > 10) throw new ConnectorConfigError("Probe arguments must be a short array.");
  const actionInput = patch.actions === undefined ? previous?.actions ?? [] : patch.actions;
  if (!Array.isArray(actionInput) || actionInput.length === 0 || actionInput.length > MAX_ACTIONS) {
    throw new ConnectorConfigError(`A connector needs 1–${MAX_ACTIONS} actions.`);
  }
  const used = new Set<string>();
  return {
    id: trimmedId,
    name: optionalText(patch.name, "Name", previous?.name ?? trimmedId, 120).trim() || trimmedId,
    description: optionalText(patch.description, "Description", previous?.description ?? "", 400).trim(),
    enabled,
    projectId,
    trust,
    executable,
    cwd,
    env,
    probeArgs: probeArgs.map((value, index) => text(value, `probeArgs[${index}]`, 256)),
    actions: actionInput.map((action) => parseAction(action, used)),
  };
}

/** 供列表与编辑回填使用的深拷贝，避免响应对象被调用方改写。 */
export function cloneConnector(config: CliConnectorConfig): CliConnectorConfig {
  return structuredClone(config);
}

/** 解析导入内容：单个连接器对象、连接器数组，或 `{ connectors: [...] }`；导入一律先停用。 */
export function parseConnectorImport(payload: unknown): CliConnectorConfig[] {
  const body: unknown = Array.isArray(payload) ? payload : record(payload);
  const entries: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray((body as Record<string, unknown>).connectors) ? (body as Record<string, unknown>).connectors as unknown[] : [body];
  if (entries.length === 0 || entries.length > 20) throw new ConnectorConfigError("导入需要 1–20 个连接器。");
  const seen = new Set<string>();
  return entries.map((entry) => {
    const raw = record(entry);
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id) throw new ConnectorConfigError("导入的连接器缺少 id。");
    if (seen.has(id)) throw new ConnectorConfigError(`导入内容里有重复的连接器 id：${id}。`);
    seen.add(id);
    return parseCliConnector(id, { ...raw, enabled: false }, undefined);
  });
}