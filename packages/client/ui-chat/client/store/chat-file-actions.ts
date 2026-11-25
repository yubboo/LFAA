// 文件预览与右栏舞台动作：打开/切换/关闭文件标签、右栏面板请求与文件内容读取。
import { getActivityReadRange, getOpenableActivityFilePath } from "../shared/file-activity";
import { fetchJson } from "./chat-http";
import type { FilePreviewTab } from "./chat-types";
import type { ChatStorePort } from "./chat-store-port";

export class ChatFileActions {
  constructor(private readonly port: ChatStorePort) {}

  /** 右栏打开会话中已有成功记录的文件步骤（写入/编辑/读取），并精确记录定位行号；activateStage=false 时仅后台刷新标签不切走当前舞台。 */
  openFilePreview(messageId: string, stepId: string, activateStage = true): boolean {
    const state = this.port.getState();
    const step = state.activeSession?.messages.find((message) => message.id === messageId)
      ?.steps?.find((item) => item.id === stepId);
    const path = step && getOpenableActivityFilePath(step);
    if (!step || step.status !== "done" || !path) return false;
    const resolvedPath = step.fileChange?.resolvedPath ?? step.readRange?.resolvedPath ?? path;
    const normalized = resolvedPath.replace(/\\/gu, "/");
    const id = /^(?:[a-z]:\/|\/\/)/iu.test(normalized) ? normalized.toLowerCase() : normalized;
    const readRange = getActivityReadRange(step);
    const targetLine = step.fileChange?.firstLine ?? readRange?.startLine;
    const endLine = step.fileChange?.firstLine !== undefined
      ? step.fileChange.firstLine + Math.max(0, (step.fileChange.after.split("\n").length ?? 1) - 1)
      : readRange?.endLine;
    const next: FilePreviewTab = {
      id,
      path: resolvedPath,
      relativePath: path.replace(/\\/gu, "/"),
      projectId: state.activeSession?.projectId ?? null,
      messageId,
      stepId,
      ...(targetLine !== undefined ? { targetLine } : {}),
      ...(endLine !== undefined ? { endLine } : {}),
    };
    const tabs = state.filePreviewTabs;
    this.port.patchState({
      ...(activateStage ? { activeFilePreviewId: id, rightStageKind: "file" as const } : {}),
      filePreviewTabs: tabs.some((tab) => tab.id === id)
        ? tabs.map((tab) => tab.id === id ? next : tab)
        : [...tabs, next],
    });
    return true;
  }

  /** 从右侧文件树或路径引用直接打开项目内只读源码文件。 */
  openWorkspaceFile(
    projectId: string,
    filePath: string,
    relativePath?: string,
    targetLine?: number,
    endLine?: number,
    worktreeId?: string,
  ): void {
    const normalized = filePath.replace(/\\/gu, "/");
    const id = /^(?:[a-z]:\/|\/\/)/iu.test(normalized) ? normalized.toLowerCase() : normalized;
    const state = this.port.getState();
    const existing = state.filePreviewTabs.find((tab) => tab.id === id);
    const next = {
      ...(existing ?? {}),
      id,
      path: filePath,
      relativePath: (relativePath ?? existing?.relativePath ?? filePath).replace(/\\/gu, "/"),
      projectId,
      ...(worktreeId ? { worktreeId } : {}),
      ...(targetLine !== undefined ? { targetLine, endLine: endLine ?? targetLine } : {}),
    };
    const tabs = state.filePreviewTabs;
    this.port.patchState({
      activeFilePreviewId: id,
      rightStageKind: "file",
      filePreviewTabs: tabs.some((tab) => tab.id === id)
        ? tabs.map((tab) => tab.id === id ? next : tab)
        : [...tabs, next],
    });
  }

  selectFilePreview(id: string): void {
    if (this.port.getState().filePreviewTabs.some((tab) => tab.id === id)) {
      this.port.patchState({ activeFilePreviewId: id, rightStageKind: "file" });
    }
  }

  setRightStageKind(kind: "file" | "browser" | "review" | "subagent" | null): void {
    if (this.port.getState().rightStageKind === kind) return;
    this.port.patchState({ rightStageKind: kind });
  }

  enqueueComposerInsert(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.port.patchState({
      pendingComposerInsert: { text: trimmed, nonce: Date.now() },
    });
  }

  consumeComposerInsert(): void {
    if (!this.port.getState().pendingComposerInsert) return;
    this.port.patchState({ pendingComposerInsert: null });
  }

  private requestNonce = 0;

  requestRightPanel(
    tab: string,
    url?: string,
    options?: { devtoolsTab?: "console" | "network"; autoExpand?: boolean; refreshBrowser?: boolean; subagentRole?: string },
  ): void {
    const stageKind = tab === "browser" ? "browser" : tab === "file-preview" ? "file"
      : tab === "review" ? "review" : tab === "subagent" ? "subagent" : this.port.getState().rightStageKind ?? null;
    this.requestNonce += 1;
    this.port.patchState({
      rightStageKind: stageKind,
      rightPanelRequest: {
        tab,
        ...(url ? { url } : {}),
        ...(options?.subagentRole ? { subagentRole: options.subagentRole } : {}),
        ...(options?.devtoolsTab ? { devtoolsTab: options.devtoolsTab } : {}),
        ...(options?.autoExpand ? { autoExpand: true } : {}),
        ...(options?.refreshBrowser ? { refreshBrowser: true } : {}),
        nonce: Date.now() * 1000 + (this.requestNonce % 1000),
      },
    });
  }

  closeFilePreview(id: string): void {
    const state = this.port.getState();
    const index = state.filePreviewTabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const remaining = state.filePreviewTabs.filter((tab) => tab.id !== id);
    const nextActiveId = state.activeFilePreviewId === id
      ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? null)
      : state.activeFilePreviewId;
    this.port.patchState({
      filePreviewTabs: remaining,
      activeFilePreviewId: nextActiveId,
      ...(state.rightStageKind === "file" && !nextActiveId ? { rightStageKind: null } : {}),
    });
  }

  readProjectFile(projectId: string, filePath: string, signal: AbortSignal, worktreeId?: string) {
    const query = new URLSearchParams({ path: filePath });
    const url = worktreeId
      ? `/api/worktrees/${encodeURIComponent(worktreeId)}/file?${query}`
      : `/api/workspace/projects/${encodeURIComponent(projectId)}/file?${query}`;
    return fetchJson<{ path: string; relativePath: string; content: string; truncated: boolean; size: number }>(
      url,
      { signal },
    );
  }

  readFileActivity(sessionId: string, messageId: string, stepId: string, signal: AbortSignal) {
    const query = new URLSearchParams({ messageId, stepId });
    return fetchJson<{ content: string; truncated: boolean }>(
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/file-activity?${query}`, { signal },
    );
  }
}