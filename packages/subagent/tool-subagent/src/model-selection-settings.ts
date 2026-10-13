/**
 * 功能：子代理模型选择的设置层适配。
 * 作用：描述如何从 LFAA settings 读取默认模型与覆盖；当前为纯函数适配器，真实 settings 注入为集成需要。
 * 关联文件：model-selection.ts、list-models.ts。
 * 移植自 DeepSeek Harness tool-subagent/model-selection-settings（MIT License，commit 639ed01），按 LFAA settings 适配。
 */
import type { ModelChoice } from "./list-models.js";

/** 设置中与子代理模型相关的最小字段。 */
export interface SubagentModelSettings {
  /** 用户配置的默认子代理模型 id。 */
  defaultModelId?: string;
}

/** 合并设置默认值与本次请求：请求优先，缺省用设置默认，再缺省用目录首项。 */
export function resolveDefaultFromSettings(settings: SubagentModelSettings, catalog: readonly ModelChoice[]): string | undefined {
  if (settings.defaultModelId && catalog.some(choice => choice.id === settings.defaultModelId)) {
    return settings.defaultModelId;
  }
  return catalog[0]?.id;
}
