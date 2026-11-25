// 管理本地短期会话记忆文件（~/.lfaa/sessions/*.json）与上下文窗口摘要裁剪。
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { collectHistoryDigest, formatHistoryDigest } from "./session-digest";
import { readGroupConfig, readPendingQuestionValue } from "./session-normalize";
import { normalizeTodoList } from "./todos";
import { generateConciseSessionTitle } from "@lfaa/session-title";
import type {
  ChatMessageRecord,
  ChatSessionRecord,
  ChatSessionSummary,
  CreateSessionInput,
  SessionWorktree,
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
    ...(session.worktree ? { worktree: session.worktree } : {}),
    ...(session.unread ? { unread: true } : {}),
    ...(session.muted ? { muted: true } : {}),
    messageCount: session.messages.length,
    ...(session.summary ? { summary: session.summary } : {}),
    ...(session.sessionPreset ? { sessionPreset: session.sessionPreset } : {}),
    ...(session.sessionModules ? { sessionModules: session.sessionModules } : {}),
    ...(session.agentId ? { agentId: session.agentId } : {}),
    ...(session.bindingOverrideId ? { bindingOverrideId: session.bindingOverrideId } : {}),
    ...(session.kind ? { kind: session.kind } : {}),
    ...(session.group ? { group: session.group } : {}),
    ...(session.pendingQuestion ? { pendingQuestion: session.pendingQuestion } : {}),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function isSafeSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{4,80}$/u.test(sessionId);
}


