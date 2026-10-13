/**
 * 功能：委派深度（递归预算）记账。
 * 作用：顶层深度为 0，每向下委派一层 +1；预算只增不减，避免续接的子 Agent 被当作顶层无限制委派。
 * 关联文件：manager.ts（start 时校验）、tool-subagent、in-process-driver。
 * 移植自 DeepSeek Harness subagent/depth（MIT License，commit 639ed01），按 LFAA RunOptions.depth 适配。
 */
import { SubagentError } from "./error.js";

/** 校验运行时传入的最大深度上限。 */
export function assertSubagentMaxDepth(maxDepth: unknown): number {
  if (maxDepth === undefined) return Number.MAX_SAFE_INTEGER;
  if (typeof maxDepth !== "number" || !Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw new SubagentError("subagent maxDepth 必须是非负安全整数。", "invalid-arguments");
  }
  return maxDepth;
}

/** 计算子代理应使用的深度：父深度 +1。 */
export function nextDepth(parentDepth: number): number {
  if (!Number.isSafeInteger(parentDepth) || parentDepth < 0) {
    throw new SubagentError("父委派深度必须是非负安全整数。", "invalid-arguments");
  }
  return parentDepth + 1;
}

/** 判断当前深度是否仍在预算内。 */
export function isWithinDepth(currentDepth: number, maxDepth: number): boolean {
  return currentDepth < maxDepth;
}

/** 若超出深度预算则抛出类型化错误。 */
export function assertWithinDepth(currentDepth: number, maxDepth: number): void {
  if (!isWithinDepth(currentDepth, maxDepth)) {
    throw new SubagentError(`委派深度 ${currentDepth} 已达上限 ${maxDepth}，禁止继续委派。`, "depth-exceeded");
  }
}
