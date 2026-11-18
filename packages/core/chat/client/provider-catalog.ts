// 定义「模型管理」提供商卡片目录与官方 API 协议格式映射（OpenAI Chat / Responses / Anthropic Messages / Gemini generateContent）。
import type { LlmApiProtocolOption, PublicLlmProfileItem } from "./chat-types";

export const LLM_API_PROTOCOL_OPTIONS: ReadonlyArray<{
  id: LlmApiProtocolOption;
  label: string;
  shortLabel: string;
}> = [
  { id: "openai-chat", label: "OpenAI Chat Completions", shortLabel: "Chat Completions" },
  { id: "openai-responses", label: "OpenAI Responses API", shortLabel: "Responses API" },
  { id: "anthropic-messages", label: "Anthropic Messages", shortLabel: "Anthropic" },
  { id: "gemini-generate-content", label: "Gemini Native generateContent", shortLabel: "Gemini Native" },
];

export function getProtocolShortLabel(protocol?: LlmApiProtocolOption): string {
  return LLM_API_PROTOCOL_OPTIONS.find((item) => item.id === protocol)?.shortLabel ?? "Chat Completions";
}

export interface ModelProviderPreset {
  id: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  kind: PublicLlmProfileItem["kind"];
  defaultProtocol: LlmApiProtocolOption;
  supportedProtocols: LlmApiProtocolOption[];
  defaultBaseUrl: string;
  protocolBaseUrls?: Partial<Record<LlmApiProtocolOption, string>>;
  defaultModel: string;
  sampleModels: string[];
  accentColor: string;
  glyph: string;
  isAddStyle?: boolean;
}

