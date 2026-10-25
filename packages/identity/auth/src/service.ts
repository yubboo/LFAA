/**
 * 功能：实现账户、角色和登录会话的持久化业务规则。
 * 作用：安全保存登录密码与恢复密钥哈希，初始化唯一超级管理员，并提供登录、密码找回和会话校验。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/credentials/authorization/src/middleware.ts、packages/identity/auth/src/password-policy.ts。
 */
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
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

/** 后台任务每次派发时读取当前角色；不继承过期角色或已删除账户。 */
export function resolveUserRole(userId: string): UserRole | null {
  const row = database.prepare("SELECT role,is_super_admin FROM users WHERE id=?").get(userId) as { role: AssignableUserRole; is_super_admin: number } | undefined;
  return row ? row.is_super_admin === 1 ? "super_admin" : row.role : null;
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

export interface TrustedContactRecord { id: string; username: string; role: UserRole; createdAt: string }
export interface TrustedRecoveryRequestRecord { id: string; requesterUsername: string; createdAt: string; expiresAt: string; approvedAt: string | null }
type TrustedContactUserRow = Pick<AccountRow, "id" | "username" | "role" | "is_super_admin" | "created_at">;

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

/** 空数据库只种入一次可更改的本机默认管理员；已有账户时绝不覆盖或重置。 */
export async function ensureDefaultAdminAccount(): Promise<void> {
  if (!requiresInitialSetup()) return;
  const credentials = await makePasswordHash("123456");
  database.exec("BEGIN IMMEDIATE;");
  try {
    if (!requiresInitialSetup()) {
      database.exec("COMMIT;");
      return;
    }
    const user: PublicUser = {
      id: randomUUID(),
      uid: 1,
      username: "admin",
      email: null,
      role: "super_admin",
      createdAt: new Date().toISOString()
    };
    database.prepare(`
      INSERT INTO users (id, uid, username, password_salt, password_hash, role, is_super_admin, default_username_pending, default_password_pending)
      VALUES (?, 1, ?, ?, ?, 'admin', 1, 1, 1)
    `).run(user.id, user.username, credentials.salt, credentials.hash);
    database.exec("COMMIT;");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
}

export interface DefaultCredentialReminder {
  usernamePending: boolean;
  passwordPending: boolean;
}

export function getDefaultCredentialReminder(userId: string): DefaultCredentialReminder {
  const row = database.prepare("SELECT default_username_pending, default_password_pending FROM users WHERE id = ?").get(userId) as
    | { default_username_pending: number; default_password_pending: number }
    | undefined;
  return row
    ? { usernamePending: row.default_username_pending === 1, passwordPending: row.default_password_pending === 1 }
    : { usernamePending: false, passwordPending: false };
}

export function dismissDefaultCredentialReminder(userId: string): void {
  database.prepare("UPDATE users SET default_username_pending = 0, default_password_pending = 0 WHERE id = ?").run(userId);
}

export async function updateOwnUsername(userId: string, currentPassword: string, requestedUsername: string): Promise<PublicUser | null> {
  const username = requestedUsername.trim();
  if (username.length < 3 || username.length > 32 || !/^[\p{L}\p{N}_.-]+$/u.test(username)) {
    throw new ApiError(400, "invalid_username", "用户名需为 3 到 32 个字符，可使用文字、数字、句点、下划线和连字符。");
  }
  const existing = database.prepare("SELECT password_salt, password_hash FROM users WHERE id = ?").get(userId) as
    | Pick<UserRow, "password_salt" | "password_hash">
    | undefined;
  if (!existing || !(await passwordMatches(currentPassword, existing.password_salt, existing.password_hash))) return null;

  database.exec("BEGIN IMMEDIATE;");
  try {
    const fresh = database.prepare("SELECT password_salt, password_hash FROM users WHERE id = ?").get(userId) as
      | Pick<UserRow, "password_salt" | "password_hash">
      | undefined;
    if (!fresh || fresh.password_salt !== existing.password_salt || fresh.password_hash !== existing.password_hash) {
      database.exec("ROLLBACK;");
      return null;
    }
    assertAccountFieldsAvailable(username, null, userId);
    database.prepare("UPDATE users SET username = ?, default_username_pending = 0 WHERE id = ?").run(username, userId);
    const updated = database.prepare("SELECT id, uid, username, email, role, is_super_admin, created_at FROM users WHERE id = ?").get(userId) as unknown as AccountRow | undefined;
    if (!updated) throw new ApiError(404, "user_not_found", "找不到这个账户。");
    database.exec("COMMIT;");
    return toPublicAccount(updated);
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
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
      UPDATE users SET password_salt = ?, password_hash = ?, default_password_pending = 0
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

const trustedContactLimit = 10;
const trustedContactInviteLifetimeMs = 24 * 60 * 60 * 1000;
const trustedRecoveryLifetimeMs = 30 * 60 * 1000;
function trustedCodeHash(code: string): string { return createHash("sha256").update(code).digest("hex"); }
function trustedCodeIsValid(code: string): boolean { return typeof code === "string" && /^[A-Za-z0-9_-]{32,64}$/u.test(code); }

/** 创建仅供用户手动转交的本机联系人邀请；明文 code 只返回一次，不写日志或设置。 */
export function createTrustedContactInvitation(userId: string): { code: string; expiresAt: string } {
  if (!database.prepare("SELECT id FROM users WHERE id = ?").get(userId)) throw new ApiError(404, "account_not_found", "找不到当前账户。");
  const active = Number((database.prepare("SELECT COUNT(*) AS count FROM account_trusted_contacts WHERE owner_user_id = ?").get(userId) as { count: number | bigint }).count);
  if (active >= trustedContactLimit) throw new ApiError(409, "trusted_contact_limit", `每个账户最多设置 ${trustedContactLimit} 位受信联系人。`);
  const pending = Number((database.prepare("SELECT COUNT(*) AS count FROM account_trusted_contact_invites WHERE owner_user_id = ? AND accepted_at IS NULL AND expires_at > ?").get(userId, new Date().toISOString()) as { count: number | bigint }).count);
  if (pending >= 5) throw new ApiError(409, "trusted_contact_invite_limit", "当前账户有 5 个未使用邀请；等待过期或先重新生成邀请。");
  const code = randomBytes(24).toString("base64url"), createdAt = new Date(), expiresAt = new Date(createdAt.getTime() + trustedContactInviteLifetimeMs).toISOString();
  database.prepare("INSERT INTO account_trusted_contact_invites (id, owner_user_id, code_sha256, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), userId, trustedCodeHash(code), createdAt.toISOString(), expiresAt);
  return { code, expiresAt };
}

/** 受邀账户通过用户手动输入的一次性 code 接受关系；关系只授权恢复协助，不共享账户内容。 */
export function acceptTrustedContactInvitation(userId: string, code: string): TrustedContactRecord | null {
  if (!trustedCodeIsValid(code)) return null;
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE;");
  try {
    const invite = database.prepare("SELECT id, owner_user_id FROM account_trusted_contact_invites WHERE code_sha256 = ? AND accepted_at IS NULL AND expires_at > ?")
      .get(trustedCodeHash(code), now) as { id: string; owner_user_id: string } | undefined;
    if (!invite || invite.owner_user_id === userId || !database.prepare("SELECT id FROM users WHERE id = ?").get(userId)) { database.exec("ROLLBACK;"); return null; }
    const existing = database.prepare("SELECT owner_user_id FROM account_trusted_contacts WHERE owner_user_id = ? AND contact_user_id = ?").get(invite.owner_user_id, userId);
    if (!existing) {
      const count = Number((database.prepare("SELECT COUNT(*) AS count FROM account_trusted_contacts WHERE owner_user_id = ?").get(invite.owner_user_id) as { count: number | bigint }).count);
      if (count >= trustedContactLimit) { database.exec("ROLLBACK;"); return null; }
      database.prepare("INSERT INTO account_trusted_contacts (owner_user_id, contact_user_id, created_at) VALUES (?, ?, ?)").run(invite.owner_user_id, userId, now);
    }
    database.prepare("UPDATE account_trusted_contact_invites SET accepted_by_user_id = ?, accepted_at = ? WHERE id = ? AND accepted_at IS NULL").run(userId, now, invite.id);
    const contact = database.prepare("SELECT id, username, role, is_super_admin, created_at FROM users WHERE id = ?").get(userId) as (AccountRow & { id: string }) | undefined;
    database.exec("COMMIT;");
    return contact ? { id: contact.id, username: contact.username, role: contact.is_super_admin === 1 ? "super_admin" : contact.role, createdAt: now } : null;
  } catch (error) { if (database.isTransaction) database.exec("ROLLBACK;"); throw error; }
}

/** 仅返回此账户主动信任的本机账户及信任此账户的待处理恢复请求，不公开任何 code/hash。 */
export function listTrustedContactSettings(userId: string): { contacts: TrustedContactRecord[]; trustedBy: TrustedContactRecord[]; recoveryRequests: TrustedRecoveryRequestRecord[] } {
  const contacts = database.prepare(`SELECT users.id, users.username, users.role, users.is_super_admin, account_trusted_contacts.created_at
    FROM account_trusted_contacts JOIN users ON users.id = account_trusted_contacts.contact_user_id
    WHERE account_trusted_contacts.owner_user_id = ? ORDER BY account_trusted_contacts.created_at, users.uid LIMIT ?`).all(userId, trustedContactLimit) as unknown as TrustedContactUserRow[];
  const recoveryRequests = database.prepare(`SELECT request.id, owner.username AS requester_username, request.created_at, request.expires_at, request.approved_at
    FROM account_trusted_recovery_requests AS request
    JOIN users AS owner ON owner.id = request.owner_user_id
    JOIN account_trusted_contacts AS relation ON relation.owner_user_id = request.owner_user_id AND relation.contact_user_id = request.contact_user_id
    WHERE request.contact_user_id = ? AND request.completed_at IS NULL AND request.expires_at > ?
    ORDER BY request.created_at, request.id LIMIT 50`).all(userId, new Date().toISOString()) as Array<{ id: string; requester_username: string; created_at: string; expires_at: string; approved_at: string | null }>;
  const trustedBy = database.prepare(`SELECT users.id, users.username, users.role, users.is_super_admin, relation.created_at
    FROM account_trusted_contacts AS relation JOIN users ON users.id = relation.owner_user_id
    WHERE relation.contact_user_id = ? ORDER BY relation.created_at, users.uid LIMIT 50`).all(userId) as unknown as TrustedContactUserRow[];
  return {
    contacts: contacts.map(contact => ({ id: contact.id, username: contact.username, role: contact.is_super_admin === 1 ? "super_admin" : contact.role, createdAt: contact.created_at })),
    trustedBy: trustedBy.map(contact => ({ id: contact.id, username: contact.username, role: contact.is_super_admin === 1 ? "super_admin" : contact.role, createdAt: contact.created_at })),
    recoveryRequests: recoveryRequests.map(request => ({ id: request.id, requesterUsername: request.requester_username, createdAt: request.created_at, expiresAt: request.expires_at, approvedAt: request.approved_at }))
  };
}

/** 取消一条单向本机恢复关系，同时让其未完成的恢复请求失效。 */
export function removeTrustedContact(userId: string, contactUserId: string): boolean {
  database.exec("BEGIN IMMEDIATE;");
  try {
    const result = database.prepare("DELETE FROM account_trusted_contacts WHERE (owner_user_id = ? AND contact_user_id = ?) OR (owner_user_id = ? AND contact_user_id = ?)").run(userId, contactUserId, contactUserId, userId);
    if (Number(result.changes) > 0) database.prepare("DELETE FROM account_trusted_recovery_requests WHERE ((owner_user_id = ? AND contact_user_id = ?) OR (owner_user_id = ? AND contact_user_id = ?)) AND completed_at IS NULL").run(userId, contactUserId, contactUserId, userId);
    database.exec("COMMIT;");
    return Number(result.changes) === 1;
  } catch (error) { if (database.isTransaction) database.exec("ROLLBACK;"); throw error; }
}

/** 公共登录恢复入口总是返回随机 code；只有用户名与指定受信联系人匹配时才持久化挑战。 */
export function startTrustedAccountRecovery(username: string, contactUsername: string): { code: string; expiresAt: string } {
  const code = randomBytes(24).toString("base64url"), now = new Date(), expiresAt = new Date(now.getTime() + trustedRecoveryLifetimeMs).toISOString();
  const account = database.prepare(`SELECT owner.id AS owner_id, contact.id AS contact_id
    FROM users AS owner JOIN users AS contact ON lower(contact.username) = lower(?)
    JOIN account_trusted_contacts AS relation ON relation.owner_user_id = owner.id AND relation.contact_user_id = contact.id
    WHERE lower(owner.username) = lower(?) AND owner.id <> contact.id LIMIT 1`).get(contactUsername.trim(), username.trim()) as { owner_id: string; contact_id: string } | undefined;
  if (account) {
    const active = Number((database.prepare("SELECT COUNT(*) AS count FROM account_trusted_recovery_requests WHERE owner_user_id = ? AND contact_user_id = ? AND completed_at IS NULL AND expires_at > ?").get(account.owner_id, account.contact_id, now.toISOString()) as { count: number | bigint }).count);
    if (active < 3) database.prepare(`INSERT INTO account_trusted_recovery_requests (id, owner_user_id, contact_user_id, code_sha256, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(randomUUID(), account.owner_id, account.contact_id, trustedCodeHash(code), now.toISOString(), expiresAt);
  }
  return { code, expiresAt };
}

/** 用户可用自己保存的 request code 查看审批状态；未知 code 使用伪盐承担同级 scrypt 工作。 */
export async function getTrustedAccountRecoveryStatus(code: string): Promise<"pending" | "approved" | null> {
  if (!trustedCodeIsValid(code)) { await scryptAsync(String(code ?? ""), "lfaa-invalid-trusted-recovery-code", passwordKeyLength); return null; }
  const row = database.prepare("SELECT approved_at FROM account_trusted_recovery_requests WHERE code_sha256 = ? AND completed_at IS NULL AND expires_at > ?")
    .get(trustedCodeHash(code), new Date().toISOString()) as { approved_at: string | null } | undefined;
  return row ? row.approved_at ? "approved" : "pending" : null;
}

/** 当前受信联系人可批准精确的一条仍有效请求；回读不返回挑战 code。 */
export function approveTrustedAccountRecovery(contactUserId: string, requestId: string): TrustedRecoveryRequestRecord | null {
  const now = new Date().toISOString();
  const changed = database.prepare(`UPDATE account_trusted_recovery_requests SET approved_at = ?
    WHERE id = ? AND contact_user_id = ? AND completed_at IS NULL AND approved_at IS NULL AND expires_at > ?
      AND EXISTS (SELECT 1 FROM account_trusted_contacts WHERE owner_user_id = account_trusted_recovery_requests.owner_user_id AND contact_user_id = ?)`)
    .run(now, requestId, contactUserId, now, contactUserId);
  if (Number(changed.changes) !== 1) return null;
  const request = database.prepare(`SELECT request.id, owner.username AS requester_username, request.created_at, request.expires_at, request.approved_at
    FROM account_trusted_recovery_requests AS request JOIN users AS owner ON owner.id = request.owner_user_id WHERE request.id = ? AND request.contact_user_id = ?`)
    .get(requestId, contactUserId) as { id: string; requester_username: string; created_at: string; expires_at: string; approved_at: string | null } | undefined;
  return request ? { id: request.id, requesterUsername: request.requester_username, createdAt: request.created_at, expiresAt: request.expires_at, approvedAt: request.approved_at } : null;
}

/** 仅已批准的 code 可重置指定账户密码；同一 SQLite 事务消费挑战并撤销旧登录会话。 */
export async function completeTrustedAccountRecovery(code: string, newPassword: string): Promise<string | null | false> {
  validateStrongCredential(newPassword, "新密码");
  if (!trustedCodeIsValid(code) || newPassword === code) return null;
  const now = new Date().toISOString();
  const request = database.prepare(`SELECT id, owner_user_id FROM account_trusted_recovery_requests
    WHERE code_sha256 = ? AND approved_at IS NOT NULL AND completed_at IS NULL AND expires_at > ?`)
    .get(trustedCodeHash(code), now) as { id: string; owner_user_id: string } | undefined;
  if (!request) { await scryptAsync(code, "lfaa-invalid-trusted-recovery-code", passwordKeyLength); return false; }
  const credentials = await makePasswordHash(newPassword);
  database.exec("BEGIN IMMEDIATE;");
  try {
    const consumed = database.prepare(`UPDATE account_trusted_recovery_requests SET completed_at = ?
      WHERE id = ? AND approved_at IS NOT NULL AND completed_at IS NULL AND expires_at > ?`).run(now, request.id, now);
    if (Number(consumed.changes) !== 1) { database.exec("ROLLBACK;"); return null; }
    const updated = database.prepare("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?").run(credentials.salt, credentials.hash, request.owner_user_id);
    if (Number(updated.changes) !== 1) { database.exec("ROLLBACK;"); return null; }
    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(request.owner_user_id);
    database.exec("COMMIT;");
    return request.owner_user_id;
  } catch (error) { if (database.isTransaction) database.exec("ROLLBACK;"); throw error; }
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
