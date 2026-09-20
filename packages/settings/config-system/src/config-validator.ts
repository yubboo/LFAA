/**
 * 文件：config-validator.ts
 * 作用：对不可信 JSON 输入执行 Config Schema v1 的确定性运行时校验。
 * 负责：字段形状、枚举、ID 唯一性、引用完整性、URL、credentialRef 与 Secret 明文字段拒绝。
 * 不负责：数据库 I/O、网络连接、Secret 解析、业务权限决策、Migration。
 * 状态归属：校验规则与 config-schema.ts 同属 @lfaa/config-system；不持有运行时配置状态。
 * 对外接口：ConfigValidationError、validateLfaaConfig、parseLfaaConfig。
 * 关联文件：config-schema.ts、index.ts、../test/config-schema.test.mjs。
 * 修改注意事项：校验必须保持纯内存 O(n)；禁止为便利而接受未知字段或 Secret 明文字段。
 */

import {
  CONFIG_SCHEMA_VERSION,
  type AccountAuthType,
  type AccountMetadataConfig,
  type AppSettingsConfig,
  type LfaaConfig,
  type ModelConfig,
  type ModelProviderConfig,
  type PermissionDefaultsConfig,
  type PermissionPreset,
  type RuntimeMode,
  type RuntimeModeConfig,
  type ThemePreference,
} from "./config-schema.ts";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CREDENTIAL_REF_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]{1,512}$/;
const SECRET_KEY_FRAGMENTS = [
  "apikey",
  "accesstoken",
  "refreshtoken",
  "token",
  "clientsecret",
  "privatekey",
  "password",
  "passwd",
  "secret",
] as const;
const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export class ConfigValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ConfigValidationError";
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new ConfigValidationError(path, message);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainRecord(value)) fail(path, "必须是普通 JSON 对象");
  return value;
}

function assertAllowedKeys(record: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) fail(`${path}.${key}`, "未知字段");
  }
  for (const key of allowed) {
    if (!Object.hasOwn(record, key)) fail(`${path}.${key}`, "缺少必填字段");
  }
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSecretPlaintextKey(key: string): boolean {
  const normalized = normalizedKey(key);
  if (normalized === "credentialref") return false;
  return SECRET_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function assertNoSecretOrDangerousKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretOrDangerousKeys(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) fail(`${path}.${key}`, "危险对象键被禁止");
    if (isSecretPlaintextKey(key)) fail(`${path}.${key}`, "配置中禁止 Secret 明文字段，只允许 credentialRef");
    assertNoSecretOrDangerousKeys(child, `${path}.${key}`);
  }
}

function expectString(value: unknown, path: string, options?: { min?: number; max?: number }): string {
  if (typeof value !== "string") fail(path, "必须是字符串");
  const min = options?.min ?? 1;
  const max = options?.max ?? 512;
  if (value.length < min || value.length > max) fail(path, `长度必须在 ${min}..${max} 之间`);
  return value;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "必须是布尔值");
  return value;
}

function expectNullableString(value: unknown, path: string, max = 512): string | null {
  if (value === null) return null;
  return expectString(value, path, { max });
}

function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, "必须是数组");
  if (value.length > 1000) fail(path, "单个配置集合最多 1000 项");
  return value;
}

function expectOneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(path, `必须是 ${allowed.join(" / ")} 之一`);
  }
  return value as T;
}

function expectId(value: unknown, path: string): string {
  const id = expectString(value, path, { max: 128 });
  if (!ID_PATTERN.test(id)) fail(path, "ID 仅允许字母、数字、点、下划线、冒号和连字符，且必须以字母或数字开头");
  return id;
}

