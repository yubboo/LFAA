// 千问 Token Plan 套餐模型目录：兼容模式 /models 只返回部分模型，视频模型（如 happyhorse）需要按官方套餐清单补齐。
// 每条同时给出品牌与能力说明，让用户一眼看出是「千问/万相/HappyHorse…」的哪种能力。
import type { ModelCapabilityInfo, ModelKind } from "./types";
import { resolveModelCapabilities } from "./capabilities";

/** 本地化文案对：中文与英文。 */
export interface LocalizedText {
  zh: string;
  en: string;
}

/** 一条套餐模型：ID、用途、品牌与能力说明。 */
export interface TokenPlanModel {
  id: string;
  kind: ModelKind;
  brand: LocalizedText;
  capability: LocalizedText;
}

const QWEN: LocalizedText = { zh: "千问", en: "Qwen" };
const WANXIANG: LocalizedText = { zh: "万相", en: "Wanxiang" };
const HAPPYHORSE: LocalizedText = { zh: "HappyHorse", en: "HappyHorse" };
const DOMAIN: LocalizedText = { zh: "领域模型", en: "Domain model" };
const DEEPSEEK: LocalizedText = { zh: "DeepSeek", en: "DeepSeek" };
const ZHIPU: LocalizedText = { zh: "智谱AI", en: "Zhipu AI" };

const TEXT_REASONING: LocalizedText = { zh: "文本生成、推理模型", en: "Text & reasoning" };
const TEXT_REASONING_VISION: LocalizedText = { zh: "文本生成、推理模型、视觉理解", en: "Text, reasoning & vision" };
const TEXT: LocalizedText = { zh: "文本生成", en: "Text generation" };
const IMAGE: LocalizedText = { zh: "图片生成", en: "Image generation" };
const VIDEO: LocalizedText = { zh: "视频生成", en: "Video generation" };
const TTS: LocalizedText = { zh: "语音合成", en: "Speech synthesis" };
const ASR: LocalizedText = { zh: "语音识别", en: "Speech recognition" };
const REALTIME: LocalizedText = { zh: "实时语音对话", en: "Realtime speech" };

