// 定义模型管理中可直接用专属 API Key 接入的官方套餐，供浏览器选择与档案匹配。
// 方舟接入地址与 Host 共用公开契约，保证历史档案识别和实际请求使用相同规则。
import { ARK_PLAN_ANTHROPIC_BASE_URLS, ARK_PLAN_BASE_URLS, getArkPlanKind } from "@lfaa/llm/ark-plan";
import type { LlmApiProtocolOption, PublicLlmProfileItem } from "../store/chat-types";
import type { ModelProviderPreset } from "./provider-catalog";

interface ProviderPlan extends ModelProviderPreset {
  subscription: true;
  accessLabel: string;
  // 有独立地址的套餐可按地址找回旧档案，共用地址的套餐只认保存的档案类型。
  exclusiveBaseUrl?: true;
}

// 套餐预设默认使用 Chat Completions，各套餐按官方支持声明多协议与对应端点。
function plan(
  preset: Omit<ProviderPlan, "kind" | "defaultProtocol" | "supportedProtocols" | "sampleModels" | "subscription"> & {
    defaultProtocol?: LlmApiProtocolOption;
    supportedProtocols?: LlmApiProtocolOption[];
  },
): ProviderPlan {
  const defaultProtocol = preset.defaultProtocol ?? "openai-chat";
  const supportedProtocols = preset.supportedProtocols ?? [defaultProtocol];
  return {
    ...preset,
    kind: "openai-compatible",
    defaultProtocol,
    supportedProtocols,
    sampleModels: [],
    subscription: true,
  };
}

const arkPlans = {
  agent: plan({
    id: "volcengine-agent-plan",
    nameZh: "火山方舟 Agent Plan",
    nameEn: "Volcengine Ark Agent Plan",
    accessLabel: "Agent Plan",
    descZh: "使用 Agent Plan 专属 API Key",
    descEn: "Use your dedicated Agent Plan API key",
    supportedProtocols: ["openai-chat", "anthropic-messages"],
    defaultBaseUrl: ARK_PLAN_BASE_URLS.agent,
    protocolBaseUrls: {
      "openai-chat": ARK_PLAN_BASE_URLS.agent,
      "anthropic-messages": ARK_PLAN_ANTHROPIC_BASE_URLS.agent,
    },
    defaultModel: "ark-code-latest",
    accentColor: "#38bdf8",
    glyph: "VE",
  }),
  coding: plan({
    id: "volcengine-coding-plan",
    nameZh: "火山方舟 Coding Plan",
    nameEn: "Volcengine Ark Coding Plan",
    accessLabel: "Coding Plan",
    descZh: "使用 Coding Plan 控制台提供的 API Key",
    descEn: "Use the API key from the Coding Plan console",
    supportedProtocols: ["openai-chat", "anthropic-messages"],
    defaultBaseUrl: ARK_PLAN_BASE_URLS.coding,
    protocolBaseUrls: {
      "openai-chat": ARK_PLAN_BASE_URLS.coding,
      "anthropic-messages": ARK_PLAN_ANTHROPIC_BASE_URLS.coding,
    },
    defaultModel: "ark-code-latest",
    accentColor: "#38bdf8",
    glyph: "VE",
  }),
};

