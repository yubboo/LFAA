/**
 * 文件：plugin.ts
 * 作用：定义 DeepSeek API 配置插件。
 * 负责：官方 Base URL、API Key 认证和 /models 发现。
 * 不负责：Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：deepSeekProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：只保留官方配置事实，共享 OpenAI 协议形状由 transports 承担。
 */
import type { AiProviderPlugin } from "../provider-contract.ts";

const BASE = "https://api.deepseek.com";

export const deepSeekProviderPlugin: AiProviderPlugin = {
  id: "deepseek",
  displayName: "DeepSeek",
  description: "DeepSeek 官方 API。",
  protocols: ["openai-compatible"],
  authMethods: [{ id: "api-key", label: "DeepSeek API Key", kind: "api-key", secretLabel: "API Key", protocol: "openai-compatible" }],
  configFields: [],
  resolveConnection({ authMethodId }) {
    if (authMethodId !== "api-key") throw new Error(`DeepSeek 不支持认证方式：${authMethodId}`);
    return {
      providerId: "deepseek",
      authMethodId,
      protocol: "openai-compatible",
      baseUrl: BASE,
      authHeader: { name: "Authorization", scheme: "Bearer" },
      modelDiscovery: { kind: "http-list", method: "GET", url: `${BASE}/models`, responseShape: "openai-model-list" },
    };
  },
};
