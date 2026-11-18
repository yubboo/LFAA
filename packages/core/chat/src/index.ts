// @lfaa/chat Host 侧 Cordis 服务：基于 @lfaa/memory 暴露聊天会话 CRUD 与项目维度聊天统计。
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/memory";
import type {
  ChatSessionRecord,
  ChatSessionSummary,
  CreateSessionInput,
  UpdateSessionInput,
} from "@lfaa/memory";

export { createChatHttpHandler } from "./http-handler";
export type {
  AgentLoopPhase,
  AgentStepStatus,
  AgentStepTrace,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatSessionSummary,
} from "@lfaa/memory";

export class ChatService extends Service {
  static inject = ["memory"];

  constructor(ctx: Context) {
    super(ctx, "chat");
  }

  listSessions(options?: { includeArchived?: boolean; projectId?: string | null }): Promise<ChatSessionSummary[]> {
    return this.ctx.memory.listSessions(options);
  }

  countByProject(includeArchived = false): Promise<Record<string, number>> {
    return this.ctx.memory.countSessionsByProject(includeArchived);
  }

  getSession(sessionId: string): Promise<ChatSessionRecord | null> {
    return this.ctx.memory.getSession(sessionId);
  }

  createSession(input?: CreateSessionInput): Promise<ChatSessionRecord> {
    return this.ctx.memory.createSession(input);
  }

  updateSession(sessionId: string, patch: UpdateSessionInput): Promise<ChatSessionRecord | null> {
    return this.ctx.memory.updateSession(sessionId, patch);
  }

  deleteSession(sessionId: string): Promise<boolean> {
    return this.ctx.memory.deleteSession(sessionId);
  }
}

export function chatPlugin(context: Context): void {
  new ChatService(context);
}

chatPlugin.inject = ["memory"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    chat: ChatService;
  }
}