export const MODEL_PROVIDER_CATALOG: ModelProviderPreset[] = [
  {
    id: "openai",
    nameZh: "OpenAI",
    nameEn: "OpenAI",
    descZh: "OpenAI 官方接口",
    descEn: "OpenAI official API",
    kind: "openai-compatible",
    defaultProtocol: "openai-responses",
    supportedProtocols: ["openai-responses", "openai-chat"],
    defaultBaseUrl: "https://api.openai.com/v1",
    protocolBaseUrls: {
      "openai-chat": "https://api.openai.com/v1",
      "openai-responses": "https://api.openai.com/v1",
    },
    defaultModel: "gpt-4o",
    sampleModels: ["gpt-4o", "gpt-4.1", "o3-mini"],
    accentColor: "#10a37f",
    glyph: "OA",
  },
  {
    id: "deepseek",
    nameZh: "DeepSeek",
    nameEn: "DeepSeek",
    descZh: "DeepSeek 官方多协议接口",
    descEn: "DeepSeek official API",
    kind: "deepseek",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat", "openai-responses", "anthropic-messages"],
    defaultBaseUrl: "https://api.deepseek.com/v1",
    protocolBaseUrls: {
      "openai-chat": "https://api.deepseek.com/v1",
      "openai-responses": "https://api.deepseek.com/v1",
      "anthropic-messages": "https://api.deepseek.com/anthropic",
    },
    defaultModel: "deepseek-flash",
    sampleModels: ["deepseek-flash", "deepseek-v4-pro"],
    accentColor: "#4f7cff",
    glyph: "DS",
  },
  {
    id: "minimax",
    nameZh: "MiniMax",
    nameEn: "MiniMax",
    descZh: "MiniMax 官方接口",
    descEn: "MiniMax official API",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "https://api.minimax.chat/v1",
    defaultModel: "MiniMax-Text-01",
    sampleModels: ["MiniMax-Text-01", "abab6.5s-chat"],
    accentColor: "#f43f5e",
    glyph: "MM",
  },
  {
    id: "qwen",
    nameZh: "通义千问",
    nameEn: "Qwen",
    descZh: "阿里云百炼兼容接口",
    descEn: "Alibaba Bailian compatible",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-max",
    sampleModels: ["qwen-max", "qwen-plus", "qwq-plus"],
    accentColor: "#6366f1",
    glyph: "QW",
  },
  {
    id: "volcengine",
    nameZh: "火山方舟",
    nameEn: "Volcengine Ark",
    descZh: "豆包 / 方舟兼容接口",
    descEn: "Doubao / Ark compatible",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-pro-32k",
    sampleModels: ["doubao-pro-32k", "doubao-1-5-pro-32k"],
    accentColor: "#38bdf8",
    glyph: "VE",
  },
  {
    id: "zhipu",
    nameZh: "智谱",
    nameEn: "Zhipu GLM",
    descZh: "智谱开放平台",
    descEn: "Zhipu Open Platform",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    sampleModels: ["glm-4-plus", "glm-z1-air"],
    accentColor: "#3b82f6",
    glyph: "ZP",
  },
  {
    id: "siliconflow",
    nameZh: "硅基流动",
    nameEn: "SiliconFlow",
    descZh: "多模型聚合接口",
    descEn: "Multi-model router",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-72B-Instruct",
    sampleModels: ["Qwen/Qwen2.5-72B-Instruct", "deepseek-ai/DeepSeek-R1"],
    accentColor: "#7c3aed",
    glyph: "SF",
  },
  {
    id: "openrouter",
    nameZh: "OpenRouter",
    nameEn: "OpenRouter",
    descZh: "路由聚合接口",
    descEn: "Unified model router",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o",
    sampleModels: ["openai/gpt-4o", "anthropic/claude-sonnet-4"],
    accentColor: "#a855f7",
    glyph: "OR",
  },
  {
    id: "gemini",
    nameZh: "Gemini",
    nameEn: "Gemini",
    descZh: "Google 原生与兼容接口",
    descEn: "Google native & OpenAI compatible API",
    kind: "openai-compatible",
    defaultProtocol: "gemini-generate-content",
    supportedProtocols: ["gemini-generate-content", "openai-chat"],
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    protocolBaseUrls: {
      "gemini-generate-content": "https://generativelanguage.googleapis.com/v1beta",
      "openai-chat": "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    defaultModel: "gemini-2.5-pro",
    sampleModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
    accentColor: "#22c55e",
    glyph: "GM",
  },
  {
    id: "claude",
    nameZh: "Claude",
    nameEn: "Claude",
    descZh: "Anthropic 原生接口",
    descEn: "Anthropic Messages API",
    kind: "openai-compatible",
    defaultProtocol: "anthropic-messages",
    supportedProtocols: ["anthropic-messages", "openai-chat"],
    defaultBaseUrl: "https://api.anthropic.com",
    protocolBaseUrls: {
      "anthropic-messages": "https://api.anthropic.com",
      "openai-chat": "https://api.anthropic.com/v1",
    },
    defaultModel: "claude-sonnet-4-20250514",
    sampleModels: ["claude-sonnet-4-20250514", "claude-3-7-sonnet-latest"],
    accentColor: "#f97316",
    glyph: "CL",
  },
  {
    id: "grok",
    nameZh: "xAI Grok",
    nameEn: "xAI Grok",
    descZh: "xAI Grok 接口",
    descEn: "xAI Grok API",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-3",
    sampleModels: ["grok-3", "grok-3-mini"],
    accentColor: "#94a3b8",
    glyph: "XK",
  },
  {
    id: "local",
    nameZh: "本地部署",
    nameEn: "Local Runtime",
    descZh: "Ollama / LM Studio 等本机服务，无需 API Key",
    descEn: "Ollama / LM Studio local server, no API key needed",
    kind: "ollama",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat"],
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "qwen2.5-coder:7b",
    sampleModels: ["qwen2.5-coder:7b", "deepseek-r1:14b", "llama3.2:latest"],
    accentColor: "#eab308",
    glyph: "+",
    isAddStyle: true,
  },
  {
    id: "custom",
    nameZh: "自定义",
    nameEn: "Custom Endpoint",
    descZh: "自定义多协议接口",
    descEn: "Custom API endpoint",
    kind: "openai-compatible",
    defaultProtocol: "openai-chat",
    supportedProtocols: ["openai-chat", "openai-responses", "anthropic-messages", "gemini-generate-content"],
    defaultBaseUrl: "https://api.example.com/v1",
    defaultModel: "custom-model",
    sampleModels: [],
    accentColor: "#e879f9",
    glyph: "+",
    isAddStyle: true,
  },
];

// 根据预设与已有 Base URL 推断默认协议格式，兼容旧配置迁移。
export function inferProtocolForPreset(
  provider: ModelProviderPreset,
  profile?: PublicLlmProfileItem,
): LlmApiProtocolOption {
  if (profile?.apiProtocol) return profile.apiProtocol;
  const lowerUrl = (profile?.baseUrl ?? provider.defaultBaseUrl).trim().toLowerCase();
  if (lowerUrl.includes("/anthropic") || lowerUrl.includes("api.anthropic.com")) {
    return "anthropic-messages";
  }
  if (lowerUrl.includes("generativelanguage.googleapis.com") && !lowerUrl.includes("/openai")) {
    return "gemini-generate-content";
  }
  if (lowerUrl.endsWith("/responses")) {
    return "openai-responses";
  }
  return provider.defaultProtocol;
}

// 切换协议格式时仅在当前 Base URL 属于该品牌默认端点时自动联动切换，不覆盖用户自定义代理地址。
export function resolveNextBaseUrlForProtocol(
  provider: ModelProviderPreset,
  currentBaseUrl: string,
  nextProtocol: LlmApiProtocolOption,
): string {
  const mappedUrl = provider.protocolBaseUrls?.[nextProtocol];
  if (!mappedUrl) return currentBaseUrl;
  const trimmed = currentBaseUrl.trim().replace(/\/+$/u, "");
  if (!trimmed) return mappedUrl;
  const knownUrls = new Set(
    [provider.defaultBaseUrl, ...Object.values(provider.protocolBaseUrls ?? {})].map((u) =>
      u.trim().replace(/\/+$/u, ""),
    ),
  );
  return knownUrls.has(trimmed) ? mappedUrl : currentBaseUrl;
}

// 将已保存的 LLM 配置匹配回所属卡片，兼容未显式写 providerId 的历史默认配置。
export function findProfileForProvider(
  profiles: PublicLlmProfileItem[],
  provider: ModelProviderPreset,
): PublicLlmProfileItem | undefined {
  const byProviderId = profiles.find((p) => p.providerId === provider.id);
  if (byProviderId) return byProviderId;
  if (provider.id === "deepseek") {
    return profiles.find((p) => p.kind === "deepseek" || p.baseUrl.includes("deepseek.com"));
  }
  if (provider.id === "local") {
    return profiles.find((p) => p.kind === "ollama" || p.id === "ollama-local");
  }
  if (provider.id === "openai") {
    return profiles.find((p) => p.id === "openai-gpt4o" || p.baseUrl.includes("api.openai.com"));
  }
  if (provider.id === "custom") {
    const knownHosts = MODEL_PROVIDER_CATALOG.filter((c) => c.id !== "custom").flatMap((c) => [
      c.defaultBaseUrl,
      ...Object.values(c.protocolBaseUrls ?? {}),
    ]);
    return profiles.find(
      (p) => !p.providerId && p.kind === "openai-compatible" && !knownHosts.includes(p.baseUrl) && !p.baseUrl.includes("api.openai.com"),
    );
  }
  const presetUrls = [provider.defaultBaseUrl, ...Object.values(provider.protocolBaseUrls ?? {})];
  return profiles.find((p) => presetUrls.includes(p.baseUrl));
}
