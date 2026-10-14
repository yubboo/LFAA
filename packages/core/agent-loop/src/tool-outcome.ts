/**
 * 功能：统一判断工具及节点任务的真实执行结果。
 * 作用：识别顶层/嵌套任务，避免失败任务被登记为成功写入；未知结果优先于成功标记。
 * 关联文件：execute-turn.ts 用于活动、Session 与防重记录；business-tools.ts 返回任务结果。
 */
export function toolExecutionState(value: unknown, dispatched: boolean): "not_started" | "unconfirmed" | "failed" | "complete" {
  if (!dispatched) return "not_started";
  const result = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const task = result.task && typeof result.task === "object" && !Array.isArray(result.task) ? result.task as Record<string, unknown> : result;
  const detail = task.result && typeof task.result === "object" ? task.result as Record<string, unknown> : {};
  if (result.executionState === "unconfirmed" || detail.outcome === "unknown" || task.status === "queued" || task.status === "running") return "unconfirmed";
  if (result.executionState === "failed" || result.isError === true || result.error !== undefined || task.status === "failed" || task.status === "error") return "failed";
  return "complete";
}
