/**
 * 文件：packages/session/session/src/index.ts
 * 作用：LFAA Chat / Work / Manual 共用的 Session 持久化领域契约。
 * 负责：会话、消息、Run Timeline、最近会话与 Session Host 接口。
 * 不负责：React 状态、Provider Runtime、文件系统实现、HTTP 传输。
 * 状态归属：Session 是用户工作连续性的长期真值，Chat/Work/Manual 只是不同行为表现层。
 * 对外接口：WorkspaceSessionRecord、WorkspaceSessionHost 及相关类型。
 * 关联文件：@lfaa/session-host-node、@lfaa/session-controller、@lfaa/workspace。
 * 修改注意事项：不得为 Chat / Work 建两套 Session；Running Run 恢复时必须显式转成 interrupted/cancelled 语义，不能假装仍在运行。
 */
export type WorkspaceSessionMode = "chat" | "work" | "manual";
export type SessionMessageRole = "user" | "assistant" | "error" | "run";
export type SessionRunStatus = "running" | "completed" | "failed" | "cancelled";
export type SessionRunPhase = "starting" | "thinking" | "acting" | "responding" | "waiting";
export type SessionActivityStatus = "running" | "completed" | "failed" | "declined" | "interrupted";
export type SessionActivityKind = "model" | "reasoning" | "plan" | "command" | "file" | "search" | "mcp" | "tool" | "review" | "system";

export interface SessionActivityRecord {
  readonly id: string;
  readonly kind: SessionActivityKind;
  readonly title: string;
  readonly detail?: string;
  readonly status: SessionActivityStatus;
  readonly output: string;
  readonly startedAt?: number;
  readonly completedAt?: number;
}

export interface SessionRunProcessRecord {
  readonly runId: string;
  readonly phase: SessionRunPhase;
  readonly label: string;
  readonly status: SessionRunStatus;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly reasoningSummary: string;
  readonly plan: string;
  readonly phases: readonly SessionRunPhaseRecord[];
  readonly activities: readonly SessionActivityRecord[];
}

export interface SessionRunPhaseRecord {
  readonly phase: SessionRunPhase;
  readonly label: string;
  readonly at: number;
}

export interface SessionMessageRecord {
  readonly id: string;
  readonly role: SessionMessageRole;
  readonly text: string;
  readonly runId?: string;
  readonly process?: SessionRunProcessRecord;
}

export interface WorkspaceSessionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly mode: WorkspaceSessionMode;
  readonly messages: readonly SessionMessageRecord[];
  readonly workContext: string;
  readonly pinned: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface WorkspaceSessionSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly mode: WorkspaceSessionMode;
  readonly preview: string;
  readonly pinned: boolean;
  readonly updatedAt: number;
}

export interface WorkspaceSessionSnapshot {
  readonly activeSessionId: string | null;
  readonly sessions: readonly WorkspaceSessionSummary[];
}

export interface WorkspaceProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly pinned: boolean;
  readonly expanded: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface WorkspaceProjectSnapshot {
  readonly activeProjectId: string;
  readonly projects: readonly WorkspaceProjectRecord[];
  readonly pinnedSessions: readonly WorkspaceSessionSummary[];
}

export interface CreateWorkspaceProjectInput {
  readonly name: string;
}

export interface UpdateWorkspaceProjectInput {
  readonly name?: string;
  readonly pinned?: boolean;
  readonly expanded?: boolean;
}

export interface CreateWorkspaceSessionInput {
  readonly workspaceId: string;
  readonly mode: WorkspaceSessionMode;
  readonly title?: string;
}

export interface WorkspaceSessionHost {
  projects(defaultProjectId?: string): Promise<WorkspaceProjectSnapshot>;
  createProject(input: CreateWorkspaceProjectInput): Promise<WorkspaceProjectSnapshot>;
  updateProject(projectId: string, input: UpdateWorkspaceProjectInput): Promise<WorkspaceProjectSnapshot>;
  setActiveProject(projectId: string): Promise<WorkspaceProjectSnapshot>;
  deleteProject(projectId: string): Promise<WorkspaceProjectSnapshot>;
  snapshot(workspaceId: string): Promise<WorkspaceSessionSnapshot>;
  create(input: CreateWorkspaceSessionInput): Promise<WorkspaceSessionRecord>;
  load(sessionId: string): Promise<WorkspaceSessionRecord>;
  save(session: WorkspaceSessionRecord): Promise<WorkspaceSessionRecord>;
  setActive(workspaceId: string, sessionId: string): Promise<WorkspaceSessionSnapshot>;
  delete(sessionId: string): Promise<WorkspaceSessionSnapshot>;
}
