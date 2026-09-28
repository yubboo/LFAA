/**
 * 功能：实现账户、角色和登录会话的持久化业务规则。
 * 作用：安全保存登录密码与恢复密钥哈希，初始化唯一超级管理员，并提供登录、密码找回和会话校验。
 * 关联文件：server/src/database.ts、server/src/api/routes.ts、server/src/middleware/auth.ts、server/src/modules/auth/password-policy.ts。
 */
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { database } from "../../database.js";
import { ApiError } from "../../api/http-error.js";
import { isPasswordAcceptable } from "./password-policy.js";

const scryptAsync = promisify(scrypt);
const passwordKeyLength = 64;
export const sessionLifetimeSeconds = 8 * 60 * 60;

export type UserRole = "admin" | "member";

export interface PublicUser {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

interface UserRow {
  id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

interface SessionUserRow {
  session_id: string;
  user_id: string;
  username: string;
  role: UserRole;
  created_at: string;
}

interface AccountRow {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
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
    username: row.username,
    role: row.role,
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

export async function createInitialAdmin(username: string, password: string, recoveryKey: string): Promise<PublicUser> {
  validateStrongCredential(password, "密码");
  validateStrongCredential(recoveryKey, "恢复密钥");
  if (password === recoveryKey) {
    throw new ApiError(400, "credentials_must_differ", "恢复密钥必须与登录密码不同。");
  }

  const credentials = await makePasswordHash(password);
  const recoveryCredentials = await makePasswordHash(recoveryKey);
  const user: PublicUser = {
    id: randomUUID(),
    username: username.trim(),
    role: "admin",
    createdAt: new Date().toISOString()
  };

  database.exec("BEGIN IMMEDIATE;");
  try {
    if (!requiresInitialSetup()) {
      throw new ApiError(409, "setup_completed", "管理员账户已初始化，请使用登录表单。");
    }

    database.prepare(`
      INSERT INTO users (id, username, password_salt, password_hash, role, recovery_key_salt, recovery_key_hash)
      VALUES (?, ?, ?, ?, 'admin', ?, ?)
    `).run(user.id, user.username, credentials.salt, credentials.hash, recoveryCredentials.salt, recoveryCredentials.hash);
    database.exec("COMMIT;");
    return user;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export async function authenticateUser(username: string, password: string): Promise<PublicUser | null> {
  const row = database.prepare(`
    SELECT id, username, password_salt, password_hash, role, created_at
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

export function createSession(userId: string): { sessionId: string; expiresAt: number } {
  const sessionId = randomUUID();
  const expiresAt = Date.now() + sessionLifetimeSeconds * 1000;

  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  database.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(sessionId, userId, expiresAt);

  return { sessionId, expiresAt };
}

export function findActiveSession(sessionId: string): ActiveSession | null {
  const row = database.prepare(`
    SELECT sessions.id AS session_id, users.id AS user_id, users.username, users.role, users.created_at
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
      username: row.username,
      role: row.role,
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
    SELECT id, username, password_salt, password_hash, role, created_at
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

export function listUsers(): PublicUser[] {
  const rows = database.prepare(`
    SELECT id, username, role, created_at
    FROM users
    ORDER BY created_at ASC, username COLLATE NOCASE ASC
  `).all() as unknown as AccountRow[];

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at
  }));
}
