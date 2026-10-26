/** 功能：提供有官方来源的 Agent/Coding Plan 模型能力目录。作用：套餐专属 API Key 不公开 /models 时仍可配置套餐已发布模型，并区分真实任务类型与套餐档位。 */
import type { AiModelCatalogEntry, AiPlanTier, AiModelTaskType } from "./model-capabilities.js";
import { ARK_PLAN_CATALOG_REVISION } from "lfaa-util-values/src/ark-provider.js";

export { ARK_PLAN_CATALOG_REVISION };
export const ARK_PLAN_AGENT_CATALOG_SOURCE = "https://docs.volcengine.com/docs/ark/agent-plan-personal-plan-overview?lang=zh";
export const ARK_PLAN_CODING_CATALOG_SOURCE = "https://docs.volcengine.com/docs/ark/coding-plan-personal-get-started?lang=zh";
export const ARK_PLAN_VISUAL_CATALOG_SOURCE = "https://docs.volcengine.com/docs/ark/agent-plan-personal-visual-models?lang=zh";
export const ARK_PLAN_VOICE_CATALOG_SOURCE = "https://docs.volcengine.com/docs/ark/agent-plan-personal-voice-model?lang=zh";
export const ARK_PLAN_EMBEDDING_CATALOG_SOURCE = "https://docs.volcengine.com/docs/ark/agent-plan-personal-vectorized-models?lang=zh";

export type ArkPlanProviderId = "ark-agent-plan" | "ark-coding-plan";
export type ArkPlanTierSelection = AiPlanTier | "unknown";

export const ARK_PLAN_TIER_OPTIONS: Record<ArkPlanProviderId, Array<{ value: ArkPlanTierSelection; label: string }>> = {
  "ark-agent-plan": [
    { value: "unknown", label: "未确认（按官方目录显示全部）" },
    { value: "small", label: "Small" }, { value: "medium", label: "Medium" },
    { value: "large", label: "Large" }, { value: "max", label: "Max" }
  ],
  "ark-coding-plan": [
    { value: "unknown", label: "未确认（按官方目录显示全部）" },
    { value: "lite", label: "Lite" }, { value: "pro", label: "Pro" }
  ]
};

type CatalogRow = {
  id: string;
  name?: string;
  taskType: AiModelTaskType;
  tiers: AiPlanTier[];
  contextWindow?: number;
  maxOutputTokens?: number;
  inputModalities?: Array<"text" | "image" | "audio" | "video">;
  note?: string;
};

