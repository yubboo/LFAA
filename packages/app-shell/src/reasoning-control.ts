/**
 * 文件：reasoning-control.ts
 * 作用：把当前模型官方 Capability 的 reasoningEffort options 投影成 Runtime Control 的“有效推理强度” steps。
 * 负责：过滤只表达“关闭推理”的 sentinel；其余 Provider option 的数量、顺序、label、value 原样对应；按真实 Provider value 查找当前/默认 index。
 * 不负责：修改 Provider Catalog、补齐固定档位、猜测模型能力、保存模型配置、React 状态、粒子动画或实际模型请求。
 * 状态归属：纯函数，无运行时状态；Provider Capability 真值仍由 @lfaa/config-system 拥有。
 * 对外接口：resolveReasoningStages、resolveReasoningStageIndex、isDisabledReasoningOption。
 * 关联文件：AgentWorkbench.tsx、@lfaa/config-system AiModelSettingOption。
 * 修改注意事项：Runtime Slider 表达“推理强度”，不是“是否启用推理”；关闭 sentinel 只在本投影层过滤，禁止从 Provider Capability 中删除。
 */
import type { AiModelSettingOption, AiModelSettingValue } from "@lfaa/config-system";

export interface ReasoningStageBinding {
  /** UI key 只用于 React/Slider 标识，不会发送给 Provider。 */
  readonly id: string;
  /** 直接显示 Provider Capability 提供的 label。 */
  readonly label: string;
  /** Provider 官方 option；实际 Run 只能提交这里的 value。 */
  readonly providerOption: AiModelSettingOption;
}

const DISABLED_REASONING_VALUES = new Set(["none", "off", "disabled", "disable", "false", "no", "0"]);

/**
 * Provider 可以真实声明“关闭推理”能力，但 Runtime 的“思考强度”滑条不把开关态混成最低档。
 * 只识别明确 sentinel；minimal / low / medium / high / xhigh / max 等真实强度不会被重命名或重新排序。
 */
export function isDisabledReasoningOption(option: AiModelSettingOption): boolean {
  const value = String(option.value).trim().toLowerCase();
  if (DISABLED_REASONING_VALUES.has(value)) return true;

  const label = option.label.trim().toLowerCase().replace(/\s+/gu, " ");
  return label === "关闭思考"
    || label === "关闭推理"
    || label === "不思考"
    || label === "off"
    || label === "disabled"
    || label === "disable reasoning"
    || label === "reasoning off"
    || label === "no reasoning";
}

function runtimeReasoningOptions(options: readonly AiModelSettingOption[]) {
  return options.filter((option) => !isDisabledReasoningOption(option));
}

/** Provider 返回的有效推理强度有几档就生成几档，并严格保留原顺序。 */
export function resolveReasoningStages(options: readonly AiModelSettingOption[]): readonly ReasoningStageBinding[] {
  return runtimeReasoningOptions(options).map((providerOption, index) => ({
    id: `provider-reasoning-${index}-${providerOption.value}`,
    label: providerOption.label,
    providerOption,
  }));
}

/**
 * 当前真实 Provider value 只做精确匹配。
 * 若当前配置恰好是关闭 sentinel，而 Runtime Slider 已过滤该项，则安全回落到最低有效推理强度。
 */
export function resolveReasoningStageIndex(options: readonly AiModelSettingOption[], value: AiModelSettingValue | undefined): number {
  const runtimeOptions = runtimeReasoningOptions(options);
  if (!runtimeOptions.length) return 0;
  const index = runtimeOptions.findIndex((option) => option.value === value);
  return index >= 0 ? index : 0;
}