// 默认模型与地址均来源于厂商套餐接入文档。
const plansByProvider: Readonly<Record<string, readonly ProviderPlan[]>> = {
  volcengine: [arkPlans.agent, arkPlans.coding],
  minimax: [
    plan({
      id: "minimax-m-plan",
      nameZh: "MiniMax M Plan",
      nameEn: "MiniMax M Plan",
      accessLabel: "M Plan / Token Plan",
      descZh: "使用 M Plan 或仍在续订的 Token Plan 订阅 Key",
      descEn: "Use a current M Plan or legacy Token Plan subscription key",
      supportedProtocols: ["openai-chat", "anthropic-messages"],
      defaultBaseUrl: "https://api.minimax.cn/v1",
      protocolBaseUrls: {
        "openai-chat": "https://api.minimax.cn/v1",
        "anthropic-messages": "https://api.minimax.cn/anthropic",
      },
      defaultModel: "MiniMax-M3.1-Flash",
      accentColor: "#f43f5e",
      glyph: "MM",
    }),
  ],
  qwen: [
    plan({
      id: "qwen-token-plan",
      nameZh: "通义千问 Token Plan",
      nameEn: "Qwen Token Plan",
      accessLabel: "Token Plan",
      descZh: "使用百炼 Token Plan 专属 API Key",
      descEn: "Use an Alibaba Model Studio Token Plan API key",
      supportedProtocols: ["openai-chat", "anthropic-messages"],
      defaultBaseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      protocolBaseUrls: {
        "openai-chat": "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        "anthropic-messages": "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic",
      },
      defaultModel: "qwen3.8-max",
      accentColor: "#6366f1",
      glyph: "QW",
      exclusiveBaseUrl: true,
    }),
    plan({
      id: "qwen-coding-plan",
      nameZh: "通义千问 Coding Plan",
      nameEn: "Qwen Coding Plan",
      accessLabel: "Coding Plan",
      descZh: "使用百炼 Coding Plan 专属 API Key，用于交互式编程",
      descEn: "Use an Alibaba Model Studio Coding Plan API key for interactive coding",
      supportedProtocols: ["openai-chat", "anthropic-messages"],
      defaultBaseUrl: "https://coding.dashscope.aliyuncs.com/v1",
      protocolBaseUrls: {
        "openai-chat": "https://coding.dashscope.aliyuncs.com/v1",
        "anthropic-messages": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
      },
      defaultModel: "qwen3.7-plus",
      accentColor: "#6366f1",
      glyph: "QW",
      exclusiveBaseUrl: true,
    }),
  ],
  zhipu: [
    plan({
      id: "zhipu-coding-plan",
      nameZh: "智谱 GLM Coding Plan",
      nameEn: "Zhipu GLM Coding Plan",
      accessLabel: "GLM Coding Plan",
      descZh: "使用智谱个人或团队编程套餐专属 API Key",
      descEn: "Use an individual or team GLM Coding Plan API key",
      supportedProtocols: ["openai-chat", "anthropic-messages"],
      defaultBaseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
      protocolBaseUrls: {
        "openai-chat": "https://open.bigmodel.cn/api/coding/paas/v4",
        "anthropic-messages": "https://open.bigmodel.cn/api/anthropic",
      },
      defaultModel: "glm-5.3",
      accentColor: "#3b82f6",
      glyph: "ZP",
      exclusiveBaseUrl: true,
    }),
  ],
};

const allPlans = Object.values(plansByProvider).flat();

/** 获取品牌的独立套餐，空列表表示卡片可直接打开普通 API 表单。 */
export function getProviderPlans(providerId: string): readonly ProviderPlan[] {
  return plansByProvider[providerId] ?? [];
}

// 专属地址可识别旧的自定义档案。共用地址按 providerId 识别，避免复用普通 API 的凭据。
export function findProviderPlan(profile: Pick<PublicLlmProfileItem, "baseUrl" | "providerId">): ProviderPlan | undefined {
  const ark = getArkPlanKind(profile.baseUrl);
  if (ark) return arkPlans[ark];
  const baseUrl = profile.baseUrl
    .trim()
    .replace(/\/+$/u, "")
    .replace(/\/(chat\/completions|v1\/messages|messages)$/u, "");
  return allPlans.find((item) => {
    if (!item.exclusiveBaseUrl) return false;
    const urls = [item.defaultBaseUrl, ...Object.values(item.protocolBaseUrls ?? {})];
    return urls.includes(baseUrl);
  }) ?? allPlans.find((item) => item.id === profile.providerId);
}
