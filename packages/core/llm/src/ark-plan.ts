// 方舟个人套餐公开模型目录与思考参数契约，供 Host 请求适配和浏览器模型选择共用。
import type { ModelCapabilityInfo, ReasoningEffortLevel } from "./types";

/** 一条模型的中英文说明对。 */
interface ArkText {
  zh: string;
  en: string;
}

const DOUBAO: ArkText = { zh: "豆包", en: "Doubao" };
const KIMI: ArkText = { zh: "Kimi", en: "Kimi" };
const DEEPSEEK: ArkText = { zh: "DeepSeek", en: "DeepSeek" };
const ZHIPU: ArkText = { zh: "智谱AI", en: "Zhipu AI" };
const ARK_ROUTER: ArkText = { zh: "方舟路由", en: "Ark router" };

const TEXT_REASONING: ArkText = { zh: "文本生成、推理", en: "Text & reasoning" };
const EMBEDDING: ArkText = { zh: "向量化（文本/图像）", en: "Embeddings (text/image)" };
const IMAGE: ArkText = { zh: "图片生成", en: "Image generation" };
// 官方套餐文档：Small / Medium 不含视频生成，只有 Large / Max 支持，文案必须带档位。
const VIDEO_LARGE: ArkText = { zh: "视频生成（Large/Max 套餐）", en: "Video generation (Large/Max plans)" };
const TTS: ArkText = { zh: "语音合成", en: "Speech synthesis" };
const ASR: ArkText = { zh: "语音识别", en: "Speech recognition" };

/** Agent Plan 的视频生成模型；只有 Large / Max 套餐可用，Small / Medium 会返回 UnsupportedModel。 */
export const ARK_AGENT_VIDEO_MODELS: readonly string[] = [
  "doubao-seedance-2.0",
  "doubao-seedance-2.0-fast",
  "doubao-seedance-2.0-mini",
  "doubao-seedance-2.5",
  "doubao-seedance-2.5-flash",
];

/** 方舟套餐模型的品牌与能力说明：按 ID 精确登记，未登记的按前缀推断品牌。 */
const ARK_MODEL_META: Record<string, { brand: ArkText; capability?: ArkText }> = {
  "ark-code-latest": { brand: ARK_ROUTER, capability: { zh: "控制台路由", en: "Console routed" } },
  "doubao-seed-evolving": { brand: DOUBAO, capability: TEXT_REASONING },
  "doubao-seed-2.1-pro": { brand: DOUBAO, capability: TEXT_REASONING },
  "doubao-seed-2.1-lite": { brand: DOUBAO, capability: TEXT_REASONING },
  "doubao-seed-2.0-mini": { brand: DOUBAO, capability: TEXT_REASONING },
  "kimi-k3.1-pro": { brand: KIMI, capability: TEXT_REASONING },
  "kimi-k2.8-preview": { brand: KIMI, capability: TEXT_REASONING },
  "kimi-k3": { brand: KIMI, capability: TEXT_REASONING },
  "deepseek-v4.1-flash": { brand: DEEPSEEK, capability: TEXT_REASONING },
  "deepseek-v4.1-flash-economy": { brand: DEEPSEEK, capability: TEXT_REASONING },
  "deepseek-v4-pro": { brand: DEEPSEEK, capability: TEXT_REASONING },
  "deepseek-v4-flash": { brand: DEEPSEEK, capability: TEXT_REASONING },
  "glm-5.3": { brand: ZHIPU, capability: TEXT_REASONING },
  "glm-5.3-flash": { brand: ZHIPU, capability: TEXT_REASONING },
  "doubao-embedding-vision": { brand: DOUBAO, capability: EMBEDDING },
  "doubao-seedream-5-0-pro": { brand: DOUBAO, capability: IMAGE },
  "doubao-seedream-5.5": { brand: DOUBAO, capability: IMAGE },
  "doubao-seedream-5.0-flash": { brand: DOUBAO, capability: IMAGE },
  "doubao-seedance-2.0": { brand: DOUBAO, capability: VIDEO_LARGE },
  "doubao-seedance-2.0-fast": { brand: DOUBAO, capability: VIDEO_LARGE },
  "doubao-seedance-2.0-mini": { brand: DOUBAO, capability: VIDEO_LARGE },
  "doubao-seedance-2.5": { brand: DOUBAO, capability: VIDEO_LARGE },
  "doubao-seedance-2.5-flash": { brand: DOUBAO, capability: VIDEO_LARGE },
  "doubao-seed-tts-2.0": { brand: DOUBAO, capability: TTS },
  "doubao-seed-asr-2.0": { brand: DOUBAO, capability: ASR },
};

