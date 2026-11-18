// @lfaa/memory Host 侧 Cordis 服务：统一对外提供短期会话记忆与长期事实记忆读写、裁剪及召回。
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { LongTermMemoryStore } from "./longterm-store";
import { SessionMemoryStore } from "./session-store";
import type {
  AddMemoryInput,
  ChatMessageRecord,
  ChatSessionRecord,
  ChatSessionSummary,
  CreateSessionInput,
  MemoryEntry,
  UpdateSessionInput,
} from "./types";

export * from "./types";
export { createMemoryHttpHandler } from "./http-handler";

export interface MemoryPluginConfig {
  sessionsDir?: string;
  memoryFilePath?: string;
}

const DEFAULT_SESSIONS_DIR = join(homedir(), ".lfaa", "sessions");
const DEFAULT_MEMORY_FILE = join(homedir(), ".lfaa", "memory.json");

// Host 侧记忆服务：持久化会话轨迹并在多轮任务循环中召回长期事实。
export class MemoryService extends Service {
  private readonly sessionStore: SessionMemoryStore;
  private readonly longTermStore: LongTermMemoryStore;

  constructor(ctx: Context, config: MemoryPluginConfig = {}) {
    super(ctx, "memory");
    const sessionsDir = config.sessionsDir ? resolve(config.sessionsDir) : DEFAULT_SESSIONS_DIR;
    const memoryFilePath = config.memoryFilePath ? resolve(config.memoryFilePath) : DEFAULT_MEMORY_FILE;
    this.sessionStore = new SessionMemoryStore(sessionsDir);
    this.longTermStore = new LongTermMemoryStore(memoryFilePath);
  }

  listSessions(options?: { includeArchived?: boolean; projectId?: string | null }): Promise<ChatSessionSummary[]> {
    return this.sessionStore.list(options);
  }

  async countSessionsByProject(includeArchived = false): Promise<Record<string, number>> {
    const sessions = await this.sessionStore.list({ includeArchived });
    const counts: Record<string, number> = {};
    for (const item of sessions) {
      if (!item.projectId) continue;
      counts[item.projectId] = (counts[item.projectId] ?? 0) + 1;
    }
    return counts;
  }

  getSession(sessionId: string): Promise<ChatSessionRecord | null> {
    return this.sessionStore.get(sessionId);
  }

  createSession(input?: CreateSessionInput): Promise<ChatSessionRecord> {
    return this.sessionStore.create(input);
  }

  updateSession(sessionId: string, patch: UpdateSessionInput): Promise<ChatSessionRecord | null> {
    return this.sessionStore.update(sessionId, patch);
  }

  deleteSession(sessionId: string): Promise<boolean> {
    return this.sessionStore.delete(sessionId);
  }

  appendMessage(sessionId: string, message: ChatMessageRecord): Promise<ChatSessionRecord> {
    return this.sessionStore.appendMessage(sessionId, message);
  }

  updateMessage(
    sessionId: string,
    messageId: string,
    patch: Partial<ChatMessageRecord>,
  ): Promise<ChatSessionRecord> {
    return this.sessionStore.updateMessage(sessionId, messageId, patch);
  }

  buildContextMessages(
    sessionId: string,
    options?: { maxRecentMessages?: number; maxChars?: number },
  ): Promise<{ summaryNote?: string; recentMessages: ChatMessageRecord[] }> {
    return this.sessionStore.buildContextMessages(sessionId, options);
  }

  listLongTermMemories(options?: { projectId?: string | null; query?: string }): Promise<MemoryEntry[]> {
    return this.longTermStore.list(options);
  }

  addMemory(input: AddMemoryInput): Promise<MemoryEntry> {
    return this.longTermStore.add(input);
  }

  removeMemory(memoryId: string): Promise<boolean> {
    return this.longTermStore.remove(memoryId);
  }

  recallRelevantMemories(options: { query: string; projectId?: string | null; limit?: number }): Promise<MemoryEntry[]> {
    return this.longTermStore.recall(options);
  }
}

export function memoryPlugin(context: Context, config: MemoryPluginConfig = {}): void {
  new MemoryService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    memory: MemoryService;
  }
}
