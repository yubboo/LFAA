/**
 * 文件：plugin.ts
 * 作用：定义智谱 BigModel / GLM 配置插件与官方文档模型目录。
 * 负责：标准/Coding API Base URL、API Key、官方文档目录和已核对 GLM-5.3 推理能力。
 * 不负责：伪造 /models、Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：zhipuProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：官方未提供统一账户模型列表 API 时，只能使用官方文档目录，不得编造运行时端点。
 */
import type { AiModelCapabilities, AiProviderCatalogModel, AiProviderPlugin } from "../provider-contract.ts";

const BASES: Record<string, string> = { standard: "https://open.bigmodel.cn/api/paas/v4", coding: "https://open.bigmodel.cn/api/coding/paas/v4" };
const CHECKED_AT = "2026-09-19";
const USAGE_SOURCE = { kind: "official-docs", label: "智谱 BigModel 官方文档", url: "https://docs.bigmodel.cn", checkedAt: "2026-09-21" } as const;
const OVERVIEW_URL = "https://docs.bigmodel.cn/cn/guide/start/model-overview";
const CATALOG_SOURCE = { kind: "official-docs", label: "智谱官方模型概览", url: OVERVIEW_URL, checkedAt: CHECKED_AT } as const;
const GLM53_SOURCE = { kind: "official-docs", label: "智谱 GLM-5.3", url: "https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3", checkedAt: CHECKED_AT } as const;
const CATALOG: readonly AiProviderCatalogModel[] = [
  { id: "glm-5.3", name: "GLM-5.3", ownedBy: "zhipu", contextWindow: 1_000_000, maxOutputTokens: 128_000 },
  { id: "glm-5.3-flash", name: "GLM-5.3-Flash", ownedBy: "zhipu" },
  { id: "glm-5.3-flashx", name: "GLM-5.3-FlashX", ownedBy: "zhipu" },
  { id: "glm-5.2", name: "GLM-5.2", ownedBy: "zhipu" },
];

function describeModel(modelId: string): AiModelCapabilities | null {
  if (modelId !== "glm-5.3") return null;
  return {
    source: GLM53_SOURCE,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputModalities: ["text"],
    supportsTools: true,
    supportsStructuredOutput: true,
    settings: [
      { id: "reasoningEffort", label: "思考强度", kind: "select", requestPath: "reasoning_effort", defaultValue: "max", options: ["low", "high", "max"].map((value) => ({ value, label: value })) },
      { id: "maxOutputTokens", label: "最大输出 Tokens", kind: "integer", requestPath: "max_tokens", min: 1, max: 128_000, step: 1 },
    ],
    notes: ["GLM-5.3 始终开启思考，thinking.type 只允许 enabled，因此 UI 不提供关闭开关。"],
  };
}

export const zhipuProviderPlugin: AiProviderPlugin = {
  id: "zhipu",
  displayName: "智谱 GLM",
  description: "智谱 BigModel 标准 API / Coding API。",
  protocols: ["openai-compatible"],
  authMethods: [{ id: "api-key", label: "智谱 API Key", kind: "api-key", secretLabel: "API Key", protocol: "openai-compatible" }],
  configFields: [{ id: "endpoint", label: "接口类型", kind: "select", required: true, defaultValue: "standard", options: [{ value: "standard", label: "标准 API" }, { value: "coding", label: "Coding API" }] }],
  resolveConnection({ authMethodId, settings }) {
    if (authMethodId !== "api-key") throw new Error(`智谱不支持认证方式：${authMethodId}`);
    const endpoint = settings.endpoint || "standard";
    const baseUrl = BASES[endpoint];
    if (!baseUrl) throw new Error(`未知智谱接口类型：${endpoint}`);
    return { providerId: "zhipu", authMethodId, protocol: "openai-compatible", baseUrl, authHeader: { name: "Authorization", scheme: "Bearer" }, modelDiscovery: { kind: "official-catalog", models: CATALOG, source: CATALOG_SOURCE, reason: "智谱当前官方文档公开模型目录；未发现统一账户 /models API，因此不伪造运行时端点。" }, usageDiscovery: { kind: "official-unavailable", source: USAGE_SOURCE, reason: "当前未找到可由普通 BigModel API Key 直接读取现金余额/资源包剩余量的稳定官方端点；LFAA 不从价格或调用记录反推余额。" }, metadata: { endpoint } };
  },
  describeModel,
};
