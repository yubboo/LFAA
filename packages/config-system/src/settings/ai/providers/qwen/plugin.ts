/**
 * 文件：plugin.ts
 * 作用：定义阿里云百炼 / 千问配置插件与官方模型思考参数。
 * 负责：区域、Workspace ID、API Key、官方模型列表 API 与 Qwen3.8 官方推理配置。
 * 不负责：保存 API Key、自动创建 Workspace、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：qwenProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：模型列表和能力具有区域/模型差异；未核对模型不得继承 Qwen3.8 参数。
 */
import type { AiModelCapabilities, AiProviderPlugin } from "../provider-contract.ts";

interface RegionRule { label: string; modelHost: string; workspaceRequired: boolean; }
const REGIONS: Record<string, RegionRule> = {
  "cn-beijing": { label: "中国（北京）", modelHost: "{workspace}.cn-beijing.maas.aliyuncs.com", workspaceRequired: true },
  "ap-southeast-1": { label: "新加坡", modelHost: "dashscope-intl.aliyuncs.com", workspaceRequired: false },
  "cn-hongkong": { label: "中国（香港）", modelHost: "cn-hongkong.dashscope.aliyuncs.com", workspaceRequired: false },
  "eu-central-1": { label: "德国（法兰克福）", modelHost: "{workspace}.eu-central-1.maas.aliyuncs.com", workspaceRequired: true },
  "ap-northeast-1": { label: "日本（东京）", modelHost: "{workspace}.ap-northeast-1.maas.aliyuncs.com", workspaceRequired: true },
  "us-east-1": { label: "美国（弗吉尼亚）", modelHost: "{workspace}.us-east-1.maas.aliyuncs.com", workspaceRequired: true },
};
const CHECKED_AT = "2026-09-19";
const THINKING_SOURCE = { kind: "official-docs", label: "阿里云百炼 Qwen 深度思考", url: "https://help.aliyun.com/zh/model-studio/deep-thinking", checkedAt: CHECKED_AT } as const;

function describeModel(modelId: string): AiModelCapabilities | null {
  const isQwen38 = /^qwen3\.8-(max(?:-\d+)?|flash|27b|2\.4t-a95b|omni-flash)$/.test(modelId);
  if (!isQwen38) return null;
  const thinkingOnly = modelId === "qwen3.8-2.4t-a95b";
  const options = (thinkingOnly ? ["low", "medium", "xhigh"] : ["none", "low", "medium", "xhigh"]).map((value) => ({ value, label: value === "none" ? "关闭思考" : value }));
  return {
    source: THINKING_SOURCE,
    settings: [{ id: "reasoningEffort", label: "思考强度", kind: "select", requestPath: "reasoning_effort", defaultValue: "xhigh", options, help: thinkingOnly ? "该模型仅支持思考模式。" : "官方映射：none 关闭思考；low / medium / xhigh 控制投入。" }],
    notes: ["reasoning_effort 与 thinking_budget 不能同时设置；LFAA 当前只保存 reasoning_effort。"],
  };
}

export const qwenProviderPlugin: AiProviderPlugin = {
  id: "qwen",
  displayName: "千问 / 百炼",
  description: "阿里云 Model Studio（百炼）区域化 API。",
  protocols: ["provider-native", "openai-compatible"],
  authMethods: [
    { id: "api-key", label: "百炼 API Key", kind: "api-key", secretLabel: "API Key", protocol: "provider-native" },
    { id: "token-plan", label: "Token/Coding Plan Key", kind: "token-plan", secretLabel: "Plan API Key", credentialPrefix: "sk-sp-", protocol: "provider-native" },
  ],
  configFields: [
    { id: "region", label: "区域", kind: "select", required: true, defaultValue: "cn-beijing", options: Object.entries(REGIONS).map(([value, rule]) => ({ value, label: rule.label })) },
    { id: "workspaceId", label: "Workspace ID", kind: "text", required: false, placeholder: "部分区域需要 Workspace ID" },
  ],
  resolveConnection({ authMethodId, settings }) {
    if (authMethodId !== "api-key" && authMethodId !== "token-plan") throw new Error(`千问不支持认证方式：${authMethodId}`);
    const region = settings.region || "cn-beijing";
    const rule = REGIONS[region];
    if (!rule) throw new Error(`未知百炼区域：${region}`);
    const workspace = (settings.workspaceId || "").trim();
    if (rule.workspaceRequired && !workspace) throw new Error(`${rule.label} 需要 Workspace ID，填写后才能验证连接并获取实际可用模型。`);
    const host = rule.modelHost.replace("{workspace}", workspace);
    const url = `https://${host}/api/v1/models`;
    return { providerId: "qwen", authMethodId, protocol: "provider-native", baseUrl: `https://${host}`, authHeader: { name: "Authorization", scheme: "Bearer" }, modelDiscovery: { kind: "http-list", method: "GET", url, responseShape: "qwen-model-list", source: { kind: "runtime-model-api", label: "百炼 GET /api/v1/models", url, checkedAt: CHECKED_AT } }, metadata: { region, workspaceRequired: String(rule.workspaceRequired) } };
  },
  describeModel,
};
