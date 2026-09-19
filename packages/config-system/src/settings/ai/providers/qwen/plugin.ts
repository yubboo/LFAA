/**
 * 文件：plugin.ts
 * 作用：定义阿里云百炼 / 千问配置插件。
 * 负责：区域、Workspace ID、API Key 与官方模型列表地址解析。
 * 不负责：保存 API Key、自动创建 Workspace、UI、推理 Runtime。
 * 状态归属：静态插件描述。
 * 对外接口：qwenProviderPlugin。
 * 关联文件：../provider-contract.ts。
 * 修改注意事项：API Key、Endpoint、模型列表具有区域隔离；不得跨区域复用配置。
 */
import type { AiProviderPlugin } from "../provider-contract.ts";

interface RegionRule { label: string; modelHost: string; workspaceRequired: boolean; }
const REGIONS: Record<string, RegionRule> = {
  "cn-beijing": { label: "中国（北京）", modelHost: "{workspace}.cn-beijing.maas.aliyuncs.com", workspaceRequired: true },
  "ap-southeast-1": { label: "新加坡", modelHost: "dashscope-intl.aliyuncs.com", workspaceRequired: false },
  "cn-hongkong": { label: "中国（香港）", modelHost: "cn-hongkong.dashscope.aliyuncs.com", workspaceRequired: false },
  "eu-central-1": { label: "德国（法兰克福）", modelHost: "{workspace}.eu-central-1.maas.aliyuncs.com", workspaceRequired: true },
  "ap-northeast-1": { label: "日本（东京）", modelHost: "{workspace}.ap-northeast-1.maas.aliyuncs.com", workspaceRequired: true },
  "us-east-1": { label: "美国（弗吉尼亚）", modelHost: "{workspace}.us-east-1.maas.aliyuncs.com", workspaceRequired: true },
};

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
    if (rule.workspaceRequired && !workspace) {
      return {
        providerId: "qwen",
        authMethodId,
        protocol: "provider-native",
        authHeader: { name: "Authorization", scheme: "Bearer" },
        modelDiscovery: { kind: "manual", reason: `${rule.label} 的模型列表地址需要 Workspace ID。` },
        metadata: { region, workspaceRequired: "true" },
      };
    }
    const host = rule.modelHost.replace("{workspace}", workspace);
    return {
      providerId: "qwen",
      authMethodId,
      protocol: "provider-native",
      baseUrl: `https://${host}`,
      authHeader: { name: "Authorization", scheme: "Bearer" },
      modelDiscovery: { kind: "http-list", method: "GET", url: `https://${host}/api/v1/models`, responseShape: "openai-model-list" },
      metadata: { region, workspaceRequired: String(rule.workspaceRequired) },
    };
  },
};
