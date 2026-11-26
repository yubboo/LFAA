// 聊天 / 工作模式与项目绑定的同步：聊天模式不绑项目，回到工作模式时恢复上次项目。
// 从 WorkbenchShell 抽出，避免 Shell 文件继续变长，同时让「新聊天 / 切模式」两条入口共用同一份规则。
import { useCallback, useEffect, useRef } from "react";
import type { WorkbenchClientService } from "../workbench-service";
import type { WorkspaceMode } from "./navigation";

export function useWorkspaceModeSync(
  service: WorkbenchClientService,
  mode: WorkspaceMode,
  activeProjectId: string | null,
): (nextMode: WorkspaceMode) => void {
  // 记住最近一次真正选中的项目：聊天模式解绑后，切回工作时用它恢复。
  const lastProjectRef = useRef<string | null>(null);
  if (activeProjectId) lastProjectRef.current = activeProjectId;

  // 刷新或切到聊天模式时补一次解绑：未开始的草稿不再挂到项目下。
  useEffect(() => {
    if (mode !== "chatgpt") return;
    const snapshot = service.getSnapshot();
    if (snapshot.activeChatSessionId) return;
    if (snapshot.chatProvider?.getDraftProjectId?.()) {
      void snapshot.chatProvider.setActiveProjectBinding?.(null);
    }
  }, [mode, service]);

  return useCallback((nextMode: WorkspaceMode) => {
    service.setWorkspaceMode(nextMode);
    const snapshot = service.getSnapshot();
    // 已开始的会话不改归属：模式只影响新会话。
    if (snapshot.activeChatSessionId) return;
    const draftProjectId = snapshot.chatProvider?.getDraftProjectId?.() ?? null;
    if (nextMode === "chatgpt") {
      if (draftProjectId) void snapshot.chatProvider?.setActiveProjectBinding?.(null);
      return;
    }
    if (draftProjectId) return;
    // 回到工作模式时恢复最近一次选中的项目；没有记录就保持未绑定。
    const target = snapshot.activeProjectId ?? lastProjectRef.current;
    if (!target) return;
    void snapshot.chatProvider?.setActiveProjectBinding?.(target);
    service.setActiveProject(target);
  }, [service]);
}