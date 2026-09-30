/**
 * 功能：实现账户、角色和登录会话的持久化业务规则。
 * 作用：安全保存登录密码与恢复密钥哈希，初始化唯一超级管理员，并提供登录、密码找回和会话校验。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/credentials/authorization/src/middleware.ts、packages/identity/auth/src/password-policy.ts。
 */
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import { sessionRecords } from "lfaa-session-persistence-jsonl/src/repository.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { isPasswordAcceptable } from "./password-policy.js";

const scryptAsync = promisify(scrypt);
const passwordKeyLength = 64;
export const sessionLifetimeSeconds = 8 * 60 * 60;

export type UserRole = "super_admin" | "admin" | "member";
export type AssignableUserRole = Exclude<UserRole, "super_admin">;

export function hasAdminAccess(role: UserRole): boolean {
  return role === "super_admin" || role === "admin";
}

export interface PublicUser {
  id: string;
  uid: number;
  username: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}

interface UserRow {
  id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  role: AssignableUserRole;
  created_at: string;
  uid: number;
  email: string | null;
  is_super_admin: number;
}

interface SessionUserRow {
  session_id: string;
  user_id: string;
  username: string;
  role: AssignableUserRole;
  created_at: string;
  uid: number;
  email: string | null;
  is_super_admin: number;
}

interface AccountRow {
  id: string;
  username: string;
  role: AssignableUserRole;
  created_at: string;
  uid: number;
  email: string | null;
  is_super_admin: number;
}

export interface ActiveSession {
  sessionId: string;
  user: PublicUser;
}

interface RecoveryUserRow {
  id: string;
  recovery_key_salt: string | null;
  recovery_key_hash: string | null;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    uid: row.uid,
    username: row.username,
    email: row.email,
    role: row.is_super_admin === 1 ? "super_admin" : row.role,
    createdAt: row.created_at
  };
}

function toPublicAccount(row: AccountRow): PublicUser {
  return {
    id: row.id,
    uid: row.uid,
    username: row.username,
    email: row.email,
    role: row.is_super_admin === 1 ? "super_admin" : row.role,
    createdAt: row.created_at
  };
}

async function makePasswordHash(password: string, salt = randomBytes(16).toString("hex")): Promise<{ salt: string; hash: string }> {
  const hash = (await scryptAsync(password, salt, passwordKeyLength)) as Buffer;
  return { salt, hash: hash.toString("hex") };
}

