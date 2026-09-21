/**
 * 文件：plugin.ts
 * 作用：定义 Xiaomi MiMo 按量 API / Token Plan 与官方模型能力。
 * 负责：计费模式、Token Plan 区域、真实 Base URL、api-key Header、/models 动态发现与 MiMo v2.5 推理参数。
 * 不负责：套餐购买、Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：xiaomiProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：sk- 与 tp- Key 相互独立；模型参数只按 MiMo 官方 Responses 文档声明。
 */
import type { AiModelCapabilities, AiProviderPlugin } from "../provider-contract.ts";

const TOKEN_PLAN_BASES: Record<string, string> = { cn: "https://token-plan-cn.xiaomimimo.com/v1", sgp: "https://token-plan-sgp.xiaomimimo.com/v1", ams: "https://token-plan-ams.xiaomimimo.com/v1" };
const CHECKED_AT = "2026-09-19";
const USAGE_SOURCE = { kind: "official-docs", label: "Xiaomi MiMo 官方平台", url: "https://platform.xiaomimimo.com/docs", checkedAt: "2026-09-21" } as const;
const RESPONSES_SOURCE = { kind: "official-docs", label: "Xiaomi MiMo Responses API", url: "https://mimo.mi.com/docs/zh-CN/api/chat/responses", checkedAt: CHECKED_AT } as const;

function describeModel(modelId: string): AiModelCapabilities | null {
  if (modelId !== "mimo-v2.5" && modelId !== "mimo-v2.5-pro") return null;
  return {
    source: RESPONSES_SOURCE,
    contextWindow: 1_000_000,
    maxOutputTokens: 131_072,
    inputModalities: ["text", "image"],
    settings: [
      { id: "reasoningEffort", label: "思考模式", kind: "select", requestPath: "reasoning.effort", options: [{ value: "none", label: "关闭思考" }, { value: "low", label: "开启 · low" }, { value: "medium", label: "开启 · medium" }, { value: "high", label: "开启 · high" }], help: "官方当前说明：low / medium / high 均开启推理，实际强度暂不区分。" },
      { id: "maxOutputTokens", label: "最大输出 Tokens", kind: "integer", requestPath: "max_output_tokens", min: 1, max: 131_072, step: 1 },
    ],
    notes: ["思考模式下 temperature 与 top_p 会由模型使用官方推荐值，LFAA 不暴露无效配置。"],
  };
}

export const xiaomiProviderPlugin: AiProviderPlugin = {
  id: "xiaomi",
  displayName: "Xiaomi MiMo",
  description: "小米 MiMo 按量 API 与 Token Plan。",
  protocols: ["openai-compatible"],
  authMethods: [
    { id: "api-key", label: "按量 API Key", kind: "api-key", secretLabel: "API Key", credentialPrefix: "sk-", protocol: "openai-compatible" },
    { id: "token-plan", label: "Token Plan", kind: "token-plan", secretLabel: "Token Plan Key", credentialPrefix: "tp-", protocol: "openai-compatible" },
  ],
  configFields: [{ id: "tokenPlanRegion", label: "Token Plan 区域", kind: "select", required: false, defaultValue: "cn", options: [{ value: "cn", label: "中国" }, { value: "sgp", label: "新加坡" }, { value: "ams", label: "欧洲" }], help: "仅 Token Plan 使用；按量 API 忽略此字段。" }],
  resolveConnection({ authMethodId, settings }) {
    if (authMethodId !== "api-key" && authMethodId !== "token-plan") throw new Error(`Xiaomi MiMo 不支持认证方式：${authMethodId}`);
    const baseUrl = authMethodId === "api-key" ? "https://api.xiaomimimo.com/v1" : TOKEN_PLAN_BASES[settings.tokenPlanRegion || "cn"];
    if (!baseUrl) throw new Error(`未知 MiMo Token Plan 区域：${settings.tokenPlanRegion}`);
    const url = `${baseUrl}/models`;
    return { providerId: "xiaomi", authMethodId, protocol: "openai-compatible", baseUrl, authHeader: { name: "api-key" }, modelDiscovery: { kind: "http-list", method: "GET", url, responseShape: "openai-model-list", source: { kind: "runtime-model-api", label: "Xiaomi MiMo GET /v1/models", url, checkedAt: CHECKED_AT } }, usageDiscovery: { kind: "official-unavailable", source: USAGE_SOURCE, reason: "MiMo 官方公开 Token Plan/Credits 权益，但当前未确认普通 API/Token Plan Key 可调用的稳定用量查询端点；LFAA 不伪造 Credits 百分比。" }, metadata: { billingMode: authMethodId } };
  },
  describeModel,
};