const agentText: CatalogRow[] = [
  { id: "doubao-seed-2.0-mini", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 256_000, maxOutputTokens: 128_000 },
  { id: "doubao-seed-2.1-lite", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 256_000 },
  { id: "deepseek-v4-flash", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 384_000 },
  { id: "glm-5.3-flash", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 128_000, inputModalities: ["text", "image"] },
  { id: "doubao-seed-2.1-pro", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 256_000 },
  { id: "doubao-seed-evolving", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 256_000 },
  { id: "minimax-m3", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 128_000 },
  { id: "glm-5.3", name: "glm-5.3 (glm-latest)", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 128_000 },
  { id: "glm-latest", name: "glm-latest (glm-5.3)", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 128_000 },
  { id: "kimi-k2.7-code", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 256_000, maxOutputTokens: 32_000, note: "官方标记即将下线" },
  { id: "kimi-k2.8-preview", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 1_024_000 },
  { id: "deepseek-v4-pro", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 384_000 },
  { id: "kimi-k3", taskType: "chat", tiers: ["medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 128_000 },
  { id: "deepseek-v4.1-flash", taskType: "chat", tiers: ["small", "medium", "large", "max"], contextWindow: 1_024_000, maxOutputTokens: 384_000, inputModalities: ["text", "image"] }
];

const codingText: CatalogRow[] = [
  ...agentText.filter(model => ["doubao-seed-2.0-mini", "doubao-seed-2.1-lite", "deepseek-v4-flash", "glm-5.3-flash", "doubao-seed-2.1-pro", "doubao-seed-evolving", "minimax-m3", "glm-5.3", "kimi-k2.7-code", "kimi-k2.8-preview", "deepseek-v4-pro", "kimi-k3", "deepseek-v4.1-flash"].includes(model.id)).map(model => ({ ...model, tiers: ["lite", "pro"] as AiPlanTier[] })),
  { id: "glm-latest", name: "glm-latest (glm-5.3)", taskType: "chat", tiers: ["lite", "pro"], contextWindow: 1_024_000, maxOutputTokens: 128_000 },
  { id: "deepseek-v4.1-flash-economy", taskType: "chat", tiers: ["lite", "pro"], contextWindow: 1_049_000, maxOutputTokens: 384_000, inputModalities: ["text", "image"] },
];

const agentNonChat: CatalogRow[] = [
  { id: "doubao-embedding-vision", taskType: "embedding", tiers: ["small", "medium", "large", "max"], contextWindow: 128_000 },
  { id: "doubao-seedream-5-0-pro", taskType: "image-generation", tiers: ["small", "medium", "large", "max"] },
  { id: "doubao-seedream-5.0-flash", taskType: "image-generation", tiers: ["small", "medium", "large", "max"] },
  { id: "doubao-seedance-2.0", taskType: "video-generation", tiers: ["large", "max"] },
  { id: "doubao-seedance-2.0-fast", taskType: "video-generation", tiers: ["large", "max"] },
  { id: "doubao-seedance-2.0-mini", taskType: "video-generation", tiers: ["large", "max"] },
  { id: "doubao-seedance-2.5", taskType: "video-generation", tiers: ["large", "max"] },
  { id: "doubao-seed-tts-2.0", taskType: "text-to-speech", tiers: ["small", "medium", "large", "max"] },
  { id: "doubao-seed-asr-2.0", taskType: "speech-to-text", tiers: ["small", "medium", "large", "max"] }
];

const codingNonChat: CatalogRow[] = [
  { id: "doubao-embedding-vision", taskType: "embedding", tiers: ["lite", "pro"], contextWindow: 128_000 }
];

function toEntry(row: CatalogRow, providerId: ArkPlanProviderId): AiModelCatalogEntry {
  const source = row.taskType === "image-generation" || row.taskType === "video-generation"
    ? ARK_PLAN_VISUAL_CATALOG_SOURCE
    : row.taskType === "text-to-speech" || row.taskType === "speech-to-text"
      ? ARK_PLAN_VOICE_CATALOG_SOURCE
      : row.taskType === "embedding" ? ARK_PLAN_EMBEDDING_CATALOG_SOURCE
        : providerId === "ark-agent-plan" ? ARK_PLAN_AGENT_CATALOG_SOURCE : ARK_PLAN_CODING_CATALOG_SOURCE;
  return {
    id: row.id,
    name: row.name ?? row.id,
    taskType: row.taskType,
    planTiers: [...row.tiers],
    catalogSource: `${source}#${ARK_PLAN_CATALOG_REVISION}`,
    ...(row.contextWindow ? { contextWindow: row.contextWindow } : {}),
    ...(row.maxOutputTokens ? { maxOutputTokens: row.maxOutputTokens } : {}),
    ...(row.inputModalities ? { inputModalities: [...row.inputModalities] } : {}),
    ...(row.note ? { catalogNote: row.note } : {}),
    thinking: null,
    thinkingSource: null
  };
}

export function arkPlanTier(providerId: ArkPlanProviderId, options: Record<string, string>): ArkPlanTierSelection {
  const value = options.planTier ?? "unknown";
  return ARK_PLAN_TIER_OPTIONS[providerId].some(option => option.value === value) ? value as ArkPlanTierSelection : "unknown";
}

export function listArkPlanModels(providerId: ArkPlanProviderId, options: Record<string, string>): AiModelCatalogEntry[] {
  const rows = providerId === "ark-agent-plan" ? [...agentText, ...agentNonChat] : [...codingText, ...codingNonChat];
  const tier = arkPlanTier(providerId, options);
  return rows
    .filter(model => tier === "unknown" || model.tiers.includes(tier))
    .map(model => toEntry(model, providerId));
}

export function isArkPlanChatModel(model: AiModelCatalogEntry): boolean {
  return model.taskType === "chat" || model.taskType === undefined;
}
