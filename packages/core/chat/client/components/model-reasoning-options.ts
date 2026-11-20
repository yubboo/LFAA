// 模型选择器的档位常量与纯计算：解析当前模型档案、可选模型清单、生效模型与推理档位，不涉及 React。
import { findArkChatModel, getArkPlanCatalog, getArkPlanKind, type ArkPlanKind } from "@lfaa/llm/ark-plan";
import type { StepSliderOption } from "@lfaa/ui-primitives/client";
import type { ModelCapabilityItem, PublicLlmProfileItem, ReasoningLevelOption } from "../chat-types";
import { arkModelMessages } from "../locales";

/** 中文推理档位文案。 */
export const REASONING_LABELS_ZH: Record<ReasoningLevelOption, string> = {
  minimal: "最低",
  low: "低",
  medium: "中",
  high: "高",
  max: "极高",
};

/** 英文推理档位文案。 */
export const REASONING_LABELS_EN: Record<ReasoningLevelOption, string> = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
};

/** 方舟目录模型的结构化能力信息，与 @lfaa/llm/ark-plan 的目录条目一致。 */
export interface ArkChatModelInfo {
  id: string;
  supportsReasoning: boolean;
  reasoningMode: "none" | "fixed" | "effort";
  reasoningLevels: ReasoningLevelOption[];
  defaultReasoningLevel?: ReasoningLevelOption;
  offEffort?: "none" | "minimal";
  status?: "retiring" | "routed";
}

/** 方舟目录双语文案按同一键结构收敛，兼容中英文两套字典。 */
export type ArkModelLabels = { [K in keyof (typeof arkModelMessages)["zh"]]: string };

/** 仅保留在设置中心完成配置或已填凭据的提供商。 */
export function filterConfiguredProfiles(profiles: PublicLlmProfileItem[]): PublicLlmProfileItem[] {
  return profiles.filter((p) => p.configured || p.hasApiKey);
}

/** 优先当前选中的档案，找不到时回退首个已配置档案；无可用档案返回 null。 */
export function resolveActiveProfile(
  configuredProfiles: PublicLlmProfileItem[],
  activeProfileId: string,
): PublicLlmProfileItem | null {
  return configuredProfiles.find((p) => p.id === activeProfileId) ?? configuredProfiles[0] ?? null;
}

/** 解析档案所属的方舟套餐类型；仅 OpenAI Chat 与 Anthropic Messages 协议参与判定。 */
export function resolveArkPlan(activeProfile: PublicLlmProfileItem | null): ArkPlanKind | undefined {
  const activeProtocol = activeProfile?.apiProtocol ?? "openai-chat";
  return activeProfile && (activeProtocol === "openai-chat" || activeProtocol === "anthropic-messages")
    ? getArkPlanKind(activeProfile.baseUrl) : undefined;
}

/** 在方舟套餐内按模型 ID 查找目录条目，其余情况不返回目录信息。 */
export function resolveArkModel(
  activeProfile: PublicLlmProfileItem | null,
  arkPlan: ArkPlanKind | undefined,
): ArkChatModelInfo | undefined {
  return activeProfile && arkPlan ? findArkChatModel(activeProfile.model) : undefined;
}

// 方舟使用套餐公开目录，其余档案（含普通 API、其他套餐与本地服务）优先展示已同步的模型清单。
/** 计算当前档案可展示的品牌/官方模型清单，保证至少包含当前模型一项。 */
export function buildBrandModels(
  activeProfile: PublicLlmProfileItem | null,
  arkPlan: ArkPlanKind | undefined,
): ModelCapabilityItem[] {
  if (!activeProfile) return [];
  const list = activeProfile.availableModels ?? [];
  if (arkPlan) {
    const { chatModels } = getArkPlanCatalog(arkPlan);
    if (findArkChatModel(activeProfile.model)) return [...chatModels];
    return [
      { id: activeProfile.model, supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      ...chatModels,
    ];
  }
  if (list.length > 0) return list;
  return [{ id: activeProfile.model, supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }];
}

/** 计算当前生效的模型 ID：优先方舟目录命中，其次档案当前模型，最后回退列表首项。 */
export function resolveActiveModelId(
  arkModel: ArkChatModelInfo | undefined,
  brandModels: ModelCapabilityItem[],
  activeProfile: PublicLlmProfileItem | null,
): string {
  return arkModel?.id ?? brandModels.find((m) => m.id === activeProfile?.model)?.id ?? brandModels[0]?.id ?? "";
}

/** 解析当前模型能力，缺失时回退为标准对话模型。 */
export function resolveActiveModelCap(
  brandModels: ModelCapabilityItem[],
  activeModelId: string,
): ModelCapabilityItem {
  return brandModels.find((m) => m.id === activeModelId) ?? {
    id: activeModelId,
    supportsReasoning: false,
    reasoningMode: "none" as const,
    reasoningLevels: [],
  };
}

// 只有模型支持多档强度才生成滑块选项。方舟的 minimal 若可关闭思考则显示「关闭」。
/** 生成推理强度滑块选项；非 effort 模型返回空数组。 */
export function buildLevelOptions({
  activeModelCap,
  arkModel,
  arkLabels,
  isZh,
}: {
  activeModelCap: ModelCapabilityItem;
  arkModel: ArkChatModelInfo | undefined;
  arkLabels: ArkModelLabels;
  isZh: boolean;
}): Array<StepSliderOption<ReasoningLevelOption>> {
  if (activeModelCap.reasoningMode !== "effort") return [];
  return activeModelCap.reasoningLevels.map((id) => ({
    id,
    label: id === "minimal" && arkModel?.offEffort
      ? arkLabels.off
      : (isZh ? REASONING_LABELS_ZH[id] : REASONING_LABELS_EN[id]),
  }));
}

// 切换模型后优先保留仍受支持的档位，否则用该模型的默认档。
/** 计算切换模型后的生效档位：优先保留当前档，其次模型默认档，最后取最高档。 */
export function resolveEffectiveReasoning(
  levelOptions: Array<StepSliderOption<ReasoningLevelOption>>,
  reasoningLevel: ReasoningLevelOption,
  activeModelCap: ModelCapabilityItem,
): ReasoningLevelOption {
  return levelOptions.some((o) => o.id === reasoningLevel)
    ? reasoningLevel
    : (activeModelCap.defaultReasoningLevel && levelOptions.some((o) => o.id === activeModelCap.defaultReasoningLevel)
        ? activeModelCap.defaultReasoningLevel
        : (levelOptions[Math.max(0, levelOptions.length - 1)]?.id ?? "high"));
}

/** 计算「恢复官方默认强度」应落到的档位：优先模型默认档，否则首档。 */
export function resolveResetReasoning(
  levelOptions: Array<StepSliderOption<ReasoningLevelOption>>,
  activeModelCap: ModelCapabilityItem,
): ReasoningLevelOption {
  return activeModelCap.defaultReasoningLevel && levelOptions.some((o) => o.id === activeModelCap.defaultReasoningLevel)
    ? activeModelCap.defaultReasoningLevel
    : (levelOptions[0]?.id ?? "high");
}