// 未登记的新模型按前缀给出品牌，避免整行缺失品牌信息。
function arkBrandOf(id: string): ArkText | undefined {
  const lower = id.trim().toLowerCase();
  if (lower.startsWith("doubao-")) return DOUBAO;
  if (lower.startsWith("kimi-")) return KIMI;
  if (lower.startsWith("deepseek-")) return DEEPSEEK;
  if (lower.startsWith("glm-")) return ZHIPU;
  if (lower.startsWith("ark-")) return ARK_ROUTER;
  return undefined;
}

/** 方舟模型品牌名；未知模型返回 undefined。 */
export function describeArkModelBrand(id: string, isZh: boolean): string | undefined {
  const meta = ARK_MODEL_META[id.trim().toLowerCase()] ?? { brand: arkBrandOf(id) as ArkText };
  if (!meta.brand) return undefined;
  return isZh ? meta.brand.zh : meta.brand.en;
}

/** 方舟模型能力说明；未登记能力时返回 undefined。 */
export function describeArkModelCapability(id: string, isZh: boolean): string | undefined {
  const capability = ARK_MODEL_META[id.trim().toLowerCase()]?.capability;
  if (!capability) return undefined;
  return isZh ? capability.zh : capability.en;
}

/** 方舟模型的「品牌 · 能力」一行说明，用于选择器副标题。 */
export function describeArkModelLine(id: string, isZh: boolean): string | undefined {
  const brand = describeArkModelBrand(id, isZh);
  if (!brand) return undefined;
  const capability = describeArkModelCapability(id, isZh);
  return capability ? `${brand} · ${capability}` : brand;
}

/** 用套餐类型区分请求路由及可在配置页展示的模型分类。 */
export type ArkPlanKind = "agent" | "coding";

/** 两种北京区套餐的 Chat Completions Base URL，由配置表单和 Host 共同使用。 */
export const ARK_PLAN_BASE_URLS = {
  agent: "https://ark.cn-beijing.volces.com/api/plan/v3",
  coding: "https://ark.cn-beijing.volces.com/api/coding/v3",
} as const;

/** 两种北京区套餐的 Anthropic Messages 兼容 Base URL。 */
export const ARK_PLAN_ANTHROPIC_BASE_URLS = {
  agent: "https://ark.cn-beijing.volces.com/api/plan",
  coding: "https://ark.cn-beijing.volces.com/api/coding",
} as const;

interface ArkChatModel extends ModelCapabilityInfo {
  offEffort?: "none" | "minimal";
  status?: "retiring" | "routed";
}

interface ArkCatalogGroup {
  kind: "embedding" | "vision" | "speech";
  models: readonly { id: string; resourceId?: string }[];
}

// 为可调模型记录原生档位、默认档与关闭思考时使用的接口值。
function adjustable(
  id: string,
  defaultReasoningLevel: ReasoningEffortLevel,
  reasoningLevels: ReasoningEffortLevel[],
  offEffort?: ArkChatModel["offEffort"],
): ArkChatModel {
  return {
    id, defaultReasoningLevel, reasoningLevels, supportsReasoning: true, reasoningMode: "effort",
    ...(offEffort ? { offEffort } : {}),
  };
}

