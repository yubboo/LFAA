// 千问 Token Plan 套餐模型目录：兼容模式 /models 只返回部分模型，视频模型（如 happyhorse）需要按官方套餐清单补齐。
import type { ModelCapabilityInfo, ModelKind } from "./types";

/** 一条套餐模型：ID 与它在套餐里提供的用途。 */
export interface TokenPlanModel {
  id: string;
  kind: ModelKind;
}

/** 官方订阅页「可使用模型」清单（个人版 Token Plan）。 */
export const TOKEN_PLAN_MODELS: readonly TokenPlanModel[] = [
  { id: "auto", kind: "chat" },
  { id: "qwen4-max", kind: "chat" },
  { id: "qwen4-max-preview", kind: "chat" },
  { id: "qwen3.8-max", kind: "chat" },
  { id: "qwen3.8-flash", kind: "chat" },
  { id: "qwen3.7-plus", kind: "chat" },
  { id: "qwen3.7-max", kind: "chat" },
  { id: "qwen3.6-flash", kind: "chat" },
  { id: "decision-model-preview", kind: "chat" },
  { id: "deepseek-v4.1-flash-1017", kind: "chat" },
  { id: "deepseek-v4.1-flash", kind: "chat" },
  { id: "deepseek-v4-pro-0813", kind: "chat" },
  { id: "deepseek-v4-pro", kind: "chat" },
  { id: "deepseek-v4-flash-0731", kind: "chat" },
  { id: "glm-5.3", kind: "chat" },
  { id: "glm-5.2", kind: "chat" },
  { id: "qwen-audio-3.0-asr-flash", kind: "audio" },
  { id: "qwen-audio-3.0-realtime-plus", kind: "audio" },
  { id: "qwen-audio-3.0-tts-plus", kind: "audio" },
  { id: "qwen-image-3.0-pro", kind: "image" },
  { id: "wan2.7-image", kind: "image" },
  { id: "wan2.7-image-pro", kind: "image" },
  { id: "wan3.0-video", kind: "video" },
  { id: "happyhorse-1.1-r2v", kind: "video" },
  { id: "happyhorse-1.1-t2v", kind: "video" },
  { id: "happyhorse-1.1-i2v", kind: "video" },
];

/** 只匹配百炼 Token Plan 的兼容模式地址，其他兼容接口继续以 /models 返回为准。 */
export function isTokenPlanBaseUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl.trim());
    return parsed.hostname === "token-plan.cn-beijing.maas.aliyuncs.com";
  } catch {
    return false;
  }
}

/** 把套餐目录转换成模型能力描述；API 已返回的同名模型以 API 结果为准。 */
export function tokenPlanCatalogModels(existing: readonly ModelCapabilityInfo[]): ModelCapabilityInfo[] {
  const known = new Set(existing.map((model) => model.id));
  return TOKEN_PLAN_MODELS
    .filter((model) => !known.has(model.id))
    .map((model) => ({
      id: model.id,
      modelKind: model.kind,
      supportsReasoning: false,
      reasoningMode: "none" as const,
      reasoningLevels: [],
    }));
}