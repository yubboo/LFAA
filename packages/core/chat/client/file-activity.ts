// 将本轮文件快照和旧工具参数统一为聊天活动可用的文件定位。
import type { AgentStepItem } from "./chat-types";

export const fileActivityTools = new Set(["write_file", "edit_file", "create_file", "patch_file", "delete_file"]);

/** 旧记录的参数可能在文件名之后截断，单独解码仍完整的路径字符串。 */
export function getActivityFilePath(step: AgentStepItem): string | undefined {
  if (step.fileChange?.path) return step.fileChange.path;
  if (!step.toolName || !fileActivityTools.has(step.toolName)) return undefined;
  return getActivityArgumentPath(step);
}

/** 提取活动的路径标签，是否属于可打开的文件变更由调用方判断。 */
export function getActivityArgumentPath(step: AgentStepItem): string | undefined {
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
