/**
 * 功能：验证家长控制策略、账户隔离、跨日时段和 Agent 用量预留。
 * 作用：在隔离 SQLite 数据库中验证权限边界和配额执行，不影响实际账户。
 * 关联文件：packages/identity/auth/src/account-agent-usage.ts、packages/core/agent-loop/src/execute-turn.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "account-agent-usage");
await import("lfaa-session-persistence-jsonl/src/repository.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const usage = await import("lfaa-identity-auth/src/account-agent-usage.js");
const adminId = randomUUID();
const memberId = randomUUID();
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,1,'usage-admin','fixture','fixture','admin',0)").run(adminId);
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,2,'usage-member','fixture','fixture','member',0)").run(memberId);

const makePolicy = ({ enabled = true, dailyLimitMinutes = 1, start = "00:00", end = "23:59" } = {}) => ({
  enabled,
  timezone: "UTC",
  dailyLimitMinutes,
  weeklyWindows: Array.from({ length: 7 }, () => ({ enabled: true, start, end }))
});

test("管理员可设置普通成员策略；成员不能读取或更改其他账户", () => {
  const saved = usage.saveAgentUsagePolicy(adminId, memberId, makePolicy());
  assert.equal(saved.account.id, memberId);
  assert.equal(saved.policy.dailyLimitMinutes, 1);
  assert.throws(() => usage.getAgentUsageControls(memberId, adminId), /只有管理员/u);
  assert.throws(() => usage.saveAgentUsagePolicy(memberId, memberId, makePolicy()), /管理员/u);
  assert.throws(() => usage.saveAgentUsagePolicy(adminId, adminId, makePolicy()), /普通成员/u);
  assert.throws(() => usage.validateAccountAgentUsagePolicy({ ...makePolicy(), timezone: "not/a-timezone" }), /IANA 时区/u);
});

test("Agent 日额度以事务预留，结束后按实际运行时间结算", () => {
  usage.saveAgentUsagePolicy(adminId, memberId, makePolicy());
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  const startedAt = start.getTime();
  const first = usage.reserveAgentUsage(memberId, "run-a", startedAt);
  assert.equal(first.enforced, true);
  assert.equal(first.allowed, true);
  if (!first.allowed) return;
  assert.equal(first.maxDurationMs, 60_000);
  const concurrent = usage.reserveAgentUsage(memberId, "run-b", startedAt);
  assert.equal(concurrent.enforced && !concurrent.allowed, true, "并行 Run 不能超过剩余日额度");
  usage.finishAgentUsageReservation(memberId, first.leaseId, startedAt + 25_000);
  const afterRelease = usage.reserveAgentUsage(memberId, "run-c", startedAt + 25_000);
  assert.equal(afterRelease.enforced && afterRelease.allowed, true);
  if (!afterRelease.allowed) return;
  assert.equal(afterRelease.maxDurationMs, 35_000);
  usage.finishAgentUsageReservation(memberId, afterRelease.leaseId, startedAt + 60_000);
  const row = database.prepare("SELECT used_seconds FROM account_agent_usage_daily WHERE user_id=? AND local_date=?").get(memberId, first.localDate);
  assert.equal(row.used_seconds, 60);
  const exhausted = usage.reserveAgentUsage(memberId, "run-d", startedAt + 61_000);
  assert.equal(exhausted.enforced && !exhausted.allowed, true);
});

test("关闭日期拒绝启动，跨午夜窗口按前一天日程延续", () => {
  usage.saveAgentUsagePolicy(adminId, memberId, { ...makePolicy(), weeklyWindows: Array.from({ length: 7 }, () => ({ enabled: false, start: "22:00", end: "02:00" })) });
  const offSchedule = usage.reserveAgentUsage(memberId, "run-off", Date.UTC(2026, 9, 24, 12));
  assert.equal(offSchedule.enforced && !offSchedule.allowed, true);

  usage.saveAgentUsagePolicy(adminId, memberId, { ...makePolicy({ dailyLimitMinutes: 60, start: "22:00", end: "02:00" }), weeklyWindows: Array.from({ length: 7 }, () => ({ enabled: true, start: "22:00", end: "02:00" })) });
  const overnight = usage.reserveAgentUsage(memberId, "run-night", Date.UTC(2026, 9, 24, 23));
  assert.equal(overnight.enforced && overnight.allowed, true);
  if (overnight.allowed) usage.finishAgentUsageReservation(memberId, overnight.leaseId, Date.UTC(2026, 9, 24, 23) + 1000);
  const beforeClose = usage.reserveAgentUsage(memberId, "run-before-close", Date.UTC(2026, 9, 25, 1, 59));
  assert.equal(beforeClose.enforced && beforeClose.allowed, true);
  if (beforeClose.allowed) usage.finishAgentUsageReservation(memberId, beforeClose.leaseId, Date.UTC(2026, 9, 25, 1, 59) + 1000);
  const afterClose = usage.reserveAgentUsage(memberId, "run-after-close", Date.UTC(2026, 9, 25, 2));
  assert.equal(afterClose.enforced && !afterClose.allowed, true);
});
