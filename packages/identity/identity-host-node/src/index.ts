/**
 * 文件：packages/identity/identity-host-node/src/index.ts
 * 作用：实现 LFAA 本地实例的 First Run、用户/角色、密码校验与 AuthSession 持久化。
 * 负责：scrypt 密码散列、随机 Auth Token、原子 JSON 写入、系统角色、用户与 AuthSession 生命周期。
 * 不负责：HTTP/Cookie、React、Workspace Session、App Pack Scope、Provider Credential。
 * 状态归属：LFAA_HOME/state/identity 是实例身份长期真值；内存只持有写串行队列。
 * 对外接口：NodeIdentityRepository。
 * 关联文件：@lfaa/identity、@lfaa/home-paths、@lfaa/identity-controller。
 * 修改注意事项：禁止持久化密码/Token 明文；First Run 初始化必须原子且只允许执行一次。
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveLfaaHomePaths } from "@lfaa/home-paths";
import {
  LFAA_IDENTITY_PERMISSIONS,
  type CreateIdentityRoleInput,
  type CreateIdentityUserInput,
  type InitializeSuperAdminInput,
  type LfaaAuthenticatedUser,
  type LfaaAuthSessionRecord,
  type LfaaIdentityBootstrapState,
  type LfaaIdentityHost,
  type LfaaIdentitySnapshot,
  type LfaaRoleRecord,
  type LfaaUserRecord,
  type LoginInput,
  type UpdateIdentityRoleInput,
  type UpdateIdentityUserInput,
} from "@lfaa/identity";

const IDENTITY_VERSION = 1 as const;
const AUTH_SESSION_VERSION = 1 as const;
const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/u;
const ROLE_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/u;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 256;
const SCRYPT_KEY_LENGTH = 32;

interface StoredUser extends LfaaUserRecord {
  readonly passwordHash: string;
  readonly passwordSalt: string;
}
interface IdentityStateFile {
  readonly version: typeof IDENTITY_VERSION;
  readonly users: readonly StoredUser[];
  readonly roles: readonly LfaaRoleRecord[];
}
interface StoredAuthSession extends LfaaAuthSessionRecord {
  readonly tokenHash: string;
}
interface AuthSessionStateFile {
  readonly version: typeof AUTH_SESSION_VERSION;
  readonly sessions: readonly StoredAuthSession[];
}

const scrypt = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
    if (error) reject(error); else resolve(derivedKey);
  });
});
const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const publicUser = ({ passwordHash: _hash, passwordSalt: _salt, ...user }: StoredUser): LfaaUserRecord => user;
const normalizeUsername = (value: string) => value.trim().toLowerCase();
const cleanDisplayName = (value: string | undefined, username: string) => (value?.replace(/\s+/gu, " ").trim() || username).slice(0, 80);

function assertUsername(value: string): string {
  const username = normalizeUsername(value);
  if (!USERNAME_RE.test(username)) throw new Error("用户名需为 3-32 位字母、数字、点、下划线或短横线，并以字母或数字开头。");
  return username;
}
function assertPassword(value: string): void {
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) throw new Error(`密码长度需为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位。`);
}
function assertRoleId(value: string): string {
  const roleId = value.trim().toLowerCase();
  if (!ROLE_ID_RE.test(roleId)) throw new Error("角色 ID 格式无效。");
  return roleId;
}
function unique(values: readonly string[]): string[] { return [...new Set(values)]; }

function builtinRoles(now: number): readonly LfaaRoleRecord[] {
  return [
    {
      id: "super_admin", name: "超级管理员", description: "LFAA 实例 Root；拥有全部系统权限。", permissions: [LFAA_IDENTITY_PERMISSIONS.systemAll], system: true, createdAt: now, updatedAt: now,
    },
    {
      id: "admin", name: "管理员", description: "管理项目、Agent、插件与设置，并可查看实例用户/角色。", permissions: ["project.*", "agent.*", "app-pack.*", "plugin.*", "settings.*", LFAA_IDENTITY_PERMISSIONS.usersRead, LFAA_IDENTITY_PERMISSIONS.rolesRead], system: true, createdAt: now, updatedAt: now,
    },
    {
      id: "user", name: "用户", description: "使用 App Pack、项目与 Agent，不拥有实例管理权限。", permissions: [LFAA_IDENTITY_PERMISSIONS.appUse, "project.*", LFAA_IDENTITY_PERMISSIONS.agentRun], system: true, createdAt: now, updatedAt: now,
    },
  ];
}

export class NodeIdentityRepository implements LfaaIdentityHost {
  readonly #root: string;
  readonly #identityPath: string;
  readonly #authSessionPath: string;
  #mutation: Promise<void> = Promise.resolve();

  constructor(root = path.join(resolveLfaaHomePaths().state, "identity")) {
    this.#root = root;
    this.#identityPath = path.join(root, "identity.json");
    this.#authSessionPath = path.join(root, "auth-sessions.json");
  }

  #mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutation.then(operation, operation);
    this.#mutation = result.then(() => undefined, () => undefined);
    return result;
  }
  async #ensure(): Promise<void> { await fs.mkdir(this.#root, { recursive: true }); }
  async #writeJson(target: string, value: unknown): Promise<void> {
    await this.#ensure();
    const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temp, target);
  }
  async #readIdentity(): Promise<IdentityStateFile | null> {
    await this.#ensure();
    try {
      const value = JSON.parse(await fs.readFile(this.#identityPath, "utf8")) as IdentityStateFile;
      if (value.version !== IDENTITY_VERSION || !Array.isArray(value.users) || !Array.isArray(value.roles)) throw new Error("Identity 状态版本无效。");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async #readAuthSessions(): Promise<AuthSessionStateFile> {
    await this.#ensure();
    try {
      const value = JSON.parse(await fs.readFile(this.#authSessionPath, "utf8")) as AuthSessionStateFile;
      if (value.version !== AUTH_SESSION_VERSION || !Array.isArray(value.sessions)) throw new Error("AuthSession 状态版本无效。");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: AUTH_SESSION_VERSION, sessions: [] };
      throw error;
    }
  }
  #snapshot(state: IdentityStateFile): LfaaIdentitySnapshot {
    return { initialized: state.users.length > 0, users: state.users.map(publicUser), roles: state.roles };
  }
  #resolveRoles(state: IdentityStateFile, user: StoredUser): LfaaRoleRecord[] {
    return user.roleIds.map((id) => state.roles.find((role) => role.id === id)).filter((role): role is LfaaRoleRecord => Boolean(role));
  }
  #permissions(state: IdentityStateFile, user: StoredUser): string[] {
    return unique(this.#resolveRoles(state, user).flatMap((role) => role.permissions));
  }
  async #invalidateUserSessions(userId: string): Promise<void> {
    const auth = await this.#readAuthSessions();
    const next = auth.sessions.filter((item) => item.userId !== userId);
    if (next.length !== auth.sessions.length) await this.#writeJson(this.#authSessionPath, { version: AUTH_SESSION_VERSION, sessions: next } satisfies AuthSessionStateFile);
  }

  async #createSession(userId: string): Promise<{ token: string; session: LfaaAuthSessionRecord }> {
    const token = crypto.randomBytes(32).toString("base64url");
    const now = Date.now();
    const session: StoredAuthSession = { id: crypto.randomUUID(), userId, tokenHash: tokenHash(token), createdAt: now, expiresAt: now + AUTH_SESSION_TTL_MS, lastSeenAt: now };
    const existing = await this.#readAuthSessions();
    const sessions = existing.sessions.filter((item) => item.expiresAt > now && item.userId !== userId);
    await this.#writeJson(this.#authSessionPath, { version: AUTH_SESSION_VERSION, sessions: [session, ...sessions] } satisfies AuthSessionStateFile);
    const { tokenHash: _tokenHash, ...publicSession } = session;
    return { token, session: publicSession };
  }

  async bootstrapState(): Promise<LfaaIdentityBootstrapState> {
    const state = await this.#readIdentity();
    return { initialized: Boolean(state?.users.length) };
  }

  async initializeSuperAdmin(input: InitializeSuperAdminInput) {
    return this.#mutate(async () => {
      if (await this.#readIdentity()) throw new Error("LFAA 已完成初始化，不能再次创建 First Run 超级管理员。");
      const username = assertUsername(input.username);
      assertPassword(input.password);
      const now = Date.now();
      const salt = crypto.randomBytes(16).toString("base64url");
      const hash = (await scrypt(input.password, salt)).toString("base64url");
      const user: StoredUser = {
        id: crypto.randomUUID(), username, displayName: cleanDisplayName(input.displayName, username), roleIds: ["super_admin"], disabled: false,
        passwordHash: hash, passwordSalt: salt, createdAt: now, updatedAt: now, lastLoginAt: now,
      };
      await this.#writeJson(this.#identityPath, { version: IDENTITY_VERSION, users: [user], roles: builtinRoles(now) } satisfies IdentityStateFile);
      const auth = await this.#createSession(user.id);
      return { user: publicUser(user), token: auth.token, session: auth.session };
    });
  }

  async login(input: LoginInput) {
    return this.#mutate(async () => {
      const state = await this.#readIdentity();
      if (!state?.users.length) throw new Error("LFAA 尚未初始化，请先创建超级管理员。");
      const username = normalizeUsername(input.username);
      const user = state.users.find((item) => item.username === username);
      const fakeSalt = "lfaa-login-timing-equalizer";
      const candidate = await scrypt(input.password, user?.passwordSalt ?? fakeSalt);
      const expected = user ? Buffer.from(user.passwordHash, "base64url") : await scrypt("invalid-password-placeholder", fakeSalt);
      const valid = candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
      if (!user || !valid) throw new Error("用户名或密码错误。");
      if (user.disabled) throw new Error("该用户已被禁用。");
      const now = Date.now();
      const updated: StoredUser = { ...user, updatedAt: now, lastLoginAt: now };
      const next = { ...state, users: state.users.map((item) => item.id === user.id ? updated : item) } satisfies IdentityStateFile;
      await this.#writeJson(this.#identityPath, next);
      const auth = await this.#createSession(user.id);
      return { user: publicUser(updated), token: auth.token, session: auth.session };
    });
  }

  async authenticate(token: string): Promise<LfaaAuthenticatedUser | null> {
    if (!token) return null;
    const [state, auth] = await Promise.all([this.#readIdentity(), this.#readAuthSessions()]);
    if (!state) return null;
    const now = Date.now();
    const hash = tokenHash(token);
    const session = auth.sessions.find((item) => item.tokenHash === hash && item.expiresAt > now);
    if (!session) return null;
    const user = state.users.find((item) => item.id === session.userId && !item.disabled);
    if (!user) return null;
    const { tokenHash: _tokenHash, ...publicSession } = session;
    return { user: publicUser(user), roles: this.#resolveRoles(state, user), permissions: this.#permissions(state, user), authSession: publicSession };
  }

  async logout(token: string): Promise<void> {
    if (!token) return;
    await this.#mutate(async () => {
      const auth = await this.#readAuthSessions();
      const hash = tokenHash(token);
      await this.#writeJson(this.#authSessionPath, { version: AUTH_SESSION_VERSION, sessions: auth.sessions.filter((item) => item.tokenHash !== hash) } satisfies AuthSessionStateFile);
    });
  }

  async snapshot(): Promise<LfaaIdentitySnapshot> {
    const state = await this.#readIdentity();
    if (!state) return { initialized: false, users: [], roles: [] };
    return this.#snapshot(state);
  }

  async createUser(input: CreateIdentityUserInput): Promise<LfaaIdentitySnapshot> {
    return this.#mutate(async () => {
      const state = await this.#readIdentity();
      if (!state) throw new Error("LFAA 尚未初始化。");
      const username = assertUsername(input.username);
      if (state.users.some((item) => item.username === username)) throw new Error("用户名已存在。");
      assertPassword(input.password);
      const roleIds = unique(input.roleIds?.length ? input.roleIds : ["user"]);
      if (roleIds.includes("super_admin")) throw new Error("不能通过普通用户创建接口授予 super_admin。");
      if (roleIds.some((id) => !state.roles.some((role) => role.id === id))) throw new Error("包含不存在的角色。");
      const now = Date.now();
      const salt = crypto.randomBytes(16).toString("base64url");
      const user: StoredUser = {
        id: crypto.randomUUID(), username, displayName: cleanDisplayName(input.displayName, username), roleIds, disabled: false,
        passwordHash: (await scrypt(input.password, salt)).toString("base64url"), passwordSalt: salt, createdAt: now, updatedAt: now,
      };
      const next = { ...state, users: [...state.users, user] } satisfies IdentityStateFile;
      await this.#writeJson(this.#identityPath, next);
      return this.#snapshot(next);
    });
  }

  async updateUser(userId: string, input: UpdateIdentityUserInput): Promise<LfaaIdentitySnapshot> {
    return this.#mutate(async () => {
      const state = await this.#readIdentity();
      if (!state) throw new Error("LFAA 尚未初始化。");
      const target = state.users.find((item) => item.id === userId);
      if (!target) throw new Error("用户不存在。");
      if (target.roleIds.includes("super_admin") && (input.disabled === true || (input.roleIds && !input.roleIds.includes("super_admin")))) throw new Error("First Run 超级管理员不能被禁用或移除 super_admin 角色。");
      const roleIds = input.roleIds ? unique(input.roleIds) : target.roleIds;
      if (!target.roleIds.includes("super_admin") && roleIds.includes("super_admin")) throw new Error("super_admin 只属于 First Run 根账户，不能授予其他用户。");
      if (roleIds.some((id) => !state.roles.some((role) => role.id === id))) throw new Error("包含不存在的角色。");
      const updated: StoredUser = {
        ...target,
        ...(input.displayName !== undefined ? { displayName: cleanDisplayName(input.displayName, target.username) } : {}),
        ...(input.disabled !== undefined ? { disabled: input.disabled } : {}),
        ...(input.roleIds !== undefined ? { roleIds } : {}),
        updatedAt: Date.now(),
      };
      const next = { ...state, users: state.users.map((item) => item.id === userId ? updated : item) } satisfies IdentityStateFile;
      await this.#writeJson(this.#identityPath, next);
      if (input.disabled === true) await this.#invalidateUserSessions(userId);
      return this.#snapshot(next);
    });
  }

  async createRole(input: CreateIdentityRoleInput): Promise<LfaaIdentitySnapshot> {
    return this.#mutate(async () => {
      const state = await this.#readIdentity();
      if (!state) throw new Error("LFAA 尚未初始化。");
      const id = assertRoleId(input.id);
      if (state.roles.some((role) => role.id === id)) throw new Error("角色 ID 已存在。");
      const permissions = unique(input.permissions.map((item) => item.trim()).filter(Boolean));
      if (permissions.includes(LFAA_IDENTITY_PERMISSIONS.systemAll)) throw new Error("通配 Root 权限 * 仅属于 First Run super_admin，不能授予自定义角色。");
      const now = Date.now();
      const role: LfaaRoleRecord = { id, name: input.name.trim().slice(0, 80) || id, description: input.description?.trim().slice(0, 240) || "", permissions, system: false, createdAt: now, updatedAt: now };
      const next = { ...state, roles: [...state.roles, role] } satisfies IdentityStateFile;
      await this.#writeJson(this.#identityPath, next);
      return this.#snapshot(next);
    });
  }

  async updateRole(roleId: string, input: UpdateIdentityRoleInput): Promise<LfaaIdentitySnapshot> {
    return this.#mutate(async () => {
      const state = await this.#readIdentity();
      if (!state) throw new Error("LFAA 尚未初始化。");
      const target = state.roles.find((role) => role.id === roleId);
      if (!target) throw new Error("角色不存在。");
      if (target.system) throw new Error("系统内置角色不能修改。");
      const nextPermissions = input.permissions !== undefined ? unique(input.permissions.map((item) => item.trim()).filter(Boolean)) : target.permissions;
      if (nextPermissions.includes(LFAA_IDENTITY_PERMISSIONS.systemAll)) throw new Error("通配 Root 权限 * 仅属于 First Run super_admin，不能授予自定义角色。");
      const updated: LfaaRoleRecord = {
        ...target,
        ...(input.name !== undefined ? { name: input.name.trim().slice(0, 80) || target.name } : {}),
        ...(input.description !== undefined ? { description: input.description.trim().slice(0, 240) } : {}),
        ...(input.permissions !== undefined ? { permissions: nextPermissions } : {}),
        updatedAt: Date.now(),
      };
      const next = { ...state, roles: state.roles.map((role) => role.id === roleId ? updated : role) } satisfies IdentityStateFile;
      await this.#writeJson(this.#identityPath, next);
      return this.#snapshot(next);
    });
  }

  async deleteRole(roleId: string): Promise<LfaaIdentitySnapshot> {
    return this.#mutate(async () => {
      const state = await this.#readIdentity();
      if (!state) throw new Error("LFAA 尚未初始化。");
      const target = state.roles.find((role) => role.id === roleId);
      if (!target) throw new Error("角色不存在。");
      if (target.system) throw new Error("系统内置角色不能删除。");
      if (state.users.some((user) => user.roleIds.includes(roleId))) throw new Error("角色仍被用户使用，不能删除。");
      const next = { ...state, roles: state.roles.filter((role) => role.id !== roleId) } satisfies IdentityStateFile;
      await this.#writeJson(this.#identityPath, next);
      return this.#snapshot(next);
    });
  }
}
