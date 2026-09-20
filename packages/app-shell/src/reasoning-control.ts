/**
 * 文件：reasoning-control.ts
 * 作用：把 LFAA 固定六档推理 UI 投影到当前模型官方声明的 reasoning Capability。
 * 负责：六档标签、关闭值过滤、Provider option 强度排序/映射、当前 Provider 值反推 UI 档位。
 * 不负责：保存模型配置、Provider Capability 真值、React 状态、粒子动画或实际模型请求。
 * 状态归属：纯函数/常量，无运行时状态；Provider Capability 仍由 @lfaa/config-system 拥有。
 * 对外接口：REASONING_UI_STAGES、resolveReasoningStageMap、resolveReasoningStageIndex、isReasoningDisabledValue。
 * 关联文件：AgentWorkbench.tsx、@lfaa/config-system AiModelSettingOption。
 * 修改注意事项：六档是产品显示刻度，不得把 stage id/label 直接发送给 Provider；实际请求只能使用映射后的官方 option.value。
 */
import type { AiModelSettingOption, AiModelSettingValue } from "@lfaa/config-system";

export const REASONING_UI_STAGES = [
  { id: "very-low", label: "极低", rank: 0 },
  { id: "low", label: "低", rank: 1 },
  { id: "medium", label: "中", rank: 2 },
  { id: "high", label: "高", rank: 3 },
  { id: "very-high", label: "极高", rank: 4 },
  { id: "extreme", label: "极限", rank: 5 },
] as const;

export const REASONING_EXTREME_STAGE_INDEX = REASONING_UI_STAGES.length - 1;

const DISABLED_REASONING_VALUES = new Set(["none", "disabled", "off", "false", "0"]);

export function isReasoningDisabledValue(value: AiModelSettingValue | undefined): boolean {
  if (value === false || value === 0) return true;
  return typeof value === "string" && DISABLED_REASONING_VALUES.has(value.trim().toLowerCase());
}

function semanticRank(value: AiModelSettingValue, fallbackIndex: number, count: number): number {
  const normalized = String(value).trim().toLowerCase().replace(/[\s_-]+/g, "");
  const known: Readonly<Record<string, number>> = {
    minimal: 0,
    min: 0,
    verylow: 0,
    low: 1,
    medium: 2,
    med: 2,
    normal: 2,
    high: 3,
    veryhigh: 4,
    xhigh: 4,
    extrahigh: 4,
    max: 5,
    maximum: 5,
    extreme: 5,
    ultra: 5,
  };
  const resolved = known[normalized];
  if (resolved !== undefined) return resolved;
  if (count <= 1) return 3;
  return (fallbackIndex / (count - 1)) * 5;
}

export interface ReasoningStageBinding {
  readonly stage: (typeof REASONING_UI_STAGES)[number];
  readonly providerOption: AiModelSettingOption;
}

/**
 * 六档 UI 永远存在，但 Provider 只会收到它自己声明过的非关闭值。
 * Provider 档位少于六档时，相邻 UI 档允许映射到同一个官方值，避免伪造 unsupported effort。
 */
export function resolveReasoningStageMap(options: readonly AiModelSettingOption[]): readonly ReasoningStageBinding[] {
  const enabled = options.filter((option) => !isReasoningDisabledValue(option.value));
  if (!enabled.length) return [];
  const ranked = enabled.map((option, index) => ({
    option,
    rank: semanticRank(option.value, index, enabled.length),
    order: index,
  }));
  return REASONING_UI_STAGES.map((stage) => {
    const best = ranked.reduce((current, candidate) => {
      const currentDistance = Math.abs(current.rank - stage.rank);
      const candidateDistance = Math.abs(candidate.rank - stage.rank);
      if (candidateDistance < currentDistance) return candidate;
      if (candidateDistance > currentDistance) return current;
      // 相同距离时优先较低档，避免低档 UI 意外向上放大 Provider reasoning。
      return candidate.order < current.order ? candidate : current;
    });
    return { stage, providerOption: best.option };
  });
}

/** 当前真实 Provider 值反推最接近的六档 UI；未知值按官方 options 顺序归一。 */
export function resolveReasoningStageIndex(options: readonly AiModelSettingOption[], value: AiModelSettingValue | undefined): number {
  const enabled = options.filter((option) => !isReasoningDisabledValue(option.value));
  if (!enabled.length) return 0;
  const actualIndex = enabled.findIndex((option) => option.value === value);
  if (actualIndex < 0) return 0;
  const rank = semanticRank(enabled[actualIndex]!.value, actualIndex, enabled.length);
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [index, stage] of REASONING_UI_STAGES.entries()) {
    const distance = Math.abs(stage.rank - rank);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}
