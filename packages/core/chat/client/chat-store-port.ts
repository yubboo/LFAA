// 聊天 Store 内部端口：核心壳向各动作模块暴露的最小状态与跨模块操作，避免模块互相直接依赖实现。
import type { AgentPermissionMode, ChatSessionDetail, ChatStoreSnapshot } from "./chat-types";

export interface ChatSessionMetaPatch {
  title?: string;
  projectId?: string | null;
  sectionId?: string | null;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
}

export interface ChatStorePort {
  getState(): ChatStoreSnapshot;
  patchState(patch: Partial<ChatStoreSnapshot>): void;
  refreshMeta(projectPath?: string): Promise<void>;
  trackLeavingActiveRun(nextSessionId: string | null): void;
  scheduleBackgroundRunPoll(): void;
  resumeRun(sessionId: string): Promise<void>;
  openSession(sessionId: string): Promise<void>;
  updateSessionMeta(sessionId: string, patch: ChatSessionMetaPatch): Promise<ChatSessionDetail | null>;
  startNewChatDraft(options?: { projectId?: string | null; sectionId?: string | null }): void;
  sendMessage(text: string, skillIds?: string[]): Promise<void>;
}

/** 供运行模块写权限时复用。 */
export type { AgentPermissionMode };