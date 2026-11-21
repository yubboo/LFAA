// 聊天 Store 内部端口：核心壳向各动作模块暴露的最小状态与跨模块操作，避免模块互相直接依赖实现。
import type { AgentPermissionMode, ChatSessionDetail, ChatStoreSnapshot } from "./chat-types";

export interface ChatSessionMetaPatch {
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  muted?: boolean;
}

export interface ChatStorePort {
  getState(): ChatStoreSnapshot;
  patchState(patch: Partial<ChatStoreSnapshot>): void;
  refreshMeta(projectPath?: string): Promise<void>;
  trackLeavingActiveRun(nextSessionId: string | null): void;
  scheduleBackgroundRunPoll(): void;
  /** 标记会话的运行状态，用于左二栏工作转圈（开始/结束都立即反映）。 */
  markSessionRunning(sessionId: string, running: boolean): void;
  /** 用户已回应/已处理后撤掉会话的待确认/待回答徽标。 */
  markAttentionResolved(sessionId: string): void;
  /** 由 SSE 收尾触发轮次完成提醒；内部与轮询兜底去重。 */
  notifyRunFinished(sessionId: string): void;
  resumeRun(sessionId: string): Promise<void>;
  openSession(sessionId: string): Promise<void>;
  updateSessionMeta(sessionId: string, patch: ChatSessionMetaPatch): Promise<ChatSessionDetail | null>;
  startNewChatDraft(options?: { projectId?: string | null; sectionId?: string | null }): void;
  sendMessage(text: string, skillIds?: string[]): Promise<void>;
}

/** 供运行模块写权限时复用。 */
export type { AgentPermissionMode };