/**
 * 文件：packages/client/connection/src/identity-client.ts
 * 作用：把浏览器同源 Identity API 适配为 LFAA Identity Web Client Host。
 * 负责：First Run 状态、初始化超级管理员、登录/登出、当前用户与用户/角色管理请求。
 * 不负责：保存密码/Token、Cookie 管理、React 状态、权限判定、Workspace Session。
 * 状态归属：无持久状态；Auth Token 由 Host 通过 HttpOnly Cookie 管理。
 * 对外接口：webIdentityHost、WebIdentityHost。
 * 关联文件：@lfaa/identity-controller、@lfaa/identity、@lfaa/identity-ui。
 * 修改注意事项：禁止把密码、Token 写入 localStorage/sessionStorage/URL/log；请求必须保持同源 credentials。
 */
import type {
  CreateIdentityRoleInput,
  CreateIdentityUserInput,
  InitializeSuperAdminInput,
  LfaaAuthenticatedUser,
  LfaaIdentityBootstrapState,
  LfaaIdentitySnapshot,
  LoginInput,
  UpdateIdentityRoleInput,
  UpdateIdentityUserInput,
} from "@lfaa/identity";

const BASE = "/__lfaa/dev/identity";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json() as { ok: boolean; error?: string } & T;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `Identity Host 请求失败：${response.status}`);
  return payload;
}

export interface WebIdentityHost {
  bootstrapState(): Promise<LfaaIdentityBootstrapState>;
  initializeSuperAdmin(input: InitializeSuperAdminInput): Promise<LfaaAuthenticatedUser>;
  login(input: LoginInput): Promise<LfaaAuthenticatedUser>;
  me(): Promise<LfaaAuthenticatedUser>;
  logout(): Promise<void>;
  snapshot(): Promise<LfaaIdentitySnapshot>;
  createUser(input: CreateIdentityUserInput): Promise<LfaaIdentitySnapshot>;
  updateUser(userId: string, input: UpdateIdentityUserInput): Promise<LfaaIdentitySnapshot>;
  createRole(input: CreateIdentityRoleInput): Promise<LfaaIdentitySnapshot>;
  updateRole(roleId: string, input: UpdateIdentityRoleInput): Promise<LfaaIdentitySnapshot>;
  deleteRole(roleId: string): Promise<LfaaIdentitySnapshot>;
}

export const webIdentityHost: WebIdentityHost = {
  async bootstrapState() { return request<LfaaIdentityBootstrapState>("/bootstrap"); },
  async initializeSuperAdmin(input) {
    await request("/initialize", { method: "POST", body: JSON.stringify(input) });
    return request<{ identity: LfaaAuthenticatedUser }>("/me").then((value) => value.identity);
  },
  async login(input) {
    await request("/login", { method: "POST", body: JSON.stringify(input) });
    return request<{ identity: LfaaAuthenticatedUser }>("/me").then((value) => value.identity);
  },
  async me() { return request<{ identity: LfaaAuthenticatedUser }>("/me").then((value) => value.identity); },
  async logout() { await request("/logout", { method: "POST", body: "{}" }); },
  async snapshot() { return request<{ snapshot: LfaaIdentitySnapshot }>("/snapshot").then((value) => value.snapshot); },
  async createUser(input) { return request<{ snapshot: LfaaIdentitySnapshot }>("/users", { method: "POST", body: JSON.stringify(input) }).then((value) => value.snapshot); },
  async updateUser(userId, input) { return request<{ snapshot: LfaaIdentitySnapshot }>(`/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(input) }).then((value) => value.snapshot); },
  async createRole(input) { return request<{ snapshot: LfaaIdentitySnapshot }>("/roles", { method: "POST", body: JSON.stringify(input) }).then((value) => value.snapshot); },
  async updateRole(roleId, input) { return request<{ snapshot: LfaaIdentitySnapshot }>(`/roles/${encodeURIComponent(roleId)}`, { method: "PATCH", body: JSON.stringify(input) }).then((value) => value.snapshot); },
  async deleteRole(roleId) { return request<{ snapshot: LfaaIdentitySnapshot }>(`/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" }).then((value) => value.snapshot); },
};
