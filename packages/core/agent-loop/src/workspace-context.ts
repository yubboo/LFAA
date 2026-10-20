/**
 * 功能：把 Session 保存的项目身份解析成当前登记的工作目录。
 * 作用：Session 仅保留历史选择快照；实际工具执行优先读取同账户、同节点的 Workspace Owner 目录。
 * 关联文件：runs.ts、execute-turn.ts、lfaa-workspace-workspace。
 */
import { getAiSessionWorkspaceContext, type AiSessionProjectContext } from "lfaa-session/src/sessions.js";
import { getWorkspaceProject } from "lfaa-workspace-workspace/src/index.js";

export function resolveAiSessionWorkspaceContext(userId: string, sessionId: string): AiSessionProjectContext | null {
  const snapshot = getAiSessionWorkspaceContext(userId, sessionId);
  if (!snapshot) return null;
  const registered = getWorkspaceProject(userId, snapshot.id);
  if (!registered || registered.nodeId !== snapshot.nodeId || registered.appId && registered.appId !== snapshot.appId) return snapshot;
  return {
    id: registered.id,
    appId: registered.appId === "minecraft" ? "minecraft" : snapshot.appId,
    nodeId: registered.nodeId,
    path: registered.path,
    title: registered.title
  };
}
