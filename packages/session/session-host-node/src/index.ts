/**
 * 文件：packages/session/session-host-node/src/index.ts
 * 作用：在 LFAA_HOME/state/sessions 中持久化统一 Workspace Session。
 * 负责：Session JSON、最近会话索引、active session、原子写入与运行中 Run 恢复收敛。
 * 不负责：HTTP、React、Agent Runtime、Provider 协议。
 * 状态归属：用户本地 Session 长期状态。
 * 对外接口：NodeWorkspaceSessionRepository。
 * 关联文件：@lfaa/session、@lfaa/home-paths、@lfaa/session-controller。
 * 修改注意事项：任何磁盘失败都必须显式抛错；禁止静默丢会话。刷新后发现 running Run 时必须标记为已中断。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveLfaaHomePaths } from "@lfaa/home-paths";
import type {
  CreateWorkspaceSessionInput,
  CreateWorkspaceProjectInput,
  SessionMessageRecord,
  UpdateWorkspaceProjectInput,
  WorkspaceProjectRecord,
  WorkspaceProjectSnapshot,
  WorkspaceSessionHost,
  WorkspaceSessionRecord,
  WorkspaceSessionSnapshot,
  WorkspaceSessionSummary,
} from "@lfaa/session";

interface SessionIndexFile {
  readonly version: 2;
  readonly activeProjectId: string;
  readonly projects: readonly WorkspaceProjectRecord[];
  readonly activeByWorkspace: Readonly<Record<string, string>>;
  readonly sessions: readonly WorkspaceSessionSummary[];
}

const DEFAULT_PROJECT_ID = "lfaa";

function defaultProject(id = DEFAULT_PROJECT_ID): WorkspaceProjectRecord {
  const now = Date.now();
  return { id, name: id === DEFAULT_PROJECT_ID ? "lfaa" : id, pinned: false, expanded: true, createdAt: now, updatedAt: now };
}

function normalizeIndex(parsed: Partial<SessionIndexFile> & { version?: number }, defaultProjectId = DEFAULT_PROJECT_ID): SessionIndexFile {
  const sessions = Array.isArray(parsed.sessions)
    ? parsed.sessions.map((item) => ({ ...item, pinned: Boolean(item.pinned) }))
    : [];
  const inferredIds = [...new Set(sessions.map((item) => item.workspaceId).filter(Boolean))];
  const projects = Array.isArray(parsed.projects) && parsed.projects.length
    ? parsed.projects.map((item) => ({ ...item, pinned: Boolean(item.pinned), expanded: item.expanded !== false }))
    : (inferredIds.length ? inferredIds : [defaultProjectId]).map((id) => defaultProject(id));
  const activeProjectId = typeof parsed.activeProjectId === "string" && projects.some((item) => item.id === parsed.activeProjectId)
    ? parsed.activeProjectId
    : projects[0]!.id;
  return {
    version: 2,
    activeProjectId,
    projects,
    activeByWorkspace: parsed.activeByWorkspace && typeof parsed.activeByWorkspace === "object" ? parsed.activeByWorkspace : {},
    sessions,
  };
}

function sanitizeSession(record: WorkspaceSessionRecord): WorkspaceSessionRecord {
  const now = Date.now();
  const messages: SessionMessageRecord[] = record.messages.map((message) => {
    if (message.role !== "run" || !message.process || message.process.status !== "running") return message;
    return {
      ...message,
      process: {
        ...message.process,
        status: "cancelled",
        label: "上次运行已中断",
        completedAt: message.process.completedAt ?? now,
        activities: message.process.activities.map((activity) => activity.status === "running"
          ? { ...activity, status: "interrupted", completedAt: activity.completedAt ?? now }
          : activity),
      },
    };
  });
  return { ...record, pinned: Boolean(record.pinned), messages: messages.map((message) => message.role === "run" && message.process
    ? { ...message, process: { ...message.process, phases: Array.isArray(message.process.phases) ? message.process.phases : [{ phase: message.process.phase, label: message.process.label, at: message.process.startedAt }] } }
    : message) };
}

function previewFor(record: WorkspaceSessionRecord): string {
  const message = [...record.messages].reverse().find((item) => item.role === "user" || item.role === "assistant");
  return (message?.text ?? "").replace(/\s+/gu, " ").trim().slice(0, 80);
}

function summaryFor(record: WorkspaceSessionRecord): WorkspaceSessionSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    mode: record.mode,
    preview: previewFor(record),
    pinned: record.pinned,
    updatedAt: record.updatedAt,
  };
}

export class NodeWorkspaceSessionRepository implements WorkspaceSessionHost {
  readonly #root: string;
  readonly #indexPath: string;
  #mutation: Promise<void> = Promise.resolve();

  constructor(root = path.join(resolveLfaaHomePaths().state, "sessions")) {
    this.#root = root;
    this.#indexPath = path.join(root, "index.json");
  }

  async #ensure(): Promise<void> { await fs.mkdir(this.#root, { recursive: true }); }

  async #readIndex(defaultProjectId = DEFAULT_PROJECT_ID): Promise<SessionIndexFile> {
    await this.#ensure();
    try {
      const parsed = JSON.parse(await fs.readFile(this.#indexPath, "utf8")) as Partial<SessionIndexFile> & { version?: number };
      return normalizeIndex(parsed, defaultProjectId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return normalizeIndex({}, defaultProjectId);
      throw error;
    }
  }

  async #writeJson(target: string, value: unknown): Promise<void> {
    await this.#ensure();
    const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temp, target);
  }

  #sessionPath(sessionId: string): string {
    if (!/^[A-Za-z0-9-]{8,80}$/u.test(sessionId)) throw new Error("Session ID 无效。");
    return path.join(this.#root, `${sessionId}.json`);
  }

  #mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutation.then(operation, operation);
    this.#mutation = result.then(() => undefined, () => undefined);
    return result;
  }

  #projectSnapshot(index: SessionIndexFile): WorkspaceProjectSnapshot {
    return {
      activeProjectId: index.activeProjectId,
      projects: [...index.projects].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt),
      pinnedSessions: index.sessions.filter((item) => item.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }

  async projects(defaultProjectId = DEFAULT_PROJECT_ID): Promise<WorkspaceProjectSnapshot> {
    const index = await this.#readIndex(defaultProjectId);
    return this.#projectSnapshot(index);
  }

  async createProject(input: CreateWorkspaceProjectInput): Promise<WorkspaceProjectSnapshot> {
    return this.#mutate(async () => {
      const name = input.name.replace(/\s+/gu, " ").trim();
      if (!name) throw new Error("项目名称不能为空。");
      const index = await this.#readIndex();
      const now = Date.now();
      const project: WorkspaceProjectRecord = { id: crypto.randomUUID(), name: name.slice(0, 80), pinned: false, expanded: true, createdAt: now, updatedAt: now };
      const next: SessionIndexFile = { ...index, activeProjectId: project.id, projects: [project, ...index.projects] };
      await this.#writeJson(this.#indexPath, next);
      return this.#projectSnapshot(next);
    });
  }

  async updateProject(projectId: string, input: UpdateWorkspaceProjectInput): Promise<WorkspaceProjectSnapshot> {
    return this.#mutate(async () => {
      const index = await this.#readIndex();
      if (!index.projects.some((item) => item.id === projectId)) throw new Error("项目不存在。");
      const name = input.name === undefined ? undefined : input.name.replace(/\s+/gu, " ").trim();
      if (name !== undefined && !name) throw new Error("项目名称不能为空。");
      const projects = index.projects.map((item) => item.id === projectId ? {
        ...item,
        ...(name !== undefined ? { name: name.slice(0, 80) } : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        ...(input.expanded !== undefined ? { expanded: input.expanded } : {}),
        updatedAt: Date.now(),
      } : item);
      const next: SessionIndexFile = { ...index, projects };
      await this.#writeJson(this.#indexPath, next);
      return this.#projectSnapshot(next);
    });
  }

  async setActiveProject(projectId: string): Promise<WorkspaceProjectSnapshot> {
    return this.#mutate(async () => {
      const index = await this.#readIndex();
      if (!index.projects.some((item) => item.id === projectId)) throw new Error("项目不存在。");
      const next: SessionIndexFile = { ...index, activeProjectId: projectId };
      await this.#writeJson(this.#indexPath, next);
      return this.#projectSnapshot(next);
    });
  }

  async deleteProject(projectId: string): Promise<WorkspaceProjectSnapshot> {
    return this.#mutate(async () => {
      const index = await this.#readIndex();
      if (index.projects.length <= 1) throw new Error("至少保留一个项目。");
      if (!index.projects.some((item) => item.id === projectId)) throw new Error("项目不存在。");
      const sessionsToDelete = index.sessions.filter((item) => item.workspaceId === projectId);
      await Promise.all(sessionsToDelete.map((item) => fs.rm(this.#sessionPath(item.id), { force: true })));
      const projects = index.projects.filter((item) => item.id !== projectId);
      const sessions = index.sessions.filter((item) => item.workspaceId !== projectId);
      const activeByWorkspace = { ...index.activeByWorkspace };
      delete activeByWorkspace[projectId];
      const next: SessionIndexFile = { version: 2, activeProjectId: index.activeProjectId === projectId ? projects[0]!.id : index.activeProjectId, projects, activeByWorkspace, sessions };
      await this.#writeJson(this.#indexPath, next);
      return this.#projectSnapshot(next);
    });
  }

  async snapshot(workspaceId: string): Promise<WorkspaceSessionSnapshot> {
    const index = await this.#readIndex();
    const sessions = index.sessions.filter((item) => item.workspaceId === workspaceId).sort((a, b) => b.updatedAt - a.updatedAt);
    const candidate = index.activeByWorkspace[workspaceId];
    return { activeSessionId: candidate && sessions.some((item) => item.id === candidate) ? candidate : sessions[0]?.id ?? null, sessions };
  }

  async create(input: CreateWorkspaceSessionInput): Promise<WorkspaceSessionRecord> {
    return this.#mutate(async () => {
      const index = await this.#readIndex();
      if (!index.projects.some((item) => item.id === input.workspaceId)) throw new Error("Session 所属项目不存在。");
      const now = Date.now();
      const record: WorkspaceSessionRecord = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      title: input.title?.trim() || "新对话",
      mode: input.mode,
      messages: [],
      workContext: "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
      };
      await this.#writeJson(this.#sessionPath(record.id), record);
      const sessions = [summaryFor(record), ...index.sessions.filter((item) => item.id !== record.id)];
      await this.#writeJson(this.#indexPath, { ...index, activeProjectId: record.workspaceId, activeByWorkspace: { ...index.activeByWorkspace, [record.workspaceId]: record.id }, sessions });
      return record;
    });
  }

  async load(sessionId: string): Promise<WorkspaceSessionRecord> {
    const record = JSON.parse(await fs.readFile(this.#sessionPath(sessionId), "utf8")) as WorkspaceSessionRecord;
    const sanitized = sanitizeSession(record);
    if (JSON.stringify(sanitized) !== JSON.stringify(record)) await this.save(sanitized);
    return sanitized;
  }

  async save(session: WorkspaceSessionRecord): Promise<WorkspaceSessionRecord> {
    return this.#mutate(async () => {
      const next = sanitizeSession({ ...session, pinned: Boolean(session.pinned), updatedAt: Date.now() });
      await this.#writeJson(this.#sessionPath(next.id), next);
      const index = await this.#readIndex();
      const sessions = [summaryFor(next), ...index.sessions.filter((item) => item.id !== next.id)].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
      await this.#writeJson(this.#indexPath, { ...index, activeProjectId: next.workspaceId, activeByWorkspace: { ...index.activeByWorkspace, [next.workspaceId]: next.id }, sessions });
      return next;
    });
  }

  async setActive(workspaceId: string, sessionId: string): Promise<WorkspaceSessionSnapshot> {
    return this.#mutate(async () => {
      const index = await this.#readIndex();
      if (!index.sessions.some((item) => item.id === sessionId && item.workspaceId === workspaceId)) throw new Error("Session 不存在于当前项目。");
      await this.#writeJson(this.#indexPath, { ...index, activeProjectId: workspaceId, activeByWorkspace: { ...index.activeByWorkspace, [workspaceId]: sessionId } });
      const sessions = index.sessions.filter((item) => item.workspaceId === workspaceId).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
      return { activeSessionId: sessionId, sessions };
    });
  }

  async delete(sessionId: string): Promise<WorkspaceSessionSnapshot> {
    return this.#mutate(async () => {
    const index = await this.#readIndex();
    const target = index.sessions.find((item) => item.id === sessionId);
    if (!target) throw new Error("Session 不存在。");
    await fs.rm(this.#sessionPath(sessionId), { force: true });
    const sessions = index.sessions.filter((item) => item.id !== sessionId);
    const activeByWorkspace = { ...index.activeByWorkspace };
    if (activeByWorkspace[target.workspaceId] === sessionId) {
      const replacement = sessions.filter((item) => item.workspaceId === target.workspaceId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (replacement) activeByWorkspace[target.workspaceId] = replacement.id;
      else delete activeByWorkspace[target.workspaceId];
    }
    const next = { ...index, activeByWorkspace, sessions };
    await this.#writeJson(this.#indexPath, next);
    const projectSessions = sessions.filter((item) => item.workspaceId === target.workspaceId).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
    return { activeSessionId: activeByWorkspace[target.workspaceId] ?? null, sessions: projectSessions };
    });
  }
}
