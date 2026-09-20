/**
 * 文件：config-schema.ts
 * 作用：定义 LFAA 配置系统唯一的版本化 TypeScript Schema 与默认配置。
 * 负责：根配置、Settings、Runtime Mode、Provider、Model、Account、Permission Default 的可序列化契约。
 * 不负责：SQLite/Drizzle 持久化、Migration 执行、Secret 明文、UI、权限执行。
 * 状态归属：Config Schema Version 与配置结构归 @lfaa/config-system 单一拥有。
 * 对外接口：CONFIG_SCHEMA_VERSION、LfaaConfig 及子类型、DEFAULT_LFAA_CONFIG、createDefaultLfaaConfig。
 * 关联文件：config-validator.ts、index.ts、../README.md。
 * 修改注意事项：产品版本与 Schema Version 必须分离；Secret 只能以 credentialRef 引用，禁止新增明文字段。
 */

export const CONFIG_SCHEMA_VERSION = 1 as const;

export type ConfigSchemaVersion = typeof CONFIG_SCHEMA_VERSION;
export type ThemePreference = "system" | "light" | "dark";
export type RuntimeMode = "local" | "remote";
export type PermissionPreset = "ask" | "auto" | "full";
export type AccountAuthType = "api-key" | "oauth" | "local" | "none";

export interface AppSettingsConfig {
  language: string;
  theme: ThemePreference;
  telemetryEnabled: boolean;
}

export interface RuntimeModeConfig {
  mode: RuntimeMode;
  remoteEndpoint: string | null;
}

export interface ModelProviderConfig {
  id: string;
  kind: string;
  displayName: string;
  baseUrl: string | null;
  enabled: boolean;
}

export interface AccountMetadataConfig {
  id: string;
  providerId: string;
  displayName: string;
  authType: AccountAuthType;
  credentialRef: string | null;
  enabled: boolean;
}

export interface ModelConfig {
  id: string;
  providerId: string;
  accountId: string | null;
  model: string;
  displayName: string;
  enabled: boolean;
}

export interface PermissionDefaultsConfig {
  preset: PermissionPreset;
}

export interface LfaaConfig {
  schemaVersion: ConfigSchemaVersion;
  settings: AppSettingsConfig;
  runtime: RuntimeModeConfig;
  providers: readonly ModelProviderConfig[];
  accounts: readonly AccountMetadataConfig[];
  models: readonly ModelConfig[];
  permissions: PermissionDefaultsConfig;
}

export const DEFAULT_LFAA_CONFIG: LfaaConfig = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  settings: {
    language: "zh-CN",
    theme: "system",
    telemetryEnabled: false,
  },
  runtime: {
    mode: "local",
    remoteEndpoint: null,
  },
  providers: [],
  accounts: [],
  models: [],
  permissions: {
    preset: "ask",
  },
};

export function createDefaultLfaaConfig(): LfaaConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    settings: { ...DEFAULT_LFAA_CONFIG.settings },
    runtime: { ...DEFAULT_LFAA_CONFIG.runtime },
    providers: [],
    accounts: [],
    models: [],
    permissions: { ...DEFAULT_LFAA_CONFIG.permissions },
  };
}
