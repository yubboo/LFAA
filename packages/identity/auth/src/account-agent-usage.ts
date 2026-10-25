/**
 * 功能：管理普通账户的 Agent 使用时段与每日时长。
 * 作用：为管理员设置中心、Agent 工具和 Agent 执行链提供唯一的策略、用量与并发预留 Owner。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/core/agent-loop/src/execute-turn.ts。
 */
import { database } from "lfaa-storage-sqlite/src/database.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { hasAdminAccess, resolveUserRole } from "./service.js";

export interface AccountAgentUsageWindow {
  enabled: boolean;
  start: string;
  end: string;
}

export interface AccountAgentUsagePolicy {
  enabled: boolean;
  timezone: string;
  dailyLimitMinutes: number;
  /** Sunday-first, matching JavaScript's local weekday numbering. */
  weeklyWindows: AccountAgentUsageWindow[];
}

export interface AccountAgentUsageAccount {
  id: string;
  username: string;
  role: "admin" | "member";
}

interface PolicyRow { policy_json: string; updated_at: string; }
interface UserRow { id: string; username: string; role: "admin" | "member"; is_super_admin: number; }

export const DEFAULT_ACCOUNT_AGENT_USAGE_POLICY: AccountAgentUsagePolicy = {
  enabled: false,
  timezone: "Asia/Shanghai",
  dailyLimitMinutes: 120,
  weeklyWindows: Array.from({ length: 7 }, () => ({ enabled: false, start: "09:00", end: "21:00" }))
};

function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}

function requireManager(actorId: string): void {
  const role = resolveUserRole(actorId);
  if (!role) fail(401, "account_agent_usage_actor_missing", "当前账户不存在或已停用。");
  if (!hasAdminAccess(role)) fail(403, "account_agent_usage_admin_required", "只有管理员可以管理其他账户的 Agent 使用限制。");
}

function managedMember(actorId: string, targetId: string): UserRow {
  requireManager(actorId);
  const row = database.prepare("SELECT id,username,role,is_super_admin FROM users WHERE id=?").get(targetId) as UserRow | undefined;
  if (!row) fail(404, "account_agent_usage_target_missing", "找不到要管理的账户。");
  if (row.is_super_admin === 1 || row.role !== "member") fail(403, "account_agent_usage_target_not_member", "家长控制只适用于普通成员账户，不能修改管理员账户。");
  return row;
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value);
}

export function validateAccountAgentUsagePolicy(value: unknown): AccountAgentUsagePolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(400, "account_agent_usage_policy_invalid", "家长控制策略格式不正确。");
  const policy = value as Partial<AccountAgentUsagePolicy>;
  if (typeof policy.enabled !== "boolean" || typeof policy.timezone !== "string" || !Number.isInteger(policy.dailyLimitMinutes)
    || (policy.dailyLimitMinutes ?? 0) < 1 || (policy.dailyLimitMinutes ?? 0) > 1440
    || !Array.isArray(policy.weeklyWindows) || policy.weeklyWindows.length !== 7) {
    fail(400, "account_agent_usage_policy_invalid", "请设置有效的启用状态、时区、每日时长（1 至 1440 分钟）和一周 7 天时段。");
  }
  try { new Intl.DateTimeFormat("en", { timeZone: policy.timezone }).format(0); }
  catch { fail(400, "account_agent_usage_timezone_invalid", "请填写有效的 IANA 时区名称。"); }
  const weeklyWindows = policy.weeklyWindows.map((window, index) => {
    if (!window || typeof window !== "object" || typeof window.enabled !== "boolean" || !isValidTime(window.start) || !isValidTime(window.end) || window.start === window.end) {
      fail(400, "account_agent_usage_window_invalid", `第 ${index + 1} 天的使用时段无效；开始和结束时间不能相同。`);
    }
    return { enabled: window.enabled, start: window.start, end: window.end };
  });
  return { enabled: policy.enabled as boolean, timezone: policy.timezone as string, dailyLimitMinutes: policy.dailyLimitMinutes as number, weeklyWindows };
}

function readPolicy(userId: string): { policy: AccountAgentUsagePolicy; updatedAt: string | null } {
  const row = database.prepare("SELECT policy_json,updated_at FROM account_agent_usage_policies WHERE user_id=?").get(userId) as PolicyRow | undefined;
  if (!row) return { policy: DEFAULT_ACCOUNT_AGENT_USAGE_POLICY, updatedAt: null };
  try { return { policy: validateAccountAgentUsagePolicy(JSON.parse(row.policy_json)), updatedAt: row.updated_at }; }
  catch { throw new Error(`账户 ${userId} 的家长控制策略损坏；为避免绕过限制，已拒绝读取。`); }
}

