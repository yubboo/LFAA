/**
 * 文件：packages/identity/identity/src/index.ts
 * 作用：定义 LFAA 实例级身份、角色、权限与 AuthSession 公共契约。
 * 负责：First Run、User/Role/Permission、登录结果、Identity Host 接口与权限匹配规则。
 * 不负责：密码散列、Cookie、文件系统持久化、React、Workspace Session、Provider Credential。
 * 状态归属：身份长期真值由 Identity Host Provider 保存；本文件只定义稳定协议。
 * 对外接口：LfaaIdentityHost 及相关 Identity 类型与 permissionMatches()。
 * 关联文件：@lfaa/identity-host-node、@lfaa/identity-controller、@lfaa/identity-ui。
 * 修改注意事项：AuthSession 与 Workspace Session 必须保持语义隔离；角色只能作为权限集合，禁止把角色名当最终授权结论。
 */
export type LfaaBuiltinRoleId = "super_admin" | "admin" | "user";
export type LfaaPermissionId = string;

export interface LfaaUserRecord {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly roleIds: readonly string[];
  readonly disabled: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastLoginAt?: number;
}

export interface LfaaRoleRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly LfaaPermissionId[];
  readonly system: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface LfaaAuthSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly lastSeenAt: number;
}

export interface LfaaAuthenticatedUser {
  readonly user: LfaaUserRecord;
  readonly roles: readonly LfaaRoleRecord[];
  readonly permissions: readonly LfaaPermissionId[];
  readonly authSession: LfaaAuthSessionRecord;
}

export interface LfaaIdentityBootstrapState {
  readonly initialized: boolean;
}

export interface LfaaIdentitySnapshot {
  readonly initialized: boolean;
  readonly users: readonly LfaaUserRecord[];
  readonly roles: readonly LfaaRoleRecord[];
}

export interface InitializeSuperAdminInput {
  readonly username: string;
  readonly displayName?: string;
  readonly password: string;
}

export interface LoginInput {
  readonly username: string;
  readonly password: string;
}

export interface CreateIdentityUserInput {
  readonly username: string;
  readonly displayName?: string;
  readonly password: string;
  readonly roleIds?: readonly string[];
}

export interface UpdateIdentityUserInput {
  readonly displayName?: string;
  readonly disabled?: boolean;
  readonly roleIds?: readonly string[];
}

export interface CreateIdentityRoleInput {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly permissions: readonly LfaaPermissionId[];
}

export interface UpdateIdentityRoleInput {
  readonly name?: string;
  readonly description?: string;
  readonly permissions?: readonly LfaaPermissionId[];
}

export interface LfaaIdentityHost {
  bootstrapState(): Promise<LfaaIdentityBootstrapState>;
  initializeSuperAdmin(input: InitializeSuperAdminInput): Promise<{ readonly user: LfaaUserRecord; readonly token: string; readonly session: LfaaAuthSessionRecord }>;
  login(input: LoginInput): Promise<{ readonly user: LfaaUserRecord; readonly token: string; readonly session: LfaaAuthSessionRecord }>;
  authenticate(token: string): Promise<LfaaAuthenticatedUser | null>;
  logout(token: string): Promise<void>;
  snapshot(): Promise<LfaaIdentitySnapshot>;
  createUser(input: CreateIdentityUserInput): Promise<LfaaIdentitySnapshot>;
  updateUser(userId: string, input: UpdateIdentityUserInput): Promise<LfaaIdentitySnapshot>;
  createRole(input: CreateIdentityRoleInput): Promise<LfaaIdentitySnapshot>;
  updateRole(roleId: string, input: UpdateIdentityRoleInput): Promise<LfaaIdentitySnapshot>;
  deleteRole(roleId: string): Promise<LfaaIdentitySnapshot>;
}

export const LFAA_IDENTITY_PERMISSIONS = {
  systemAll: "*",
  usersRead: "identity.users.read",
  usersManage: "identity.users.manage",
  rolesRead: "identity.roles.read",
  rolesManage: "identity.roles.manage",
  appUse: "app-pack.use",
  projectManage: "project.manage",
  agentRun: "agent.run",
  pluginManage: "plugin.manage",
  settingsManage: "settings.manage",
} as const;

/** 支持 `*` 与 `namespace.*`，最终 Host 仍应结合资源 Scope / Capability Policy 再做授权。 */
export function permissionMatches(granted: string, required: string): boolean {
  if (granted === "*") return true;
  if (granted === required) return true;
  if (!granted.endsWith(".*")) return false;
  const prefix = granted.slice(0, -1);
  return required.startsWith(prefix);
}

export function hasPermission(permissions: readonly string[], required: string): boolean {
  return permissions.some((granted) => permissionMatches(granted, required));
}
