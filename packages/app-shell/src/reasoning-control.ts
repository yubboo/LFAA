/**
 * 文件：reasoning-control.ts
 * 作用：把当前模型官方 Capability 的 reasoningEffort options 一对一投影成 Runtime Control steps。
 * 负责：保持 Provider option 的数量、顺序、label、value 原样对应；按真实 Provider value 查找当前/默认 index。
 * 不负责：补齐固定档位、过滤关闭项、猜测模型能力、保存模型配置、React 状态、粒子动画或实际模型请求。
 * 状态归属：纯函数，无运行时状态；Provider Capability 真值仍由 @lfaa/config-system 拥有。
 * 对外接口：resolveReasoningStages、resolveReasoningStageIndex。
 * 关联文件：AgentWorkbench.tsx、@lfaa/config-system AiModelSettingOption。
 * 修改注意事项：Runtime step 必须与当前模型 Capability 一一对应；禁止重新引入固定六档、semantic rank、插值或相邻档复用。
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

/**
 * Provider 返回几档就生成几档，并严格保留原顺序。
 * 不过滤 none/off：如果官方 Capability 明确声明，它就是当前模型的真实可选项。
 */
export function resolveReasoningStages(options: readonly AiModelSettingOption[]): readonly ReasoningStageBinding[] {
  return options.map((providerOption, index) => ({
    id: `provider-reasoning-${index}-${providerOption.value}`,
    label: providerOption.label,
    providerOption,
  }));
}

/** 当前真实 Provider value 只做精确匹配；没有匹配时安全回落到第一项。 */
export function resolveReasoningStageIndex(options: readonly AiModelSettingOption[], value: AiModelSettingValue | undefined): number {
  if (!options.length) return 0;
  const index = options.findIndex((option) => option.value === value);
  return index >= 0 ? index : 0;
}
