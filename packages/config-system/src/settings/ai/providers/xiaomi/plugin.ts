/**
 * 文件：plugin.ts
 * 作用：定义 Xiaomi MiMo 按量 API 与 Token Plan 配置插件。
 * 负责：两种计费模式、Token Plan 区域、真实 Base URL、api-key Header 与模型发现。
 * 不负责：套餐购买、Secret 保存、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：xiaomiProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：sk- 按量 Key 与 tp- Token Plan Key 相互独立，不能混用。
 */
import type { AiProviderPlugin } from "../provider-contract.ts";

const TOKEN_PLAN_BASES: Record<string, string> = {
  cn: "https://token-plan-cn.xiaomimimo.com/v1",
  sgp: "https://token-plan-sgp.xiaomimimo.com/v1",
  ams: "https://token-plan-ams.xiaomimimo.com/v1",
};

export const xiaomiProviderPlugin: AiProviderPlugin = {
  id: "xiaomi",
  displayName: "Xiaomi MiMo",
  description: "小米 MiMo 按量 API 与 Token Plan。",
  protocols: ["openai-compatible"],
  authMethods: [
    { id: "api-key", label: "按量 API Key", kind: "api-key", secretLabel: "API Key", credentialPrefix: "sk-", protocol: "openai-compatible" },
    { id: "token-plan", label: "Token Plan", kind: "token-plan", secretLabel: "Token Plan Key", credentialPrefix: "tp-", protocol: "openai-compatible" },
  ],
  configFields: [{ id: "tokenPlanRegion", label: "Token Plan 区域", kind: "select", required: false, defaultValue: "cn", options: [
    { value: "cn", label: "中国" },
    { value: "sgp", label: "新加坡" },
    { value: "ams", label: "欧洲" },
  ], help: "仅 Token Plan 使用；按量 API 忽略此字段。" }],
  resolveConnection({ authMethodId, settings }) {
    if (authMethodId !== "api-key" && authMethodId !== "token-plan") throw new Error(`Xiaomi MiMo 不支持认证方式：${authMethodId}`);
    const baseUrl = authMethodId === "api-key"
      ? "https://api.xiaomimimo.com/v1"
      : TOKEN_PLAN_BASES[settings.tokenPlanRegion || "cn"];
    if (!baseUrl) throw new Error(`未知 MiMo Token Plan 区域：${settings.tokenPlanRegion}`);
    return {
      providerId: "xiaomi",
      authMethodId,
      protocol: "openai-compatible",
      baseUrl,
      authHeader: { name: "api-key" },
      modelDiscovery: { kind: "http-list", method: "GET", url: `${baseUrl}/models`, responseShape: "openai-model-list" },
      metadata: { billingMode: authMethodId },
    };
  },
};