async function passwordMatches(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const candidate = (await scryptAsync(password, salt, passwordKeyLength)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function requiresInitialSetup(): boolean {
  const row = database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number | bigint };
  return Number(row.count) === 0;
}

export async function createInitialAdmin(username: string, password: string): Promise<PublicUser> {
  validateStrongCredential(password, "密码");

  const credentials = await makePasswordHash(password);
  const user: PublicUser = {
    id: randomUUID(),
    uid: 1,
    username: username.trim(),
    email: null,
    role: "super_admin",
    createdAt: new Date().toISOString()
  };

  database.exec("BEGIN IMMEDIATE;");
  try {
    if (!requiresInitialSetup()) {
      throw new ApiError(409, "setup_completed", "管理员账户已初始化，请使用登录表单。");
    }

    database.prepare(`
      INSERT INTO users (id, uid, username, password_salt, password_hash, role, is_super_admin)
      VALUES (?, 1, ?, ?, ?, 'admin', 1)
    `).run(user.id, user.username, credentials.salt, credentials.hash);
    database.exec("COMMIT;");
    return user;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export async function authenticateUser(username: string, password: string): Promise<PublicUser | null> {
  const row = database.prepare(`
    SELECT id, uid, username, email, password_salt, password_hash, role, is_super_admin, created_at
    FROM users
    WHERE username = ?
  `).get(username.trim()) as UserRow | undefined;

  if (!row) {
    await scryptAsync(password, "lfaa-invalid-account-salt", passwordKeyLength);
    return null;
  }

  if (!(await passwordMatches(password, row.password_salt, row.password_hash))) {
    return null;
  }

  return toPublicUser(row);
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const row = database.prepare(`
    SELECT password_salt, password_hash
    FROM users
    WHERE id = ?
  `).get(userId) as Pick<UserRow, "password_salt" | "password_hash"> | undefined;

  if (!row) {
    await scryptAsync(password, "lfaa-invalid-account-salt", passwordKeyLength);
    return false;
  }

  return passwordMatches(password, row.password_salt, row.password_hash);
}

export async function changeUserPassword(userId: string, currentSessionId: string, currentPassword: string, newPassword: string): Promise<string[] | null> {
  validateStrongCredential(newPassword, "新密码");
  if (currentPassword === newPassword) {
    throw new ApiError(400, "credentials_must_differ", "新密码必须与当前登录密码不同。");
  }

  const row = database.prepare("SELECT password_salt, password_hash FROM users WHERE id = ?").get(userId) as Pick<UserRow, "password_salt" | "password_hash"> | undefined;
  if (!row) {
    await scryptAsync(currentPassword, "lfaa-invalid-account-salt", passwordKeyLength);
    return null;
  }
  if (!(await passwordMatches(currentPassword, row.password_salt, row.password_hash))) return null;

  const credentials = await makePasswordHash(newPassword);
  database.exec("BEGIN IMMEDIATE;");
  try {
    const updated = database.prepare(`
      UPDATE users SET password_salt = ?, password_hash = ?
      WHERE id = ? AND password_salt = ? AND password_hash = ?
    `).run(credentials.salt, credentials.hash, userId, row.password_salt, row.password_hash);
    if (updated.changes === 0) {
      database.exec("ROLLBACK;");
      return null;
    }

    const otherSessions = database.prepare("SELECT id FROM sessions WHERE user_id = ? AND id != ?").all(userId, currentSessionId) as Array<{ id: string }>;
    // 保留本次验证中的会话，其余登录会话随密码更新一并失效。
    database.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(userId, currentSessionId);
    database.exec("COMMIT;");
    return otherSessions.map((session) => session.id);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function createSession(userId: string): { sessionId: string; expiresAt: number } {
  const sessionId = randomUUID();
  const expiresAt = Date.now() + sessionLifetimeSeconds * 1000;

  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  database.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(sessionId, userId, expiresAt);

  return { sessionId, expiresAt };
}

export function findActiveSession(sessionId: string): ActiveSession | null {
  const row = database.prepare(`
    SELECT sessions.id AS session_id, users.id AS user_id, users.uid, users.username, users.email,
           users.role, users.is_super_admin, users.created_at
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `).get(sessionId, Date.now()) as SessionUserRow | undefined;

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      uid: row.uid,
      username: row.username,
      email: row.email,
      role: row.is_super_admin === 1 ? "super_admin" : row.role,
      createdAt: row.created_at
    }
  };
}

export function revokeSession(sessionId: string): void {
  database.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

function validateStrongCredential(value: string, label: string): void {
  if (!isPasswordAcceptable(value)) {
    throw new ApiError(400, "weak_password", `${label}至少需要 8 个字符，并包含至少 3 类字符：大写字母、小写字母、数字、符号或汉字。`);
  }
}

export async function setRecoveryKey(userId: string, currentPassword: string, recoveryKey: string): Promise<boolean> {
  validateStrongCredential(recoveryKey, "恢复密钥");
  if (currentPassword === recoveryKey) {
    throw new ApiError(400, "credentials_must_differ", "恢复密钥必须与登录密码不同。");
  }

  const row = database.prepare(`
    SELECT id, uid, username, email, password_salt, password_hash, role, is_super_admin, created_at
    FROM users
    WHERE id = ?
  `).get(userId) as UserRow | undefined;

  if (!row) {
    await scryptAsync(currentPassword, "lfaa-invalid-account-salt", passwordKeyLength);
    return false;
  }

  if (!(await passwordMatches(currentPassword, row.password_salt, row.password_hash))) {
    return false;
  }

  const credentials = await makePasswordHash(recoveryKey);
  const result = database.prepare(`
    UPDATE users SET recovery_key_salt = ?, recovery_key_hash = ?
    WHERE id = ? AND password_salt = ? AND password_hash = ?
  `).run(credentials.salt, credentials.hash, userId, row.password_salt, row.password_hash);
  return result.changes > 0;
}

export async function updateOwnEmail(userId: string, currentPassword: string, email: string | null): Promise<PublicUser | null> {
  const normalizedEmail = normalizeEmail(email);
  const row = database.prepare(`
    SELECT id, uid, username, email, password_salt, password_hash, role, created_at, is_super_admin
    FROM users WHERE id = ?
  `).get(userId) as UserRow | undefined;
  if (!row) {
    await scryptAsync(currentPassword, "lfaa-invalid-account-salt", passwordKeyLength);
    return null;
  }
  if (!(await passwordMatches(currentPassword, row.password_salt, row.password_hash))) return null;

  database.exec("BEGIN IMMEDIATE;");
  try {
    assertAccountFieldsAvailable(row.username, normalizedEmail, userId);
    const updated = database.prepare(`
      UPDATE users SET email = ?
      WHERE id = ? AND password_salt = ? AND password_hash = ?
    `).run(normalizedEmail, userId, row.password_salt, row.password_hash);
    if (updated.changes === 0) {
      database.exec("ROLLBACK;");
      return null;
    }

    const account = database.prepare(`
      SELECT id, uid, username, email, role, created_at, is_super_admin FROM users WHERE id = ?
    `).get(userId) as AccountRow | undefined;
    if (!account) throw new ApiError(404, "user_not_found", "找不到当前账户。");
    database.exec("COMMIT;");
    return toPublicAccount(account);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export async function resetPasswordWithRecoveryKey(username: string, recoveryKey: string, newPassword: string): Promise<boolean> {
  validateStrongCredential(newPassword, "新密码");
  if (newPassword === recoveryKey) {
    throw new ApiError(400, "credentials_must_differ", "新密码必须与恢复密钥不同。");
  }

  const row = database.prepare(`
    SELECT id, recovery_key_salt, recovery_key_hash
    FROM users
    WHERE username = ?
  `).get(username.trim()) as RecoveryUserRow | undefined;

  if (!row?.recovery_key_salt || !row.recovery_key_hash) {
    await scryptAsync(recoveryKey, "lfaa-invalid-recovery-salt", passwordKeyLength);
    return false;
  }

  if (!(await passwordMatches(recoveryKey, row.recovery_key_salt, row.recovery_key_hash))) {
    return false;
  }

  const credentials = await makePasswordHash(newPassword);
  database.exec("BEGIN IMMEDIATE;");
  try {
    const result = database.prepare(`
      UPDATE users SET password_salt = ?, password_hash = ?
      WHERE id = ? AND recovery_key_salt = ? AND recovery_key_hash = ?
    `).run(credentials.salt, credentials.hash, row.id, row.recovery_key_salt, row.recovery_key_hash);

    if (result.changes === 0) {
      database.exec("ROLLBACK;");
      return false;
    }

    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id);
    database.exec("COMMIT;");
    return true;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export interface UserSearchFilters {
  search?: string;
  uid?: number;
  username?: string;
  email?: string;
  role?: UserRole;
  createdFrom?: string;
  createdTo?: string;
}

export interface ManagedUserInput {
  username: string;
  email: string | null;
  role: AssignableUserRole;
  password: string;
}

export interface ManagedUserUpdate {
  username: string;
  email: string | null;
  role?: AssignableUserRole;
}

function assertSuperAdmin(userId: string): void {
  const row = database.prepare("SELECT is_super_admin FROM users WHERE id = ?").get(userId) as { is_super_admin: number } | undefined;
  if (row?.is_super_admin !== 1) {
    throw new ApiError(403, "super_admin_required", "只有超级管理员可以管理账户。");
  }
}

function allocateUid(): number {
  // 创建调用先持有 BEGIN IMMEDIATE，分配与插入在同一事务中完成，并始终取最小空号。
  const rows = database.prepare("SELECT uid FROM users ORDER BY uid ASC").all() as Array<{ uid: number }>;
  const used = new Set(rows.map((row) => row.uid));
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

function normalizeEmail(email: string | null): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length ? normalized : null;
}

function assertAccountFieldsAvailable(username: string, email: string | null, exceptId?: string): void {
  const usernameConflict = database.prepare(`
    SELECT id FROM users WHERE username = ? AND id != COALESCE(?, '') LIMIT 1
  `).get(username, exceptId ?? "") as { id: string } | undefined;
  if (usernameConflict) throw new ApiError(409, "username_already_exists", "这个用户名已被使用。");

  if (email) {
    const emailConflict = database.prepare(`
      SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != COALESCE(?, '') LIMIT 1
    `).get(email, exceptId ?? "") as { id: string } | undefined;
    if (emailConflict) throw new ApiError(409, "email_already_exists", "这个邮箱已关联其他账户。");
  }
}

function accountSelectSql(conditions: string[]): string {
  return `SELECT id, uid, username, email, role, is_super_admin, created_at FROM users${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""} ORDER BY uid ASC`;
}

export function searchUsers(superAdminId: string, filters: UserSearchFilters): PublicUser[] {
  assertSuperAdmin(superAdminId);
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  const search = filters.search?.trim();
  if (search) {
    const searchConditions = [
      "instr(lower(username), lower(?)) > 0",
      "instr(lower(COALESCE(email, '')), lower(?)) > 0"
    ];
    values.push(search, search);
    if (/^\d+$/u.test(search)) {
      const uid = Number(search);
      if (Number.isSafeInteger(uid)) {
        searchConditions.push("uid = ?");
        values.push(uid);
      }
    }
    conditions.push(`(${searchConditions.join(" OR ")})`);
  }

  if (filters.uid !== undefined) {
    conditions.push("uid = ?");
    values.push(filters.uid);
  }
  if (filters.username) {
    conditions.push("instr(lower(username), lower(?)) > 0");
    values.push(filters.username);
  }
  if (filters.email) {
    conditions.push("instr(lower(COALESCE(email, '')), lower(?)) > 0");
    values.push(filters.email);
  }
  if (filters.role === "super_admin") {
    conditions.push("is_super_admin = 1");
  } else if (filters.role) {
    conditions.push("is_super_admin = 0 AND role = ?");
    values.push(filters.role);
  }
  if (filters.createdFrom) {
    conditions.push("created_at >= ?");
    values.push(filters.createdFrom);
  }
  if (filters.createdTo) {
    conditions.push("created_at <= ?");
    values.push(filters.createdTo);
  }

  const rows = database.prepare(accountSelectSql(conditions)).all(...values) as unknown as AccountRow[];
  return rows.map(toPublicAccount);
}

export async function createManagedUser(superAdminId: string, input: ManagedUserInput): Promise<PublicUser> {
  validateStrongCredential(input.password, "初始密码");
  const username = input.username.trim();
  const email = normalizeEmail(input.email);
  const credentials = await makePasswordHash(input.password);

  database.exec("BEGIN IMMEDIATE;");
  try {
    assertSuperAdmin(superAdminId);
    assertAccountFieldsAvailable(username, email);
    const user: PublicUser = {
      id: randomUUID(),
      uid: allocateUid(),
      username,
      email,
      role: input.role,
      createdAt: new Date().toISOString()
    };
    database.prepare(`
      INSERT INTO users (id, uid, username, email, password_salt, password_hash, role, is_super_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(user.id, user.uid, user.username, user.email, credentials.salt, credentials.hash, input.role);
    database.exec("COMMIT;");
    return user;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function updateManagedUser(superAdminId: string, userId: string, input: ManagedUserUpdate): PublicUser {
  const username = input.username.trim();
  const email = normalizeEmail(input.email);

  database.exec("BEGIN IMMEDIATE;");
  try {
    assertSuperAdmin(superAdminId);
    const existing = database.prepare("SELECT id, uid, role, is_super_admin, created_at FROM users WHERE id = ?").get(userId) as {
      id: string; uid: number; role: AssignableUserRole; is_super_admin: number; created_at: string;
    } | undefined;
    if (!existing) throw new ApiError(404, "user_not_found", "找不到这个账户。");
    if (existing.is_super_admin === 1 && input.role !== undefined) {
      throw new ApiError(409, "super_admin_transfer_required", "超级管理员角色只能通过转移操作变更。");
    }
    assertAccountFieldsAvailable(username, email, userId);
    database.prepare(`
      UPDATE users SET username = ?, email = ?, role = COALESCE(?, role) WHERE id = ?
    `).run(username, email, input.role ?? null, userId);
    const updated = database.prepare(`
      SELECT id, uid, username, email, role, is_super_admin, created_at FROM users WHERE id = ?
    `).get(userId) as unknown as AccountRow | undefined;
    if (!updated) throw new ApiError(404, "user_not_found", "找不到这个账户。");
    database.exec("COMMIT;");
    return toPublicAccount(updated);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function deleteManagedUser(superAdminId: string, userId: string): void {
  database.exec("BEGIN IMMEDIATE;");
  try {
    assertSuperAdmin(superAdminId);
    if (userId === superAdminId) {
      throw new ApiError(409, "cannot_delete_self", "不能删除当前登录的超级管理员账户；请先转移超级管理员权限。");
    }
    const target = database.prepare("SELECT is_super_admin FROM users WHERE id = ?").get(userId) as { is_super_admin: number } | undefined;
    if (!target) throw new ApiError(404, "user_not_found", "找不到这个账户。");
    if (target.is_super_admin === 1) {
      throw new ApiError(409, "super_admin_transfer_required", "请先将超级管理员权限转移给其他账户，再删除此账户。");
    }
    database.prepare("DELETE FROM users WHERE id = ?").run(userId);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  // SQLite 身份撤销后清理该账户的文件配置与会话；文件失败时仍不能用旧身份访问。
  configuration.removeUser(userId);
  sessionRecords.removeUser(userId);
}

export function transferSuperAdmin(superAdminId: string, targetUserId: string): void {
  database.exec("BEGIN IMMEDIATE;");
  try {
    assertSuperAdmin(superAdminId);
    if (targetUserId === superAdminId) throw new ApiError(400, "invalid_super_admin_transfer", "请选择另一个账户接收超级管理员权限。");
    const target = database.prepare("SELECT id FROM users WHERE id = ?").get(targetUserId) as { id: string } | undefined;
    if (!target) throw new ApiError(404, "user_not_found", "找不到要接收权限的账户。");

    // 先在同一事务中降级原账户，再提升目标账户，避免唯一索引允许出现两个超级管理员。
    database.prepare("UPDATE users SET is_super_admin = 0, role = 'admin' WHERE id = ?").run(superAdminId);
    database.prepare("UPDATE users SET is_super_admin = 1, role = 'admin' WHERE id = ?").run(targetUserId);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
