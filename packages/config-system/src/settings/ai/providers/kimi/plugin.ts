/**
 * 文件：plugin.ts
 * 作用：定义 Kimi / Moonshot 开放平台配置插件与官方思考模型能力。
 * 负责：中国/国际 Base URL、API Key、/models 动态发现、Kimi 官方 thinking/reasoning 参数。
 * 不负责：消费会员权益冒充 API 额度、Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：kimiProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：模型能力只来自 Kimi API 官方文档；未知模型不得继承其他模型参数。
 */
import type { AiModelCapabilities, AiProviderPlugin } from "../provider-contract.ts";

const BASES: Record<string, string> = { china: "https://api.moonshot.cn/v1", international: "https://api.moonshot.ai/v1" };
const CHECKED_AT = "2026-09-19";
const THINKING_SOURCE = { kind: "official-docs", label: "Kimi 思考模型", url: "https://platform.kimi.com/docs/guide/use-thinking-models", checkedAt: CHECKED_AT } as const;

function describeModel(modelId: string): AiModelCapabilities | null {
  if (modelId === "kimi-k3") return {
    source: THINKING_SOURCE,
    settings: [{ id: "reasoningEffort", label: "思考强度", kind: "select", requestPath: "reasoning_effort", defaultValue: "max", options: ["low", "high", "max"].map((value) => ({ value, label: value })) }],
    notes: ["Kimi K3 始终思考，不支持 thinking.type；reasoning_effort 默认 max。"],
  };
  if (modelId === "kimi-k2.7-code" || modelId === "kimi-k2.7-code-highspeed") return {
    source: THINKING_SOURCE,
    settings: [],
    notes: ["Kimi K2.7 Code 始终思考，不支持关闭，也不支持 reasoning_effort。"],
  };
  if (modelId === "kimi-k2.6") return {
    source: THINKING_SOURCE,
    settings: [{ id: "thinkingType", label: "思考模式", kind: "select", requestPath: "thinking.type", defaultValue: "enabled", options: [{ value: "enabled", label: "开启" }, { value: "disabled", label: "关闭" }] }],
    notes: ["Kimi K2.6 默认开启思考；官方文档要求思考模型不要自定义 temperature。"],
  };
  return null;
}

export const kimiProviderPlugin: AiProviderPlugin = {
  id: "kimi",
  displayName: "Kimi",
  description: "Moonshot/Kimi 开放平台 API。",
  protocols: ["openai-compatible"],
  authMethods: [{ id: "api-key", label: "Kimi API Key", kind: "api-key", secretLabel: "API Key", protocol: "openai-compatible" }],
  configFields: [{ id: "region", label: "区域", kind: "select", required: true, defaultValue: "china", options: [{ value: "china", label: "中国" }, { value: "international", label: "国际" }] }],
  resolveConnection({ authMethodId, settings }) {
    if (authMethodId !== "api-key") throw new Error(`Kimi 不支持认证方式：${authMethodId}`);
    const region = settings.region || "china";
    const baseUrl = BASES[region];
    if (!baseUrl) throw new Error(`未知 Kimi 区域：${region}`);
    return { providerId: "kimi", authMethodId, protocol: "openai-compatible", baseUrl, authHeader: { name: "Authorization", scheme: "Bearer" }, modelDiscovery: { kind: "http-list", method: "GET", url: `${baseUrl}/models`, responseShape: "openai-model-list", source: { kind: "runtime-model-api", label: "Kimi GET /v1/models", url: `${baseUrl}/models`, checkedAt: CHECKED_AT } }, metadata: { region } };
  },
  describeModel,
};