// 套餐调用使用短模型名。思考档位取方舟文档中有不同效果的取值，合并等价档位。
const chatModels: readonly ArkChatModel[] = [
  { id: "ark-code-latest", status: "routed", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
  adjustable("doubao-seed-evolving", "high", ["minimal", "low", "medium", "high"], "minimal"),
  adjustable("doubao-seed-2.1-pro", "high", ["minimal", "low", "medium", "high"], "minimal"),
  adjustable("doubao-seed-2.1-lite", "high", ["minimal", "low", "medium", "high"], "minimal"),
  adjustable("doubao-seed-2.0-mini", "medium", ["minimal", "low", "medium", "high"], "minimal"),
  adjustable("kimi-k3.1-pro", "max", ["low", "high", "max"]),
  { id: "kimi-k2.8-preview", supportsReasoning: true, reasoningMode: "fixed", reasoningLevels: [] },
  adjustable("deepseek-v4.1-flash", "high", ["minimal", "low", "high", "max"], "none"),
  adjustable("deepseek-v4.1-flash-economy", "high", ["minimal", "low", "high", "max"], "none"),
  { id: "glm-5.3", supportsReasoning: true, reasoningMode: "fixed", reasoningLevels: [] },
  adjustable("glm-5.3-flash", "max", ["low", "high", "max"]),
  adjustable("deepseek-v4-pro", "high", ["minimal", "low", "high", "max"], "minimal"),
  adjustable("deepseek-v4-flash", "high", ["minimal", "low", "high", "max"], "minimal"),
  { id: "kimi-k3", status: "retiring", supportsReasoning: true, reasoningMode: "fixed", reasoningLevels: [] },
];

const embeddingGroup: ArkCatalogGroup = {
  kind: "embedding",
  models: [{ id: "doubao-embedding-vision" }],
};

const agentGroups: readonly ArkCatalogGroup[] = [
  embeddingGroup,
  {
    kind: "vision",
    models: [
      { id: "doubao-seedream-5-0-pro" },
      { id: "doubao-seedream-5.5" },
      { id: "doubao-seedream-5.0-flash" },
    ],
  },
  {
    kind: "speech",
    models: [
      { id: "doubao-seed-tts-2.0", resourceId: "seed-tts-2.0" },
      { id: "doubao-seed-asr-2.0", resourceId: "volc.seedasr.sauc.duration" },
    ],
  },
];

const codingGroups: readonly ArkCatalogGroup[] = [embeddingGroup];

// 仅匹配方舟官方套餐地址，普通 API 与转发地址继续使用原有能力探测。
export function getArkPlanKind(baseUrl: string): ArkPlanKind | undefined {
  const base = baseUrl.trim().replace(/\/+$/u, "").replace(/\/(chat\/completions|v1\/messages|messages)$/u, "");
  if (base === ARK_PLAN_BASE_URLS.agent || base === ARK_PLAN_ANTHROPIC_BASE_URLS.agent) return "agent";
  if (base === ARK_PLAN_BASE_URLS.coding || base === ARK_PLAN_ANTHROPIC_BASE_URLS.coding) return "coding";
}

/** 返回指定套餐的公开模型目录，语言模型可聊天，其余分类供配置页查阅。 */
export function getArkPlanCatalog(kind: ArkPlanKind) {
  return { chatModels, otherGroups: kind === "agent" ? agentGroups : codingGroups };
}

/** 兼容历史保存的大小写与空白，按完整模型 ID 查找已知能力。 */
export function findArkChatModel(id: string): ArkChatModel | undefined {
  const normalizedId = id.trim().toLowerCase();
  return chatModels.find((model) => model.id === normalizedId);
}

// 界面沿用已有 minimal 选项，方舟请求使用模型真正能关闭思考的取值。
export function getArkReasoningEffort(model: ArkChatModel | undefined, effort?: ReasoningEffortLevel) {
  if (model?.reasoningMode !== "effort") return undefined;
  const selected = effort && model.reasoningLevels.includes(effort) ? effort : model.defaultReasoningLevel;
  return selected === "minimal" ? model.offEffort : selected;
}
