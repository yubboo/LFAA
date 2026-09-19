/**
 * 文件：plugin.ts
 * 作用：定义 Kimi / Moonshot 开放平台配置插件。
 * 负责：中国/国际区域 Base URL、API Key 认证和 OpenAI-compatible 模型发现。
 * 不负责：Kimi 消费会员权益冒充 API 额度、Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：kimiProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：开放平台 API Key 与消费端会员/其他权益必须保持概念分离。
 */
import type { AiProviderPlugin } from "../provider-contract.ts";

const BASES: Record<string, string> = {
  china: "https://api.moonshot.cn/v1",
  international: "https://api.moonshot.ai/v1",
};

export const kimiProviderPlugin: AiProviderPlugin = {
  id: "kimi",
  displayName: "Kimi",
  description: "Moonshot/Kimi 开放平台 API。",
  protocols: ["openai-compatible"],
  authMethods: [{ id: "api-key", label: "Kimi API Key", kind: "api-key", secretLabel: "API Key", protocol: "openai-compatible" }],
  configFields: [{ id: "region", label: "区域", kind: "select", required: true, defaultValue: "china", options: [
    { value: "china", label: "中国" },
    { value: "international", label: "国际" },
  ] }],
  resolveConnection({ authMethodId, settings }) {
    if (authMethodId !== "api-key") throw new Error(`Kimi 不支持认证方式：${authMethodId}`);
    const region = settings.region || "china";
    const baseUrl = BASES[region];
    if (!baseUrl) throw new Error(`未知 Kimi 区域：${region}`);
    return {
      providerId: "kimi",
      authMethodId,
      protocol: "openai-compatible",
      baseUrl,
      authHeader: { name: "Authorization", scheme: "Bearer" },
      modelDiscovery: { kind: "http-list", method: "GET", url: `${baseUrl}/models`, responseShape: "openai-model-list" },
      metadata: { region },
    };
  },
};