/** 读取绑定工作树快照；字段不完整时视为未绑定，避免坏数据进入运行目录解析。 */
function readWorktree(value: unknown): SessionWorktree | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<SessionWorktree>;
  for (const field of ["id", "projectId", "path", "branch", "repositoryRoot"] as const) {
    if (typeof raw[field] !== "string" || !raw[field]?.trim()) return undefined;
  }
  return {
    id: raw.id!,
    projectId: raw.projectId!,
    path: raw.path!,
    branch: raw.branch!,
    repositoryRoot: raw.repositoryRoot!,
  };
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
      const pendingQuestion = readPendingQuestionValue(parsed.pendingQuestion);
      const worktree = readWorktree(parsed.worktree);
      return {
        id: parsed.id,
        title: parsed.title,
        projectId: typeof parsed.projectId === "string" ? parsed.projectId : null,
        sectionId: typeof parsed.sectionId === "string" ? parsed.sectionId : null,
        pinned: parsed.pinned === true,
        archived: parsed.archived === true,
        ...(worktree ? { worktree } : {}),
        ...(parsed.unread === true ? { unread: true } : {}),
        ...(parsed.muted === true ? { muted: true } : {}),
        messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
        ...(typeof parsed.summary === "string" && parsed.summary ? { summary: parsed.summary } : {}),
        ...(typeof parsed.sessionPreset === "string" && parsed.sessionPreset ? { sessionPreset: parsed.sessionPreset } : {}),
        ...(Array.isArray(parsed.sessionModules) ? { sessionModules: parsed.sessionModules.filter((module) => typeof module === "string") } : {}),
        ...(typeof parsed.agentId === "string" && parsed.agentId.trim() ? { agentId: parsed.agentId.trim() } : {}),
        ...(typeof parsed.bindingOverrideId === "string" && parsed.bindingOverrideId.trim()
          ? { bindingOverrideId: parsed.bindingOverrideId.trim() }
          : {}),
        ...(parsed.kind === "group" ? { kind: "group" as const } : {}),
        ...(readGroupConfig(parsed.group) ? { group: readGroupConfig(parsed.group)! } : {}),
        ...(pendingQuestion ? { pendingQuestion } : {}),
        ...(typeof parsed.contextSummary === "string" && parsed.contextSummary
          ? { contextSummary: parsed.contextSummary }
          : {}),
        ...(Array.isArray(parsed.todos) ? { todos: normalizeTodoList(parsed.todos) ?? [] } : {}),
        createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
    } catch {
      return null;
    }
  }

  private readonly writeQueues = new Map<string, Promise<void>>();
  /** 按文件 mtimeMs + size 缓存会话摘要，避免每次 list() / attention 轮询重复全盘 JSON.parse。 */
  private readonly summaryCache = new Map<string, { mtimeMs: number; size: number; summary: ChatSessionSummary }>();

  /** 同一会话的写入串行化：中止运行与立即发消息会同时落盘，并发 rename 在 Windows 上会 EPERM；队列结束后清理映射防泄漏。 */
  private serializeWrite<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.writeQueues.get(sessionId) ?? Promise.resolve();
    const next = previous.then(task, task);
    const tail = next.then(() => undefined, () => undefined);
    this.writeQueues.set(sessionId, tail);
    void tail.finally(() => {
      if (this.writeQueues.get(sessionId) === tail) this.writeQueues.delete(sessionId);
    });
    return next;
  }

  private async writeSession(session: ChatSessionRecord): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
    const normalized: ChatSessionRecord = {
      ...session,
      messageCount: session.messages.length,
    };
    const targetPath = this.sessionFile(normalized.id);
    const payload = JSON.stringify(normalized, null, 2);
    await this.serializeWrite(normalized.id, async () => {
      // 临时文件 + rename 保证原子性；失败立即清理残留 .tmp，Windows 短时占用时重试，最后回退直接覆盖。
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const tempPath = `${targetPath}.${randomUUID()}.tmp`;
        await writeFile(tempPath, payload, "utf8");
        try {
          await rename(tempPath, targetPath);
          return;
        } catch (error) {
          await rm(tempPath, { force: true }).catch(() => {});
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw error;
          await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
        }
      }
      await writeFile(targetPath, payload, "utf8");
    });
  }

  async list(options: { includeArchived?: boolean; projectId?: string | null } = {}): Promise<ChatSessionSummary[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.sessionsDir);
    } catch {
      return [];
    }

    const seenFiles = new Set<string>();
    const sessions: ChatSessionSummary[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      seenFiles.add(entry);
      const fullPath = join(this.sessionsDir, entry);
      const info = await stat(fullPath).catch(() => null);
      if (!info) continue;
      const cached = this.summaryCache.get(entry);
      let summary: ChatSessionSummary | null = null;
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
        summary = cached.summary;
      } else {
        const loaded = await this.readSessionFile(fullPath);
        if (!loaded) continue;
        summary = toSummary(loaded);
        this.summaryCache.set(entry, { mtimeMs: info.mtimeMs, size: info.size, summary });
      }
      if (!options.includeArchived && summary.archived) continue;
      if (options.projectId !== undefined && summary.projectId !== options.projectId) continue;
      sessions.push(summary);
    }
    for (const key of this.summaryCache.keys()) {
      if (!seenFiles.has(key)) this.summaryCache.delete(key);
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
    const projectId = input.projectId ?? null;
    if (input.worktree && input.worktree.projectId !== projectId) {
      throw new Error("工作树不属于当前项目，无法绑定会话。");
    }
    const record: ChatSessionRecord = {
      id: randomUUID(),
      title: input.title?.trim() || "新聊天",
      projectId,
      sectionId: input.sectionId ?? null,
      ...(input.sessionPreset ? { sessionPreset: input.sessionPreset } : {}),
      ...(input.sessionModules ? { sessionModules: input.sessionModules } : {}),
      ...(input.agentId ? { agentId: input.agentId } : {}),
      ...(input.bindingOverrideId ? { bindingOverrideId: input.bindingOverrideId } : {}),
      ...(input.kind === "group" && readGroupConfig(input.group) ? { kind: "group" as const, group: readGroupConfig(input.group)! } : {}),
      ...(input.worktree ? { worktree: input.worktree } : {}),
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
      ...(patch.agentId ? { agentId: patch.agentId } : {}),
      ...(patch.bindingOverrideId ? { bindingOverrideId: patch.bindingOverrideId } : {}),
      ...(patch.unread !== undefined ? { unread: patch.unread } : {}),
      ...(patch.muted !== undefined ? { muted: patch.muted } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.contextSummary !== undefined ? { contextSummary: patch.contextSummary } : {}),
      ...(patch.todos !== undefined ? { todos: patch.todos } : {}),
      updatedAt: Date.now(),
    };
    if (patch.pendingQuestion === null) {
      delete updated.pendingQuestion;
    } else if (patch.pendingQuestion !== undefined) {
      updated.pendingQuestion = { ...patch.pendingQuestion, options: [...patch.pendingQuestion.options] };
    }
    // 传 null 表示解绑：字段真正删掉，避免留空串让运行期误判「指定了一个空 agent」。
    if (patch.agentId === null) delete updated.agentId;
    if (patch.bindingOverrideId === null) delete updated.bindingOverrideId;
    if (patch.kind !== undefined) {
      const group = patch.group !== undefined ? readGroupConfig(patch.group) : updated.group;
      if (patch.kind === "group" && group) {
        updated.kind = "group";
        updated.group = group;
      } else {
        delete updated.kind;
        delete updated.group;
      }
    } else if (patch.group !== undefined) {
      const group = readGroupConfig(patch.group);
      if (group) {
        updated.kind = "group";
        updated.group = group;
      } else {
        delete updated.kind;
        delete updated.group;
      }
    }
    const nextProjectId = patch.projectId !== undefined ? patch.projectId : existing.projectId;
    if (patch.worktree === null) {
      delete updated.worktree;
    } else if (patch.worktree !== undefined) {
      if (patch.worktree.projectId !== nextProjectId) {
        throw new Error("工作树不属于会话绑定的项目，无法绑定。");
      }
      updated.worktree = { ...patch.worktree };
    } else if (patch.projectId !== undefined && existing.worktree && existing.worktree.projectId !== nextProjectId) {
      throw new Error("该会话绑定了工作树，请先解绑工作树再更换项目。");
    }
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
      ...(existing.agentId ? { agentId: existing.agentId } : {}),
      ...(existing.bindingOverrideId ? { bindingOverrideId: existing.bindingOverrideId } : {}),
      ...(existing.kind ? { kind: existing.kind } : {}),
      ...(existing.group ? { group: existing.group } : {}),
      ...(existing.worktree ? { worktree: { ...existing.worktree } } : {}),
      pinned: false,
      archived: false,
      messageCount: existing.messages.length,
      ...(existing.summary ? { summary: existing.summary } : {}),
      ...(existing.contextSummary ? { contextSummary: existing.contextSummary } : {}),
      ...(existing.todos?.length ? { todos: existing.todos.map((todo) => ({ ...todo })) } : {}),
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
      this.summaryCache.delete(`${sessionId}.json`);
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