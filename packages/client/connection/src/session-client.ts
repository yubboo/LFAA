/**
 * 文件：packages/client/connection/src/session-client.ts
 * 作用：浏览器访问本地 Session Host 的同源 Client Adapter。
 * 负责：snapshot/create/load/save/setActive/delete 请求。
 * 不负责：Session 业务规则、React 状态、磁盘路径。
 * 状态归属：无持久状态。
 * 对外接口：webWorkspaceSessionHost。
 * 关联文件：@lfaa/session、@lfaa/session-controller、@lfaa/workspace。
 * 修改注意事项：刷新恢复只能以 Host Session 为真值，禁止另建 localStorage 聊天记录副本。
 */
import type {
  CreateWorkspaceSessionInput,
  CreateWorkspaceProjectInput,
  UpdateWorkspaceProjectInput,
  WorkspaceProjectSnapshot,
  WorkspaceSessionHost,
  WorkspaceSessionRecord,
  WorkspaceSessionSnapshot,
} from "@lfaa/session";

const BASE = "/__lfaa/dev/sessions";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Session Host 未接入当前 Web Host；请重启 LFAA 开发服务后重试。");
  }
  const payload = await response.json() as { ok: boolean; error?: string } & T;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `Session Host 请求失败：${response.status}`);
  return payload;
}

export const webWorkspaceSessionHost: WorkspaceSessionHost = {
  async projects(defaultProjectId = "lfaa"): Promise<WorkspaceProjectSnapshot> {
    return (await request<{ snapshot: WorkspaceProjectSnapshot }>(`/projects?defaultProjectId=${encodeURIComponent(defaultProjectId)}`)).snapshot;
  },
  async createProject(input: CreateWorkspaceProjectInput): Promise<WorkspaceProjectSnapshot> {
    return (await request<{ snapshot: WorkspaceProjectSnapshot }>("/projects", { method: "POST", body: JSON.stringify(input) })).snapshot;
  },
  async updateProject(projectId: string, input: UpdateWorkspaceProjectInput): Promise<WorkspaceProjectSnapshot> {
    return (await request<{ snapshot: WorkspaceProjectSnapshot }>(`/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body: JSON.stringify(input) })).snapshot;
  },
  async setActiveProject(projectId: string): Promise<WorkspaceProjectSnapshot> {
    return (await request<{ snapshot: WorkspaceProjectSnapshot }>("/projects/active", { method: "POST", body: JSON.stringify({ projectId }) })).snapshot;
  },
  async deleteProject(projectId: string): Promise<WorkspaceProjectSnapshot> {
    return (await request<{ snapshot: WorkspaceProjectSnapshot }>(`/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" })).snapshot;
  },
  async snapshot(workspaceId: string): Promise<WorkspaceSessionSnapshot> {
    return (await request<{ snapshot: WorkspaceSessionSnapshot }>(`/snapshot?workspaceId=${encodeURIComponent(workspaceId)}`)).snapshot;
  },
  async create(input: CreateWorkspaceSessionInput): Promise<WorkspaceSessionRecord> {
    return (await request<{ session: WorkspaceSessionRecord }>("/", { method: "POST", body: JSON.stringify(input) })).session;
  },
  async load(sessionId: string): Promise<WorkspaceSessionRecord> {
    return (await request<{ session: WorkspaceSessionRecord }>(`/${encodeURIComponent(sessionId)}`)).session;
  },
  async save(session: WorkspaceSessionRecord): Promise<WorkspaceSessionRecord> {
    return (await request<{ session: WorkspaceSessionRecord }>(`/${encodeURIComponent(session.id)}`, { method: "PUT", body: JSON.stringify({ session }), keepalive: true })).session;
  },
  async setActive(workspaceId: string, sessionId: string): Promise<WorkspaceSessionSnapshot> {
    return (await request<{ snapshot: WorkspaceSessionSnapshot }>("/active", { method: "POST", body: JSON.stringify({ workspaceId, sessionId }) })).snapshot;
  },
  async delete(sessionId: string): Promise<WorkspaceSessionSnapshot> {
    return (await request<{ snapshot: WorkspaceSessionSnapshot }>(`/${encodeURIComponent(sessionId)}`, { method: "DELETE" })).snapshot;
  },
};
