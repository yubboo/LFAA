// 管理本地短期会话记忆文件（~/.lfaa/sessions/*.json）与上下文窗口摘要裁剪。
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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
    ...(session.unread ? { unread: true } : {}),
    messageCount: session.messages.length,
    ...(session.summary ? { summary: session.summary } : {}),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

const FILLER_PREFIX_RE =
  /^(?:你好[，,！!。.\s]*|您好[，,！!。.\s]*|请问[，,\s]*|请只[：:\s]*|请(?:你|帮我|帮忙)?(?:不要调用工具[，,\s]*)?(?:直接)?(?:用\s*\d+\s*[句话个自然段条项]+[，,\s]*)?(?:简短|详细)?(?:介绍一下|介绍|输出一个|输出|生成一个|生成|写一个|写|解释|分析|总结|对比|帮我|告诉我|回答)[：:\s]*|帮我(?:看看|检查|修复|优化|实现|写)[：:\s]*|hi[,\s]+|hello[,\s]+|please[,\s]+|can you[,\s]+|could you[,\s]+|help me[,\s]+)/iu;

/** 根据用户首条提问提炼简洁语义标题（去除客套与指令前缀，避免整段原句直接截断） */
export function generateConciseSessionTitle(rawContent: string): string {
  const firstLine = rawContent
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/[#>*_`]/gu, "")
    .trim()
    .split(/\r?\n/u)[0] ?? "";
  let text = firstLine.replace(/\s+/gu, " ").trim();
  for (let i = 0; i < 4; i += 1) {
    const stripped = text.replace(FILLER_PREFIX_RE, "").trim();
    if (stripped === text || !stripped) break;
    text = stripped;
  }
  const primaryClause = text.split(/[。！？；;\n]|，不要|，并且|，然后/u)[0]?.trim() || text;
  const cleaned = primaryClause.replace(/^[，,：:\s]+|[，,。.！!？?：:;；\s]+$/gu, "");
  const fallback = firstLine.replace(/\s+/gu, " ").trim();
  const base = cleaned || fallback || "新聊天";
  const cjkCount = (base.match(/[\u4e00-\u9fff]/gu) ?? []).length;
  const maxLen = cjkCount >= 3 ? 16 : 24;
  return base.length > maxLen ? base.slice(0, maxLen).trim() : base;
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
      ...(patch.unread !== undefined ? { unread: patch.unread } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
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
      pinned: false,
      archived: false,
      messageCount: existing.messages.length,
      ...(existing.summary ? { summary: existing.summary } : {}),
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

    const archivedTopics = eligibleMessages
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
