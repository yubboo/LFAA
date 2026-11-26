// 聊天区状态切片：只挑中央会话区真正用到的字段，会话列表、提醒、规则等变化不再带动整块聊天区重渲染。
// 单独成文件是为了让 ChatWorkspace 只保留装配逻辑，切片字段与订阅口径在一处维护。
import type { ChatStoreSnapshot } from "../store/chat-types";

/** 中央聊天区的订阅切片；`activeSession` 仍会随流式增量变化，正文必须重绘。 */
export function selectWorkspaceSlice(s: ChatStoreSnapshot) {
  return {
    activeSession: s.activeSession,
    activeSessionId: s.activeSessionId,
    loaded: s.loaded,
    draftProjectId: s.draftProjectId,
    draftWorktree: s.draftWorktree,
    submittingMessage: s.submittingMessage,
    runningRunId: s.runningRunId,
    filePreviewTabs: s.filePreviewTabs,
    activeFilePreviewId: s.activeFilePreviewId,
    profiles: s.profiles,
    activeProfileId: s.activeProfileId,
    // 输入栏的 @ 提及、外部插入与排队消息都由这几项驱动，缺一会让输入框在挂载时报错。
    sessions: s.sessions,
    pendingComposerInsert: s.pendingComposerInsert,
    queuedMessages: s.queuedMessages,
    permissionMode: s.permissionMode,
    reasoningLevel: s.reasoningLevel,
    memoriesCount: s.memories.length,
    generalSettings: s.generalSettings,
    pendingApproval: s.pendingApproval,
    pendingMessageJump: s.pendingMessageJump,
    handoffs: s.handoffs,
    activeGoal: s.activeGoal,
    streamStatusNotice: s.streamStatusNotice,
    degradedStream: s.degradedStream,
    errorMessage: s.errorMessage,
    workspaceConflict: s.workspaceConflict,
  };
}

/** 切片类型，供组件内部标注使用。 */
export type WorkspaceSlice = ReturnType<typeof selectWorkspaceSlice>;