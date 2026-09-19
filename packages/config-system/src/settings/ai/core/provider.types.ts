/**
 * 文件：provider.types.ts
 * 作用：定义 AI 配置域的 Provider 插件公共契约。
 * 负责：Provider 元数据、认证方式、配置字段、连接解析和模型发现描述。
 * 不负责：React UI、Secret 明文持久化、模型推理执行、具体宿主网络实现。
 * 状态归属：纯类型契约，无运行时状态。
 * 对外接口：AiProviderPlugin 及相关类型。
 * 关联文件：provider-registry.ts、../providers/<provider>/plugin.ts、../transports/openai-compatible.ts。
 * 修改注意事项：新增厂商差异优先扩展插件数据契约，禁止在 Core 写 providerId 分支。
 */

export type AiProviderId = "openai" | "deepseek" | "zhipu" | "kimi" | "qwen" | "xiaomi";
export type AiProviderProtocol = "openai-compatible" | "codex-app-server" | "provider-native";
export type AiAuthKind = "api-key" | "subscription" | "token-plan";
export type AiConfigFieldKind = "text" | "select";

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
  hostCapability?: "codex-app-server";
  description?: string;
}

export type AiModelDiscovery =
  | { kind: "http-list"; method: "GET"; url: string; responseShape: "openai-model-list" | "qwen-model-list" }
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
}
