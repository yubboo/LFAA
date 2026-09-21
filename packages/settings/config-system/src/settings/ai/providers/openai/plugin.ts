/**
 * 文件：plugin.ts
 * 作用：定义 OpenAI 的配置 Provider 插件与官方模型能力。
 * 负责：OpenAI API Key / ChatGPT 套餐入口、官方 API Base URL、/models 发现、已核对模型的官方推理参数。
 * 不负责：Codex App Server 生命周期、Secret 明文持久化、推理 Runtime。
 * 状态归属：静态插件描述，无状态。
 * 对外接口：openAiProviderPlugin。
 * 关联文件：../provider-contract.ts、../../transports/openai-compatible.ts。
 * 修改注意事项：模型参数必须以 developers.openai.com 官方模型页为事实源；未知模型不得猜能力。
 */
import type { AiModelCapabilities, AiProviderPlugin } from "../provider-contract.ts";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const CHECKED_AT = "2026-09-19";
const DOCS_MODELS = "https://developers.openai.com/api/docs/models";
const RUNTIME_SOURCE = { kind: "runtime-model-api", label: "OpenAI GET /v1/models", url: `${OPENAI_API_BASE}/models`, checkedAt: CHECKED_AT } as const;
const CODEX_USAGE_SOURCE = { kind: "official-docs", label: "Codex App Server account/rateLimits/read + account/usage/read", url: "https://developers.openai.com/codex/app-server", checkedAt: "2026-09-21" } as const;
const API_USAGE_SOURCE = { kind: "official-docs", label: "OpenAI API usage/billing", url: "https://platform.openai.com/usage", checkedAt: "2026-09-21" } as const;
const DOCS_SOURCE = { kind: "official-docs", label: "OpenAI Models", url: DOCS_MODELS, checkedAt: CHECKED_AT } as const;

function reasoningCapabilities(modelId: string): AiModelCapabilities | null {
  if (modelId === "gpt-6-astra") return {
    source: DOCS_SOURCE,
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    inputModalities: ["text", "image"],
    supportsTools: true,
    supportsStructuredOutput: true,
    settings: [
      { id: "reasoningEffort", label: "思考强度", kind: "select", requestPath: "reasoning.effort", options: ["low", "medium", "high", "xhigh", "max"].map((value) => ({ value, label: value })) },
      { id: "maxOutputTokens", label: "最大输出 Tokens", kind: "integer", requestPath: "max_output_tokens", min: 1, max: 128_000, step: 1 },
    ],
    notes: ["GPT-6 Astra 不支持 reasoning.effort=none。"],
  };
  if (["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"].includes(modelId)) return {
    source: DOCS_SOURCE,
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    inputModalities: ["text", "image"],
    supportsTools: true,
    supportsStructuredOutput: true,
    settings: [
      { id: "reasoningEffort", label: "思考强度", kind: "select", requestPath: "reasoning.effort", options: ["none", "low", "medium", "high", "xhigh", "max"].map((value) => ({ value, label: value })) },
      { id: "maxOutputTokens", label: "最大输出 Tokens", kind: "integer", requestPath: "max_output_tokens", min: 1, max: 128_000, step: 1 },
    ],
  };
  if (modelId === "chat-latest") return { source: DOCS_SOURCE, contextWindow: 400_000, maxOutputTokens: 128_000, inputModalities: ["text", "image"], settings: [] };
  return null;
}

export const openAiProviderPlugin: AiProviderPlugin = {
  id: "openai",
  displayName: "OpenAI",
  description: "OpenAI API 与 ChatGPT/Codex 套餐认证。",
  protocols: ["openai-compatible", "codex-app-server"],
  authMethods: [
    { id: "api-key", label: "OpenAI API Key", kind: "api-key", secretLabel: "API Key", credentialPrefix: "sk-", protocol: "openai-compatible" },
    { id: "chatgpt", label: "ChatGPT 套餐", kind: "subscription", protocol: "codex-app-server", hostCapability: "codex-app-server", description: "通过 Codex App Server 的 ChatGPT OAuth / Device Code 登录。" },
  ],
  configFields: [],
  resolveConnection({ authMethodId }) {
    if (authMethodId === "chatgpt") return { providerId: "openai", authMethodId, protocol: "codex-app-server", modelDiscovery: { kind: "codex-account", reason: "模型与套餐权限由 Codex/ChatGPT 账户上下文提供。" }, usageDiscovery: { kind: "managed-account", source: CODEX_USAGE_SOURCE, reason: "Codex App Server 提供真实 Codex/Work 速率限制与 Token 活动；这不是标准 ChatGPT Chat 消息额度。" } };
    if (authMethodId !== "api-key") throw new Error(`OpenAI 不支持认证方式：${authMethodId}`);
    return { providerId: "openai", authMethodId, protocol: "openai-compatible", baseUrl: OPENAI_API_BASE, authHeader: { name: "Authorization", scheme: "Bearer" }, modelDiscovery: { kind: "http-list", method: "GET", url: `${OPENAI_API_BASE}/models`, responseShape: "openai-model-list", source: RUNTIME_SOURCE }, usageDiscovery: { kind: "official-unavailable", source: API_USAGE_SOURCE, reason: "标准 OpenAI API Key 不提供可直接读取账户余额的稳定官方端点；组织用量/费用接口需要单独的 Admin 权限，LFAA 不会拿普通模型 Key 猜余额。" } };
  },
  describeModel: reasoningCapabilities,
};
