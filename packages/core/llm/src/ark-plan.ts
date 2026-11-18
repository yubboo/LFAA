// 方舟个人套餐公开模型目录与思考参数契约，供 Host 请求适配和浏览器模型选择共用。
import type { ModelCapabilityInfo, ReasoningEffortLevel } from "./types";

/** 用套餐类型区分请求路由及可在配置页展示的模型分类。 */
export type ArkPlanKind = "agent" | "coding";

/** 两种北京区套餐的 Chat Completions Base URL，由配置表单和 Host 共同使用。 */
export const ARK_PLAN_BASE_URLS = {
  agent: "https://ark.cn-beijing.volces.com/api/plan/v3",
  coding: "https://ark.cn-beijing.volces.com/api/coding/v3",
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
  const base = baseUrl.trim().replace(/\/+$/u, "").replace(/\/chat\/completions$/u, "");
  if (base === ARK_PLAN_BASE_URLS.agent || base === ARK_PLAN_BASE_URLS.agent.replace(/\/v3$/u, "")) return "agent";
  if (base === ARK_PLAN_BASE_URLS.coding || base === ARK_PLAN_BASE_URLS.coding.replace(/\/v3$/u, "")) return "coding";
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
