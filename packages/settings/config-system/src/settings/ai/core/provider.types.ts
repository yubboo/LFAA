/**
 * 文件：provider.types.ts
 * 作用：定义 AI 配置域的 Provider 插件、官方模型目录和模型能力公共契约。
 * 负责：Provider 元数据、认证方式、配置字段、连接解析、模型发现、官方模型能力与请求参数描述。
 * 不负责：React UI、Secret 明文持久化、模型推理执行、具体宿主网络实现。
 * 状态归属：纯类型契约，无运行时状态。
 * 对外接口：AiProviderPlugin 及相关类型。
 * 关联文件：provider-registry.ts、model-settings.ts、../providers/<provider>/plugin.ts、../transports/*。
 * 修改注意事项：模型能力必须来自官方运行时接口或官方文档；禁止凭模型名猜参数。
 */

export type AiProviderId = "openai" | "deepseek" | "zhipu" | "kimi" | "qwen" | "xiaomi";
export type AiProviderProtocol = "openai-compatible" | "codex-app-server" | "provider-native";
export type AiAuthKind = "api-key" | "subscription" | "token-plan";
/** 宿主可提供的托管认证能力 ID；新增能力只扩展此联合类型，不在 UI/Core 写厂商分支。 */
export type AiHostCapabilityId = "codex-app-server";
export type AiConfigFieldKind = "text" | "select";
export type AiModelSettingValue = string | number | boolean;
export type AiModelSettingKind = "select" | "boolean" | "integer";

export interface AiConfigOption {
  value: string;
  label: string;
}

export interface AiConfigField {
  id: string;
  label: string;
  kind: AiConfigFieldKind;
  required: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: readonly AiConfigOption[];
  help?: string;
}

export interface AiAuthMethod {
  id: string;
  label: string;
  kind: AiAuthKind;
  secretLabel?: string;
  credentialPrefix?: string;
  protocol: AiProviderProtocol;
  hostCapability?: AiHostCapabilityId;
  description?: string;
}

export interface AiModelCapabilitySource {
  kind: "runtime-model-api" | "official-docs";
  label: string;
  url: string;
  checkedAt: string;
}

export interface AiModelSettingOption {
  value: string;
  label: string;
}

export interface AiModelSettingField {
  id: string;
  label: string;
  kind: AiModelSettingKind;
  /** 厂商官方请求体中的真实参数路径，如 reasoning.effort / reasoning_effort / thinking.type。 */
  requestPath: string;
  defaultValue?: AiModelSettingValue;
  options?: readonly AiModelSettingOption[];
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}

export interface AiModelCapabilities {
  source: AiModelCapabilitySource;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputModalities?: readonly ("text" | "image" | "audio" | "video")[];
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  settings: readonly AiModelSettingField[];
  notes?: readonly string[];
}

export interface AiProviderCatalogModel {
  id: string;
  name?: string;
  ownedBy?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export type AiModelDiscovery =
  | { kind: "http-list"; method: "GET"; url: string; responseShape: "openai-model-list" | "qwen-model-list"; source: AiModelCapabilitySource }
  | { kind: "official-catalog"; models: readonly AiProviderCatalogModel[]; source: AiModelCapabilitySource; reason: string }
  | { kind: "manual"; reason: string }
  | { kind: "codex-account"; reason: string };

export interface AiResolvedConnection {
  providerId: AiProviderId;
  authMethodId: string;
  protocol: AiProviderProtocol;
  baseUrl?: string;
  authHeader?: { name: string; scheme?: string };
  modelDiscovery: AiModelDiscovery;
  metadata?: Readonly<Record<string, string>>;
}

export interface AiProviderResolveInput {
  authMethodId: string;
  settings: Readonly<Record<string, string>>;
}

export interface AiProviderPlugin {
  id: AiProviderId;
  displayName: string;
  description: string;
  protocols: readonly AiProviderProtocol[];
  authMethods: readonly AiAuthMethod[];
  configFields: readonly AiConfigField[];
  resolveConnection(input: AiProviderResolveInput): AiResolvedConnection;
  /** 返回该模型经官方资料确认的配置能力；没有可靠官方资料时必须返回 null。 */
  describeModel(modelId: string): AiModelCapabilities | null;
}
