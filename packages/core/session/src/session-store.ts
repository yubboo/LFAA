// 管理本地短期会话记忆文件（~/.lfaa/sessions/*.json）与上下文窗口摘要裁剪。
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { collectHistoryDigest, formatHistoryDigest } from "./session-digest";
import { generateConciseSessionTitle } from "@lfaa/session-title";
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
    ...(session.unread ? { unread: true } : {}),
    messageCount: session.messages.length,
    ...(session.summary ? { summary: session.summary } : {}),
    ...(session.sessionPreset ? { sessionPreset: session.sessionPreset } : {}),
    ...(session.sessionModules ? { sessionModules: session.sessionModules } : {}),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function isSafeSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{4,80}$/u.test(sessionId);
}

/** 管理磁盘上的会话记录和列表索引，向 Chat Host 提供统一的增删改读。 */
export class SessionMemoryStore {
  constructor(private sessionsDir: string) {}

  setSessionsDir(nextDir: string): void {
    this.sessionsDir = nextDir;
  }

  getSessionsDir(): string {
    return this.sessionsDir;
  }

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
        ...(parsed.unread === true ? { unread: true } : {}),
        messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
        ...(typeof parsed.summary === "string" && parsed.summary ? { summary: parsed.summary } : {}),
        ...(typeof parsed.sessionPreset === "string" && parsed.sessionPreset ? { sessionPreset: parsed.sessionPreset } : {}),
        ...(Array.isArray(parsed.sessionModules) ? { sessionModules: parsed.sessionModules.filter((module) => typeof module === "string") } : {}),
        ...(typeof parsed.contextSummary === "string" && parsed.contextSummary
          ? { contextSummary: parsed.contextSummary }
          : {}),
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
    const targetPath = this.sessionFile(normalized.id);
    const tempPath = `${targetPath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(normalized, null, 2), "utf8");
    await rename(tempPath, targetPath);
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
      ...(input.sessionPreset ? { sessionPreset: input.sessionPreset } : {}),
      ...(input.sessionModules ? { sessionModules: input.sessionModules } : {}),
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
    if ((patch.sessionPreset !== undefined || patch.sessionModules !== undefined) && existing.messages.length > 0) {
      throw new Error("会话模式已锁定，请新建会话选择其他模式。");
    }
    const updated: ChatSessionRecord = {
      ...existing,
      ...(patch.sessionPreset !== undefined ? { sessionPreset: patch.sessionPreset } : {}),
      ...(patch.sessionModules !== undefined ? { sessionModules: patch.sessionModules } : {}),
      ...(patch.title !== undefined ? { title: patch.title.trim() || existing.title } : {}),
      ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
      ...(patch.sectionId !== undefined ? { sectionId: patch.sectionId } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
      ...(patch.unread !== undefined ? { unread: patch.unread } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.contextSummary !== undefined ? { contextSummary: patch.contextSummary } : {}),
      updatedAt: Date.now(),
    };
    await this.writeSession(updated);
    return updated;
  }

  // 分叉当前会话：复制全部历史消息生成独立的新分支会话。
  async fork(sessionId: string): Promise<ChatSessionRecord | null> {
    const existing = await this.get(sessionId);
    if (!existing) return null;
    const now = Date.now();
    const forked: ChatSessionRecord = {
      id: randomUUID(),
      title: `${existing.title} (分支)`,
      projectId: existing.projectId,
      sectionId: existing.sectionId,
      ...(existing.sessionPreset ? { sessionPreset: existing.sessionPreset } : {}),
      ...(existing.sessionModules ? { sessionModules: existing.sessionModules } : {}),
      pinned: false,
      archived: false,
      messageCount: existing.messages.length,
      ...(existing.summary ? { summary: existing.summary } : {}),
      ...(existing.contextSummary ? { contextSummary: existing.contextSummary } : {}),
      createdAt: now,
      updatedAt: now,
      messages: existing.messages.map((m) => ({ ...m })),
    };
    await this.writeSession(forked);
    return forked;
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      await rm(this.sessionFile(sessionId), { force: false });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 结算应用退出时遗留的流式消息：把无活跃运行的 streaming 助手消息改为 aborted，
   * 保留中断前的内容与步骤，并清理写入中断产生的临时文件。
   */
  async reconcileInterruptedRuns(): Promise<{ sessions: number; messages: number; tmpRemoved: number }> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.sessionsDir);
    } catch {
      return { sessions: 0, messages: 0, tmpRemoved: 0 };
    }

    let sessionsChanged = 0;
    let messagesChanged = 0;
    let tmpRemoved = 0;
    for (const entry of entries) {
      const fullPath = join(this.sessionsDir, entry);
      if (entry.endsWith(".tmp")) {
        const removed = await rm(fullPath, { force: true }).then(() => true).catch(() => false);
        if (removed) tmpRemoved += 1;
        continue;
      }
      if (!entry.endsWith(".json")) continue;
      const session = await this.readSessionFile(fullPath);
      if (!session) continue;
      let changed = false;
      const messages = session.messages.map((message) => {
        if (message.role !== "assistant" || message.status !== "streaming") return message;
        changed = true;
        messagesChanged += 1;
        const steps = (message.steps ?? []).map((step) =>
          step.status === "preparing" || step.status === "running" || step.status === "waiting_approval"
            ? { ...step, status: "error" as const, detail: step.detail ?? "应用退出导致运行中断。", timestamp: Date.now() }
            : step,
        );
        const lastIteration = steps.reduce((max, step) => Math.max(max, step.iteration), 0);
        steps.push({
          id: `interrupted-${message.id}`,
          iteration: lastIteration + 1,
          phase: "check",
          status: "error",
          title: "运行在应用退出时中断",
          detail: "已保留中断前产生的内容与步骤，可直接继续提问。",
          timestamp: Date.now(),
        });
        return {
          ...message,
          status: "aborted" as const,
          content: message.content.trim() ? message.content : "（上次运行在应用退出时被中断，可继续发送指令。）",
          steps,
        };
      });
      if (!changed) continue;
      await this.writeSession({ ...session, messages, messageCount: messages.length });
      sessionsChanged += 1;
    }
    return { sessions: sessionsChanged, messages: messagesChanged, tmpRemoved };
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
      ? generateConciseSessionTitle(message.content)
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
    // 过滤未完成流式占位或空内容的助手占位消息，避免作为历史上下文回传模型触发协议错误
    const eligibleMessages = session.messages.filter(
      (msg) => msg.status !== "streaming" && !(msg.role === "assistant" && !msg.content.trim()),
    );
    const tail = eligibleMessages.slice(-maxRecent);
    const selected: ChatMessageRecord[] = [];
    let totalChars = 0;

    for (let i = tail.length - 1; i >= 0; i -= 1) {
      const msg = tail[i]!;
      const len = msg.content.length;
      if (selected.length > 0 && totalChars + len > maxChars) break;
      totalChars += len;
      selected.unshift(msg);
    }

    const omittedCount = eligibleMessages.length - selected.length;
    if (omittedCount <= 0) {
      return { recentMessages: selected };
    }

    const omittedMessages = eligibleMessages.slice(0, omittedCount);
    const archivedTopics = omittedMessages
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content.trim().slice(0, 60))
      .filter(Boolean);
    // 除关注点外补一行真实工具轨迹，让模型知道哪些文件已改、哪些命令已跑，避免每轮重新探索。
    const historyDigest = formatHistoryDigest(collectHistoryDigest(omittedMessages));
    const summaryNote = session.contextSummary
      || `较早已有 ${omittedCount} 条历史消息；近期关注点：${archivedTopics.join(" / ") || "前序上下文"}${historyDigest ? `\n前序工具轨迹：${historyDigest}` : ""}`;

    return { summaryNote, recentMessages: selected };
  }
}
