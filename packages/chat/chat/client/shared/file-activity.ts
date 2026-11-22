// 将本轮文件快照和旧工具参数统一为聊天活动可用的文件定位。
import type { AgentStepItem } from "../store/chat-types";

export const fileActivityTools = new Set(["write_file", "edit_file", "create_file", "patch_file", "delete_file"]);

/** 按真实工具记录归并同一文件。行数累加每次操作，保留每次可回看的快照。 */
export function collectEditedFiles(steps: readonly AgentStepItem[]) {
  const files = new Map<string, { path: string; stepId: string; steps: AgentStepItem[]; added: number; removed: number; hasCounts: boolean }>();
  for (const step of steps) {
    if (step.phase !== "act" || step.status !== "done") continue;
    const path = getActivityFilePath(step);
    if (!path || (step.addedLines === 0 && step.removedLines === 0
      && step.fileChange?.operation !== "created" && step.fileChange?.before === step.fileChange?.after)) continue;
    const key = (step.fileChange?.resolvedPath ?? path).replace(/\\/gu, "/");
    const file = files.get(key) ?? { path, stepId: step.id, steps: [], added: 0, removed: 0, hasCounts: true };
    file.stepId = step.id;
    file.steps.push(step);
    file.added += step.addedLines ?? 0;
    file.removed += step.removedLines ?? 0;
    file.hasCounts &&= step.addedLines !== undefined && step.removedLines !== undefined;
    files.set(key, file);
  }
  return [...files.values()];
}

/** 旧记录的参数可能在文件名之后截断，单独解码仍完整的路径字符串。 */
export function getActivityFilePath(step: AgentStepItem): string | undefined {
  if (step.fileChange?.path) return step.fileChange.path;
  if (!step.toolName || !fileActivityTools.has(step.toolName)) return undefined;
  return getActivityArgumentPath(step);
}

/** 提取活动的路径标签，是否属于可打开的文件变更由调用方判断。 */
export function getActivityArgumentPath(step: AgentStepItem): string | undefined {
  if (step.toolTarget) return step.toolTarget;
  const quoted = /"(?:path|Path|file|filePath)"\s*:\s*("(?:\\.|[^"\\])*")/u.exec(step.argsPreview ?? "")?.[1];
  if (!quoted) return undefined;
  try {
    const path: unknown = JSON.parse(quoted);
    return typeof path === "string" && path.trim() ? path : undefined;
  } catch {
    return undefined;
  }
}

/** 从工具结果区分真实创建、编辑和历史写入记录。 */
export function getFileActivityKind(step: AgentStepItem) {
  return step.fileChange?.operation
    ?? (step.toolName === "create_file" ? "created"
      : step.toolName === "delete_file" ? "deleted"
        : step.toolName === "edit_file" || step.toolName === "patch_file" ? "edited" : "written");
}
