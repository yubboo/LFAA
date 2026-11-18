// 管理本地短期会话记忆文件（~/.lfaa/sessions/*.json）与上下文窗口摘要裁剪。
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ChatMessageRecord,
  ChatSessionRecord,
  ChatSessionSummary,
  CreateSessionInput,
  UpdateSessionInput,
} from "./types";

function toSummary(session: ChatSessionRecord): ChatSessionSummary {
  return {
    id: session.id,
    title: session.title,
    projectId: session.projectId,
    sectionId: session.sectionId,
    pinned: session.pinned,
    archived: session.archived,
    messageCount: session.messages.length,
    ...(session.summary ? { summary: session.summary } : {}),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function isSafeSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{4,80}$/u.test(sessionId);
}

export class SessionMemoryStore {
  constructor(private readonly sessionsDir: string) {}

  private sessionFile(sessionId: string): string {
    if (!isSafeSessionId(sessionId)) {
      throw new Error("无效的会话 ID 格式。");
    }
    return join(this.sessionsDir, `${sessionId}.json`);
  }

  private async readSessionFile(filePath: string): Promise<ChatSessionRecord | null> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ChatSessionRecord>;
      if (!parsed || typeof parsed.id !== "string" || typeof parsed.title !== "string") return null;
      return {
        id: parsed.id,
        title: parsed.title,
        projectId: typeof parsed.projectId === "string" ? parsed.projectId : null,
        sectionId: typeof parsed.sectionId === "string" ? parsed.sectionId : null,
        pinned: parsed.pinned === true,
        archived: parsed.archived === true,
        messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
        ...(typeof parsed.summary === "string" && parsed.summary ? { summary: parsed.summary } : {}),
        createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
    } catch {
      return null;
    }
  }

  private async writeSession(session: ChatSessionRecord): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
    const normalized: ChatSessionRecord = {
      ...session,
      messageCount: session.messages.length,
    };
    await writeFile(this.sessionFile(normalized.id), JSON.stringify(normalized, null, 2), "utf8");
  }

  async list(options: { includeArchived?: boolean; projectId?: string | null } = {}): Promise<ChatSessionSummary[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.sessionsDir);
    } catch {
      return [];
    }

    const sessions: ChatSessionSummary[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const loaded = await this.readSessionFile(join(this.sessionsDir, entry));
      if (!loaded) continue;
      if (!options.includeArchived && loaded.archived) continue;
      if (options.projectId !== undefined && loaded.projectId !== options.projectId) continue;
      sessions.push(toSummary(loaded));
    }

    return sessions.sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return right.updatedAt - left.updatedAt;
    });
  }

  async get(sessionId: string): Promise<ChatSessionRecord | null> {
    return this.readSessionFile(this.sessionFile(sessionId));
  }

  async create(input: CreateSessionInput = {}): Promise<ChatSessionRecord> {
    const now = Date.now();
    const record: ChatSessionRecord = {
      id: randomUUID(),
      title: input.title?.trim() || "新聊天",
      projectId: input.projectId ?? null,
      sectionId: input.sectionId ?? null,
      pinned: false,
      archived: false,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    await this.writeSession(record);
    return record;
  }

  async update(sessionId: string, patch: UpdateSessionInput): Promise<ChatSessionRecord | null> {
    const existing = await this.get(sessionId);
    if (!existing) return null;
    const updated: ChatSessionRecord = {
      ...existing,
      ...(patch.title !== undefined ? { title: patch.title.trim() || existing.title } : {}),
      ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
      ...(patch.sectionId !== undefined ? { sectionId: patch.sectionId } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      updatedAt: Date.now(),
    };
    await this.writeSession(updated);
    return updated;
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      await rm(this.sessionFile(sessionId), { force: false });
      return true;
    } catch {
      return false;
    }
  }

  async appendMessage(sessionId: string, message: ChatMessageRecord): Promise<ChatSessionRecord> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`找不到会话：${sessionId}`);
    }
    const nextMessages = [...session.messages, message];
    const shouldAutoTitle =
      session.messages.length === 0 && session.title === "新聊天" && message.role === "user" && message.content.trim();
    const nextTitle = shouldAutoTitle
      ? message.content.trim().replace(/\s+/gu, " ").slice(0, 32)
      : session.title;
    const next: ChatSessionRecord = {
      ...session,
      title: nextTitle,
      messages: nextMessages,
      messageCount: nextMessages.length,
      updatedAt: Date.now(),
    };
    await this.writeSession(next);
    return next;
  }

  async updateMessage(
    sessionId: string,
    messageId: string,
    patch: Partial<ChatMessageRecord>,
  ): Promise<ChatSessionRecord> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`找不到会话：${sessionId}`);
    }
    const messages = session.messages.map((item) =>
      item.id === messageId ? { ...item, ...patch } : item,
    );
    const next: ChatSessionRecord = {
      ...session,
      messages,
      updatedAt: Date.now(),
    };
    await this.writeSession(next);
    return next;
  }

  // 构建受上下文字符预算约束的短期对话历史，并在历史过长时自动保留摘要提示。
  async buildContextMessages(
    sessionId: string,
    options: { maxRecentMessages?: number; maxChars?: number } = {},
  ): Promise<{ summaryNote?: string; recentMessages: ChatMessageRecord[] }> {
    const session = await this.get(sessionId);
    if (!session) return { recentMessages: [] };

    const maxRecent = options.maxRecentMessages ?? 16;
    const maxChars = options.maxChars ?? 16000;
    const tail = session.messages.slice(-maxRecent);
    const selected: ChatMessageRecord[] = [];
    let totalChars = 0;

    for (let i = tail.length - 1; i >= 0; i -= 1) {
      const msg = tail[i]!;
      const len = msg.content.length;
      if (selected.length > 0 && totalChars + len > maxChars) break;
      totalChars += len;
      selected.unshift(msg);
    }

    const omittedCount = session.messages.length - selected.length;
    if (omittedCount <= 0) {
      return { recentMessages: selected };
    }

    const archivedTopics = session.messages
      .slice(0, omittedCount)
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content.trim().slice(0, 60))
      .filter(Boolean);
    const summaryNote = session.summary
      || `较早已有 ${omittedCount} 条历史消息；近期关注点：${archivedTopics.join(" / ") || "前序上下文"}`;

    return { summaryNote, recentMessages: selected };
  }
}
