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

/** 汇总最近一轮助手的文件改动，供输入栏底部状态条直接展示「改了哪些、增删多少行」。 */
export function summarizeTurnChanges(lastMessage: { role: string; steps?: readonly AgentStepItem[] } | undefined): {
  filesCount: number;
  countedChanges: boolean;
  added: number;
  removed: number;
} {
  const files = collectEditedFiles(lastMessage?.role === "assistant" ? lastMessage.steps ?? [] : []);
  return {
    filesCount: files.length,
    countedChanges: files.length > 0 && files.every((file) => file.hasCounts),
    added: files.reduce((sum, file) => sum + file.added, 0),
    removed: files.reduce((sum, file) => sum + file.removed, 0),
  };
}

/** 旧记录的参数可能在文件名之后截断，单独解码仍完整的路径字符串。 */
export function getActivityFilePath(step: AgentStepItem): string | undefined {
  if (step.fileChange?.path) return step.fileChange.path;
  if (!step.toolName || !fileActivityTools.has(step.toolName)) return undefined;
  return getActivityArgumentPath(step);
}

/** 返回可在右栏打开预览的真实文件路径（包含变更文件与已完成的 read_file）。 */
export function getOpenableActivityFilePath(step: AgentStepItem): string | undefined {
  const mutated = getActivityFilePath(step);
  if (mutated) return mutated;
  if (step.toolName === "read_file") return getActivityArgumentPath(step);
  return undefined;
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

/** 从真实工具结果提取 read_file 读取的行号范围；无真实行号时返回 undefined，绝不编造。 */
export function getActivityReadRange(step: AgentStepItem): { startLine: number; endLine: number } | undefined {
  if (step.readRange && step.readRange.startLine >= 1 && step.readRange.endLine >= step.readRange.startLine) {
    return { startLine: step.readRange.startLine, endLine: step.readRange.endLine };
  }
  if (step.toolName !== "read_file") return undefined;
  // 兼容旧会话摘要中的真实范围格式，例如「行动：read_file (读取 src/a.ts (1-38/38))」。
  const summaryMatch = /\((\d+)-(\d+)\/\d+\)/u.exec(step.title ?? "");
  if (summaryMatch?.[1] && summaryMatch[2]) {
    const startLine = Number.parseInt(summaryMatch[1], 10);
    const endLine = Number.parseInt(summaryMatch[2], 10);
    if (startLine >= 1 && endLine >= startLine) return { startLine, endLine };
  }
  const startMatch = /"startLine"\s*:\s*(\d+)/u.exec(step.argsPreview ?? "");
  const endMatch = /"endLine"\s*:\s*(\d+)/u.exec(step.argsPreview ?? "");
  if (startMatch?.[1] && endMatch?.[1]) {
    const startLine = Number.parseInt(startMatch[1], 10);
    const endLine = Number.parseInt(endMatch[1], 10);
    if (startLine >= 1 && endLine >= startLine) return { startLine, endLine };
  }
  return undefined;
}

/** 将真实读取行号格式化为紧凑标记（#L1-38 或单行 #L12）。 */
export function formatReadLineRange(range?: { startLine: number; endLine: number }): string | undefined {
  if (!range) return undefined;
  return range.endLine > range.startLine ? `#L${range.startLine}-${range.endLine}` : `#L${range.startLine}`;
}

/** 统一规范展示用相对/绝对路径，用于悬停精准路径提示。 */
export function normalizeDisplayPath(path: string): string {
  return path.replace(/\\/gu, "/").trim();
}

/** 提取活动行内展示的短文件名。 */
export function getDisplayFileName(path: string): string {
  return path.split(/[\\/]/u).filter(Boolean).at(-1) || path;
}

/** 从工具结果区分真实创建、编辑、删除、分析与历史写入记录。 */
export function getFileActivityKind(step: AgentStepItem) {
  if (step.fileChange?.operation) return step.fileChange.operation;
  if (step.toolName === "read_file") return "analyzed" as const;
  if (step.toolName === "create_file") return "created" as const;
  if (step.toolName === "delete_file") return "deleted" as const;
  if (step.toolName === "edit_file" || step.toolName === "patch_file") return "edited" as const;
  return "written" as const;
}
