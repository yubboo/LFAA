/**
 * 功能：子代理模型选择——从目录中为一次委派选定模型。
 * 作用：校验请求的模型 id 是否在目录内；不在时回退默认，而不是抛错打断委派。
 * 关联文件：list-models.ts、invariant.ts、model-selection-state.ts。
 * 移植自 DeepSeek Harness tool-subagent/model-selection（MIT License，commit 639ed01），按 LFAA 适配。
 */
import type { ModelChoice } from "./list-models.js";

/** 选择结果：选中的模型；未指定或非法时给出默认项。 */
export interface ModelSelection {
  readonly selected: ModelChoice;
  /** 是否因请求无效而回退默认。 */
  readonly fellBack: boolean;
}

/** 在目录中按 id 选择；空目录返回空选择（由调用方决定是否禁用模型覆盖）。 */
export function selectModel(requestedId: string | undefined, catalog: readonly ModelChoice[]): ModelSelection | null {
  if (catalog.length === 0) return null;
  const fallback = catalog[0];
  if (!requestedId) return { selected: fallback, fellBack: true };
  const hit = catalog.find(choice => choice.id === requestedId);
  return hit ? { selected: hit, fellBack: false } : { selected: fallback, fellBack: true };
}
