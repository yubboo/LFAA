/**
 * 文件：plugin.ts
 * 作用：定义 OpenAI 的配置 Provider 插件。
 * 负责：OpenAI API Key 与 ChatGPT 套餐认证入口、官方 API Base URL、模型发现配置。
 * 不负责：Codex App Server 进程生命周期、Secret 明文持久化、推理 Runtime。
 * 状态归属：静态插件描述，无状态。
 * 对外接口：openAiProviderPlugin。
 * 关联文件：../provider-contract.ts、../../transports/openai-compatible.ts。
 * 修改注意事项：ChatGPT 套餐必须走官方 Codex App Server 认证能力，禁止模拟 Cookie 登录。
 */
import type { AiProviderPlugin } from "../provider-contract.ts";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export const openAiProviderPlugin: AiProviderPlugin = {
  id: "openai",
  displayName: "OpenAI",
  description: "OpenAI API 与 ChatGPT/Codex 套餐认证。",
  protocols: ["openai-compatible", "codex-app-server"],
  authMethods: [
    {
      id: "api-key",
      label: "OpenAI API Key",
      kind: "api-key",
      secretLabel: "API Key",
      credentialPrefix: "sk-",
      protocol: "openai-compatible",
    },
    {
      id: "chatgpt",
      label: "ChatGPT 套餐",
      kind: "subscription",
      protocol: "codex-app-server",
      hostCapability: "codex-app-server",
      description: "通过 Codex App Server 的 ChatGPT OAuth / Device Code 登录。",
    },
  ],
  configFields: [],
  resolveConnection({ authMethodId }) {
    if (authMethodId === "chatgpt") {
      return {
        providerId: "openai",
        authMethodId,
        protocol: "codex-app-server",
        modelDiscovery: { kind: "codex-account", reason: "模型与套餐权限由 Codex/ChatGPT 账户上下文提供。" },
      };
    }
    if (authMethodId !== "api-key") throw new Error(`OpenAI 不支持认证方式：${authMethodId}`);
    return {
      providerId: "openai",
      authMethodId,
      protocol: "openai-compatible",
      baseUrl: OPENAI_API_BASE,
      authHeader: { name: "Authorization", scheme: "Bearer" },
      modelDiscovery: { kind: "http-list", method: "GET", url: `${OPENAI_API_BASE}/models`, responseShape: "openai-model-list" },
    };
  },
};
