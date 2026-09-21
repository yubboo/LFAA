/**
 * 文件：plugin.ts
 * 作用：定义 DeepSeek API 配置插件与官方思考参数。
 * 负责：官方 Base URL、API Key、/models 动态发现、DeepSeek V4 官方 reasoning_effort 配置。
 * 不负责：Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：deepSeekProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：模型列表来自官方 /models；推理参数来自 DeepSeek 官方 Thinking Mode 文档。
 */
import type { AiModelCapabilities, AiProviderPlugin } from "../provider-contract.ts";

const BASE = "https://api.deepseek.com";
const CHECKED_AT = "2026-09-19";
const RUNTIME_SOURCE = { kind: "runtime-model-api", label: "DeepSeek GET /models", url: `${BASE}/models`, checkedAt: CHECKED_AT } as const;
const BALANCE_SOURCE = { kind: "official-docs", label: "DeepSeek GET /user/balance", url: "https://api-docs.deepseek.com/api/get-user-balance/", checkedAt: CHECKED_AT } as const;
const THINKING_SOURCE = { kind: "official-docs", label: "DeepSeek Thinking Mode", url: "https://api-docs.deepseek.com/guides/thinking_mode/", checkedAt: CHECKED_AT } as const;

function describeModel(modelId: string): AiModelCapabilities | null {
  if (!modelId.startsWith("deepseek-")) return null;
  return {
    source: THINKING_SOURCE,
    contextWindow: 1_000_000,
    settings: [{
      id: "reasoningEffort",
      label: "思考强度",
      kind: "select",
      requestPath: "reasoning_effort",
      defaultValue: "high",
      options: [
        { value: "none", label: "关闭思考" },
        { value: "low", label: "low" },
        { value: "high", label: "high" },
        { value: "max", label: "max" },
      ],
      help: "官方规定：none 关闭思考；low / high / max 开启并控制强度。",
    }],
    notes: ["DeepSeek V4 官方服务为 1M 上下文；实际可用模型 ID 以当前账户 /models 返回为准。"],
  };
}

export const deepSeekProviderPlugin: AiProviderPlugin = {
  id: "deepseek",
  displayName: "DeepSeek",
  description: "DeepSeek 官方 API。",
  protocols: ["openai-compatible"],
  authMethods: [{ id: "api-key", label: "DeepSeek API Key", kind: "api-key", secretLabel: "API Key", protocol: "openai-compatible" }],
  configFields: [],
  resolveConnection({ authMethodId }) {
    if (authMethodId !== "api-key") throw new Error(`DeepSeek 不支持认证方式：${authMethodId}`);
    return { providerId: "deepseek", authMethodId, protocol: "openai-compatible", baseUrl: BASE, authHeader: { name: "Authorization", scheme: "Bearer" }, modelDiscovery: { kind: "http-list", method: "GET", url: `${BASE}/models`, responseShape: "openai-model-list", source: RUNTIME_SOURCE }, usageDiscovery: { kind: "http-json", method: "GET", url: `${BASE}/user/balance`, responseShape: "deepseek-balance", source: BALANCE_SOURCE } };
  },
  describeModel,
};