function expectHttpUrlOrNull(value: unknown, path: string): string | null {
  const text = expectNullableString(value, path, 2048);
  if (text === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return fail(path, "必须是合法 URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") fail(path, "只允许 http / https URL");
  return text;
}

function expectCredentialRef(value: unknown, path: string): string | null {
  const ref = expectNullableString(value, path, 640);
  if (ref === null) return null;
  if (!CREDENTIAL_REF_PATTERN.test(ref)) fail(path, "credentialRef 必须使用 scheme:value 形式");
  return ref;
}

function validateSettings(value: unknown): AppSettingsConfig {
  const record = expectRecord(value, "config.settings");
  assertAllowedKeys(record, ["language", "theme", "telemetryEnabled"], "config.settings");
  return {
    language: expectString(record.language, "config.settings.language", { max: 32 }),
    theme: expectOneOf<ThemePreference>(record.theme, ["system", "light", "dark"], "config.settings.theme"),
    telemetryEnabled: expectBoolean(record.telemetryEnabled, "config.settings.telemetryEnabled"),
  };
}

function validateRuntime(value: unknown): RuntimeModeConfig {
  const record = expectRecord(value, "config.runtime");
  assertAllowedKeys(record, ["mode", "remoteEndpoint"], "config.runtime");
  const mode = expectOneOf<RuntimeMode>(record.mode, ["local", "remote"], "config.runtime.mode");
  const remoteEndpoint = expectHttpUrlOrNull(record.remoteEndpoint, "config.runtime.remoteEndpoint");
  if (mode === "local" && remoteEndpoint !== null) fail("config.runtime.remoteEndpoint", "local 模式必须为 null");
  if (mode === "remote" && remoteEndpoint === null) fail("config.runtime.remoteEndpoint", "remote 模式必须提供 endpoint");
  return { mode, remoteEndpoint };
}

function validateProvider(value: unknown, index: number): ModelProviderConfig {
  const path = `config.providers[${index}]`;
  const record = expectRecord(value, path);
  assertAllowedKeys(record, ["id", "kind", "displayName", "baseUrl", "enabled"], path);
  return {
    id: expectId(record.id, `${path}.id`),
    kind: expectString(record.kind, `${path}.kind`, { max: 64 }),
    displayName: expectString(record.displayName, `${path}.displayName`, { max: 128 }),
    baseUrl: expectHttpUrlOrNull(record.baseUrl, `${path}.baseUrl`),
    enabled: expectBoolean(record.enabled, `${path}.enabled`),
  };
}

function validateAccount(value: unknown, index: number): AccountMetadataConfig {
  const path = `config.accounts[${index}]`;
  const record = expectRecord(value, path);
  assertAllowedKeys(record, ["id", "providerId", "displayName", "authType", "credentialRef", "enabled"], path);
  const authType = expectOneOf<AccountAuthType>(
    record.authType,
    ["api-key", "oauth", "local", "none"],
    `${path}.authType`,
  );
  const credentialRef = expectCredentialRef(record.credentialRef, `${path}.credentialRef`);
  if ((authType === "api-key" || authType === "oauth") && credentialRef === null) {
    fail(`${path}.credentialRef`, `${authType} 账号必须提供 credentialRef`);
  }
  if ((authType === "local" || authType === "none") && credentialRef !== null) {
    fail(`${path}.credentialRef`, `${authType} 账号不得绑定 credentialRef`);
  }
  return {
    id: expectId(record.id, `${path}.id`),
    providerId: expectId(record.providerId, `${path}.providerId`),
    displayName: expectString(record.displayName, `${path}.displayName`, { max: 128 }),
    authType,
    credentialRef,
    enabled: expectBoolean(record.enabled, `${path}.enabled`),
  };
}

function validateModel(value: unknown, index: number): ModelConfig {
  const path = `config.models[${index}]`;
  const record = expectRecord(value, path);
  assertAllowedKeys(record, ["id", "providerId", "accountId", "model", "displayName", "enabled"], path);
  const accountId = record.accountId === null ? null : expectId(record.accountId, `${path}.accountId`);
  return {
    id: expectId(record.id, `${path}.id`),
    providerId: expectId(record.providerId, `${path}.providerId`),
    accountId,
    model: expectString(record.model, `${path}.model`, { max: 256 }),
    displayName: expectString(record.displayName, `${path}.displayName`, { max: 128 }),
    enabled: expectBoolean(record.enabled, `${path}.enabled`),
  };
}

function validatePermissions(value: unknown): PermissionDefaultsConfig {
  const record = expectRecord(value, "config.permissions");
  assertAllowedKeys(record, ["preset"], "config.permissions");
  return {
    preset: expectOneOf<PermissionPreset>(record.preset, ["ask", "auto", "full"], "config.permissions.preset"),
  };
}

export function validateLfaaConfig(input: unknown): asserts input is LfaaConfig {
  assertNoSecretOrDangerousKeys(input, "config");
  const root = expectRecord(input, "config");
  assertAllowedKeys(root, ["schemaVersion", "settings", "runtime", "providers", "accounts", "models", "permissions"], "config");

  if (root.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    fail("config.schemaVersion", `仅支持 Config Schema Version ${CONFIG_SCHEMA_VERSION}`);
  }

  validateSettings(root.settings);
  validateRuntime(root.runtime);

  const providers = expectArray(root.providers, "config.providers").map(validateProvider);
  const providerIds = new Set<string>();
  for (const provider of providers) {
    if (providerIds.has(provider.id)) fail("config.providers", `Provider ID 重复：${provider.id}`);
    providerIds.add(provider.id);
  }

  const accounts = expectArray(root.accounts, "config.accounts").map(validateAccount);
  const accountsById = new Map<string, AccountMetadataConfig>();
  for (const account of accounts) {
    if (!providerIds.has(account.providerId)) fail("config.accounts", `账号 ${account.id} 引用了不存在的 Provider ${account.providerId}`);
    if (accountsById.has(account.id)) fail("config.accounts", `Account ID 重复：${account.id}`);
    accountsById.set(account.id, account);
  }

  const models = expectArray(root.models, "config.models").map(validateModel);
  const modelIds = new Set<string>();
  for (const model of models) {
    if (!providerIds.has(model.providerId)) fail("config.models", `模型 ${model.id} 引用了不存在的 Provider ${model.providerId}`);
    if (modelIds.has(model.id)) fail("config.models", `Model ID 重复：${model.id}`);
    modelIds.add(model.id);
    if (model.accountId !== null) {
      const account = accountsById.get(model.accountId);
      if (!account) fail("config.models", `模型 ${model.id} 引用了不存在的 Account ${model.accountId}`);
      if (account.providerId !== model.providerId) {
        fail("config.models", `模型 ${model.id} 与账号 ${model.accountId} 的 Provider 不一致`);
      }
    }
  }

  validatePermissions(root.permissions);
}

export function parseLfaaConfig(input: unknown): LfaaConfig {
  validateLfaaConfig(input);
  return input;
}