/** 官方订阅页「可使用模型」清单（个人版 Token Plan）。 */
export const TOKEN_PLAN_MODELS: readonly TokenPlanModel[] = [
  { id: "auto", kind: "chat", brand: QWEN, capability: TEXT_REASONING },
  { id: "qwen4-max", kind: "chat", brand: QWEN, capability: TEXT_REASONING_VISION },
  { id: "qwen4-max-preview", kind: "chat", brand: QWEN, capability: TEXT_REASONING_VISION },
  { id: "qwen3.8-max", kind: "chat", brand: QWEN, capability: TEXT_REASONING_VISION },
  { id: "qwen3.8-flash", kind: "chat", brand: QWEN, capability: TEXT_REASONING_VISION },
  { id: "qwen3.7-plus", kind: "chat", brand: QWEN, capability: TEXT_REASONING_VISION },
  { id: "qwen3.7-max", kind: "chat", brand: QWEN, capability: TEXT_REASONING },
  { id: "qwen3.6-flash", kind: "chat", brand: QWEN, capability: TEXT_REASONING_VISION },
  { id: "decision-model-preview", kind: "chat", brand: DOMAIN, capability: TEXT },
  { id: "deepseek-v4.1-flash-1017", kind: "chat", brand: DEEPSEEK, capability: TEXT_REASONING_VISION },
  { id: "deepseek-v4.1-flash", kind: "chat", brand: DEEPSEEK, capability: TEXT_REASONING_VISION },
  { id: "deepseek-v4-pro-0813", kind: "chat", brand: DEEPSEEK, capability: TEXT_REASONING },
  { id: "deepseek-v4-pro", kind: "chat", brand: DEEPSEEK, capability: TEXT_REASONING },
  { id: "deepseek-v4-flash-0731", kind: "chat", brand: DEEPSEEK, capability: TEXT_REASONING },
  { id: "glm-5.3", kind: "chat", brand: ZHIPU, capability: TEXT_REASONING },
  { id: "glm-5.2", kind: "chat", brand: ZHIPU, capability: TEXT_REASONING },
  { id: "qwen-audio-3.0-asr-flash", kind: "audio", brand: QWEN, capability: ASR },
  { id: "qwen-audio-3.0-realtime-plus", kind: "audio", brand: QWEN, capability: REALTIME },
  { id: "qwen-audio-3.0-tts-plus", kind: "audio", brand: QWEN, capability: TTS },
  { id: "qwen-image-3.0-pro", kind: "image", brand: QWEN, capability: IMAGE },
  { id: "wan2.7-image", kind: "image", brand: WANXIANG, capability: IMAGE },
  { id: "wan2.7-image-pro", kind: "image", brand: WANXIANG, capability: IMAGE },
  { id: "wan3.0-video", kind: "video", brand: WANXIANG, capability: VIDEO },
  { id: "happyhorse-1.1-r2v", kind: "video", brand: HAPPYHORSE, capability: VIDEO },
  { id: "happyhorse-1.1-t2v", kind: "video", brand: HAPPYHORSE, capability: VIDEO },
  { id: "happyhorse-1.1-i2v", kind: "video", brand: HAPPYHORSE, capability: VIDEO },
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

/** 某模型在套餐目录里的品牌名；不在目录里返回 undefined。 */
export function describeTokenPlanBrand(id: string, isZh: boolean): string | undefined {
  const model = TOKEN_PLAN_MODELS.find((entry) => entry.id === id);
  return model ? (isZh ? model.brand.zh : model.brand.en) : undefined;
}

/** 某模型在套餐目录里的能力说明；不在目录里返回 undefined。 */
export function describeTokenPlanCapability(id: string, isZh: boolean): string | undefined {
  const model = TOKEN_PLAN_MODELS.find((entry) => entry.id === id);
  return model ? (isZh ? model.capability.zh : model.capability.en) : undefined;
}

/** 某模型在套餐目录里的「品牌 · 能力」说明；不在目录里返回 undefined。 */
export function describeTokenPlanModel(id: string, isZh: boolean): string | undefined {
  const model = TOKEN_PLAN_MODELS.find((entry) => entry.id === id);
  if (!model) return undefined;
  return `${isZh ? model.brand.zh : model.brand.en} · ${isZh ? model.capability.zh : model.capability.en}`;
}

/** 把套餐目录合并进接口结果：已返回的补上 displayName，缺失的按目录补齐。 */
export function tokenPlanCatalogModels(existing: readonly ModelCapabilityInfo[]): ModelCapabilityInfo[] {
  // 先按 ID 去重：历史同步结果可能把同一模型写了两遍。
  const unique = [...new Map(existing.map((model) => [model.id, model])).values()];
  const byId = new Map(unique.map((model) => [model.id, model]));
  const decorated = unique.map((model) => {
    const catalog = TOKEN_PLAN_MODELS.find((entry) => entry.id === model.id);
    if (!catalog || model.displayName) return model;
    return { ...model, displayName: `${catalog.brand.zh} · ${catalog.capability.zh}` };
  });
  const missing = TOKEN_PLAN_MODELS
    .filter((model) => !byId.has(model.id))
    .map((model) => {
      const cap = model.kind === "chat"
        ? resolveModelCapabilities(model.id, "openai-compatible")
        : { supportsReasoning: false, reasoningMode: "none" as const, reasoningLevels: [] };
      return {
        id: model.id,
        modelKind: model.kind,
        displayName: `${model.brand.zh} · ${model.capability.zh}`,
        supportsReasoning: cap.supportsReasoning,
        reasoningMode: cap.reasoningMode,
        reasoningLevels: cap.reasoningLevels,
      };
    });
  return [...decorated, ...missing];
}