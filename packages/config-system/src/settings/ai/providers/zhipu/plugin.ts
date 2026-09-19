/**
 * 文件：plugin.ts
 * 作用：定义智谱 BigModel / GLM 配置插件。
 * 负责：标准 API 与 Coding API 的真实 Base URL、Bearer API Key 配置。
 * 不负责：虚构模型列表端点、Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：zhipuProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：官方未稳定公开统一模型列表端点时保持 manual，不得伪造 /models。
 */
import type { AiProviderPlugin } from "../provider-contract.ts";

const BASES: Record<string, string> = {
  standard: "https://open.bigmodel.cn/api/paas/v4",
  coding: "https://open.bigmodel.cn/api/coding/paas/v4",
};

export const zhipuProviderPlugin: AiProviderPlugin = {
  id: "zhipu",
  displayName: "智谱 GLM",
  description: "智谱 BigModel 标准 API / Coding API。",
  protocols: ["openai-compatible"],
  authMethods: [{ id: "api-key", label: "智谱 API Key", kind: "api-key", secretLabel: "API Key", protocol: "openai-compatible" }],
  configFields: [{ id: "endpoint", label: "接口类型", kind: "select", required: true, defaultValue: "standard", options: [
    { value: "standard", label: "标准 API" },
    { value: "coding", label: "Coding API" },
  ] }],
  resolveConnection({ authMethodId, settings }) {
    if (authMethodId !== "api-key") throw new Error(`智谱不支持认证方式：${authMethodId}`);
    const endpoint = settings.endpoint || "standard";
    const baseUrl = BASES[endpoint];
    if (!baseUrl) throw new Error(`未知智谱接口类型：${endpoint}`);
    return {
      providerId: "zhipu",
      authMethodId,
      protocol: "openai-compatible",
      baseUrl,
      authHeader: { name: "Authorization", scheme: "Bearer" },
      modelDiscovery: { kind: "manual", reason: "当前插件不伪造未确认的统一模型列表端点；模型目录由后续官方 Catalog Adapter 接入。" },
      metadata: { endpoint },
    };
  },
};