function dateKey(date: Date, timezone: string): string {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => values.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localClock(date: Date, timezone: string): { weekday: number; minute: number; date: string } {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => values.find(item => item.type === type)?.value ?? "0";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { weekday: weekdays.indexOf(get("weekday")), minute: Number(get("hour")) * 60 + Number(get("minute")), date: dateKey(date, timezone) };
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function wallTimeEpoch(date: string, clock: string, timezone: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  const desired = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);
  let candidate = desired;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const get = (type: string) => parts.find(item => item.type === type)?.value ?? "0";
    const localAsUtc = Date.parse(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.000Z`);
    const correction = desired - localAsUtc;
    if (correction === 0) return candidate;
    candidate += correction;
  }
  return candidate;
}

function activeWindowEnd(policy: AccountAgentUsagePolicy, now: Date): number | null {
  const current = localClock(now, policy.timezone);
  const today = policy.weeklyWindows[current.weekday];
  const yesterdayIndex = (current.weekday + 6) % 7;
  const yesterday = policy.weeklyWindows[yesterdayIndex];
  const minuteText = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

  if (today.enabled) {
    const start = minuteText(today.start);
    const end = minuteText(today.end);
    if (start < end && current.minute >= start && current.minute < end) return wallTimeEpoch(current.date, today.end, policy.timezone);
    if (start > end && current.minute >= start) return wallTimeEpoch(shiftDate(current.date, 1), today.end, policy.timezone);
  }
  if (yesterday.enabled && minuteText(yesterday.start) > minuteText(yesterday.end) && current.minute < minuteText(yesterday.end)) {
    return wallTimeEpoch(current.date, yesterday.end, policy.timezone);
  }
  return null;
}

function commitExpiredReservations(userId: string, today: string, nowMs: number): void {
  const rows = database.prepare(`SELECT run_id,local_date,started_at_ms,expires_at_ms,reserved_seconds
    FROM account_agent_usage_reservations WHERE user_id=? AND (expires_at_ms<=? OR local_date<>?)`).all(userId, nowMs, today) as Array<{ run_id: string; local_date: string; started_at_ms: number; expires_at_ms: number; reserved_seconds: number }>;
  for (const row of rows) {
    const seconds = Math.min(row.reserved_seconds, Math.ceil(Math.max(0, row.expires_at_ms - row.started_at_ms) / 1000));
    database.prepare(`INSERT INTO account_agent_usage_daily(user_id,local_date,used_seconds) VALUES(?,?,?)
      ON CONFLICT(user_id,local_date) DO UPDATE SET used_seconds=used_seconds+excluded.used_seconds,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(userId, row.local_date, seconds);
    database.prepare("DELETE FROM account_agent_usage_reservations WHERE user_id=? AND run_id=?").run(userId, row.run_id);
  }
}

export function listManagedAgentUsageAccounts(actorId: string): AccountAgentUsageAccount[] {
  requireManager(actorId);
  return database.prepare("SELECT id,username,role FROM users WHERE is_super_admin=0 AND role='member' ORDER BY uid ASC").all() as unknown as AccountAgentUsageAccount[];
}

export function getAgentUsageControls(actorId: string, targetId = actorId): { account: { id: string; username: string; role: "admin" | "member" }; policy: AccountAgentUsagePolicy; updatedAt: string | null; usedSeconds: number; localDate: string; activeReservations: number } {
  const actorRole = resolveUserRole(actorId);
  if (!actorRole) fail(401, "account_agent_usage_actor_missing", "当前账户不存在或已停用。");
  let account: UserRow | undefined;
  if (targetId === actorId) account = database.prepare("SELECT id,username,role,is_super_admin FROM users WHERE id=?").get(targetId) as UserRow | undefined;
  else account = managedMember(actorId, targetId);
  if (!account) fail(404, "account_agent_usage_target_missing", "找不到要查看的账户。");
  if (targetId === actorId && !hasAdminAccess(actorRole)) account.role = "member";
  const { policy, updatedAt } = readPolicy(targetId);
  const date = dateKey(new Date(), policy.timezone);
  const usage = database.prepare("SELECT used_seconds FROM account_agent_usage_daily WHERE user_id=? AND local_date=?").get(targetId, date) as { used_seconds: number } | undefined;
  const active = database.prepare("SELECT COUNT(*) AS count FROM account_agent_usage_reservations WHERE user_id=? AND local_date=?").get(targetId, date) as { count: number | bigint };
  return { account: { id: account.id, username: account.username, role: account.is_super_admin === 1 ? "admin" : account.role }, policy, updatedAt, usedSeconds: usage?.used_seconds ?? 0, localDate: date, activeReservations: Number(active.count) };
}

export function saveAgentUsagePolicy(actorId: string, targetId: string, input: unknown): ReturnType<typeof getAgentUsageControls> {
  const account = managedMember(actorId, targetId);
  const policy = validateAccountAgentUsagePolicy(input);
  database.prepare(`INSERT INTO account_agent_usage_policies(user_id,updated_by,policy_json,updated_at)
    VALUES(?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id) DO UPDATE SET updated_by=excluded.updated_by,policy_json=excluded.policy_json,updated_at=excluded.updated_at`)
    .run(targetId, actorId, JSON.stringify(policy));
  return getAgentUsageControls(actorId, account.id);
}

export type AgentUsageReservation = { enforced: false } | { enforced: true; allowed: false; reason: string; localDate: string } | { enforced: true; allowed: true; leaseId: string; maxDurationMs: number; localDate: string };

export function reserveAgentUsage(userId: string, runId: string, nowMs = Date.now()): AgentUsageReservation {
  const { policy } = readPolicy(userId);
  if (!policy.enabled) return { enforced: false };
  const now = new Date(nowMs);
  const current = localClock(now, policy.timezone);
  const end = activeWindowEnd(policy, now);
  if (end === null) return { enforced: true, allowed: false, reason: "当前不在家长控制允许的 Agent 使用时段内。", localDate: current.date };
  const cutoffMs = Math.min(end, nowMs + policy.dailyLimitMinutes * 60_000);
  database.exec("BEGIN IMMEDIATE;");
  try {
    commitExpiredReservations(userId, current.date, nowMs);
    const used = database.prepare("SELECT used_seconds FROM account_agent_usage_daily WHERE user_id=? AND local_date=?").get(userId, current.date) as { used_seconds: number } | undefined;
    const reserved = database.prepare("SELECT COALESCE(SUM(reserved_seconds),0) AS seconds FROM account_agent_usage_reservations WHERE user_id=? AND local_date=?").get(userId, current.date) as { seconds: number | bigint };
    const remaining = policy.dailyLimitMinutes * 60 - (used?.used_seconds ?? 0) - Number(reserved.seconds);
    const maxSeconds = Math.min(remaining, Math.floor((cutoffMs - nowMs) / 1000));
    if (maxSeconds < 1) {
      database.exec("COMMIT;");
      return { enforced: true, allowed: false, reason: remaining < 1 ? "今日 Agent 使用时长已达到家长控制上限。" : "当前允许的使用时段即将结束，剩余时间不足 1 秒。", localDate: current.date };
    }
    const leaseId = `${runId.slice(0, 130)}:${nowMs}`;
    database.prepare(`INSERT INTO account_agent_usage_reservations(user_id,run_id,local_date,started_at_ms,expires_at_ms,reserved_seconds)
      VALUES(?,?,?,?,?,?)`).run(userId, leaseId, current.date, nowMs, nowMs + maxSeconds * 1000, maxSeconds);
    database.exec("COMMIT;");
    return { enforced: true, allowed: true, leaseId, maxDurationMs: maxSeconds * 1000, localDate: current.date };
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
}

export function finishAgentUsageReservation(userId: string, leaseId: string, finishedAtMs = Date.now()): void {
  database.exec("BEGIN IMMEDIATE;");
  try {
    const row = database.prepare(`SELECT local_date,started_at_ms,expires_at_ms,reserved_seconds FROM account_agent_usage_reservations
      WHERE user_id=? AND run_id=?`).get(userId, leaseId) as { local_date: string; started_at_ms: number; expires_at_ms: number; reserved_seconds: number } | undefined;
    if (!row) { database.exec("COMMIT;"); return; }
    const seconds = Math.min(row.reserved_seconds, Math.ceil(Math.max(0, Math.min(finishedAtMs, row.expires_at_ms) - row.started_at_ms) / 1000));
    database.prepare(`INSERT INTO account_agent_usage_daily(user_id,local_date,used_seconds) VALUES(?,?,?)
      ON CONFLICT(user_id,local_date) DO UPDATE SET used_seconds=used_seconds+excluded.used_seconds,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(userId, row.local_date, seconds);
    database.prepare("DELETE FROM account_agent_usage_reservations WHERE user_id=? AND run_id=?").run(userId, leaseId);
    database.exec("COMMIT;");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
}
