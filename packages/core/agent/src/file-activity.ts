// 会话内文件活动解析：从已落盘消息或运行中步骤里定位本次文件操作的真实路径与预览。
import type { ChatSessionRecord } from "@lfaa/memory";
import { readActivitySource } from "./run/activity-file";
import type { ActiveRunRecord } from "./run/run-records";

/** 解析文件活动所需的会话存储与活跃运行表。 */
export interface FileActivityDeps {
  getSession(sessionId: string): Promise<ChatSessionRecord | null>;
  runs: ReadonlyMap<string, ActiveRunRecord>;
}

/**
 * 浏览器只提交记录标识，路径取自会话里的真实工具结果；
 * 同时兼容「已落盘」与「运行中尚未落盘」两种步骤来源。
 */
export async function readFileActivity(
  deps: FileActivityDeps,
  sessionId: string,
  messageId: string,
  stepId: string,
  resolveRoots: (projectId: string | null) => Promise<string[]>,
) {
  const session = await deps.getSession(sessionId);
  const liveSteps = [...deps.runs.values()]
    .filter((run) => run.status.sessionId === sessionId)
    .flatMap((run) => run.status.steps);
  const step = session?.messages.find((m) => m.id === messageId && m.role === "assistant")?.steps?.find((s) => s.id === stepId)
    ?? liveSteps.find((s) => s.id === stepId)
    ?? session?.messages.filter((m) => m.role === "assistant").flatMap((m) => m.steps ?? []).find((s) => s.id === stepId);
  if (!session || !step || step.phase !== "act" || step.status !== "done") return null;
  const roots = await resolveRoots(session.projectId);
  if (step.fileChange) return readActivitySource(step.fileChange, roots);
  if (step.toolName === "read_file") {
    const targetPath = step.readRange?.resolvedPath ?? step.toolTarget?.trim();
    if (targetPath) {
      return readActivitySource({ path: step.toolTarget?.trim() || targetPath, resolvedPath: targetPath }, roots);
    }
  }
  return null;
}