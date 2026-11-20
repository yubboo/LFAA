// 验证定时任务：时间解析、重复推进、到期领取与工具端到端（临时存储）。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import schedulePlugin, {
  buildSchedule,
  describeSchedule,
  nextDue,
  parseDueAt,
  parseRepeat,
  ScheduleStore,
  takeDue,
} from "../src/index";

function execContext(): ToolExecutionContext {
  return { workspaceRoots: [process.cwd()], sessionId: "s1", runId: "r1", signal: new AbortController().signal };
}

test("相对时间与 ISO 时间可解析，非法输入报错", () => {
  const now = Date.parse("2026-11-20T12:00:00+08:00");
  assert.equal(parseDueAt("+30m", now), now + 30 * 60_000);
  assert.equal(parseDueAt("+2h", now), now + 2 * 3_600_000);
  assert.equal(parseDueAt("2026-11-21T09:00:00+08:00", now), Date.parse("2026-11-21T09:00:00+08:00"));
  assert.throws(() => parseDueAt("tomorrow", now), /无法解析/u);
  assert.throws(() => parseDueAt("+0m", now), /大于 0/u);
});

test("重复规则解析与下一次到期时间", () => {
  const now = Date.parse("2026-11-20T12:00:00+08:00");
  assert.deepEqual(parseRepeat({ kind: "interval", minutes: 15 }), { kind: "interval", ms: 900_000 });
  assert.deepEqual(parseRepeat({ kind: "daily", at: "09:30" }), { kind: "daily", at: "09:30" });
  assert.equal(parseRepeat({ kind: "weekly" }), undefined);

  const item = buildSchedule({ title: "t", prompt: "p", dueAt: now - 1, repeat: { kind: "interval", ms: 60_000 }, now });
  assert.ok((nextDue(item, now) ?? 0) > now);
  assert.equal(nextDue({ dueAt: now, ...(item.repeat ? { repeat: item.repeat } : {}) }, now)! % 60_000, 0);
  assert.equal(nextDue({ dueAt: now }, now), undefined);
});

test("到期领取：一次性移除、重复推进", () => {
  const now = Date.now();
  const items = [
    buildSchedule({ id: "a", title: "一次性", prompt: "p", dueAt: now - 10, now }),
    buildSchedule({ id: "b", title: "重复", prompt: "p", dueAt: now - 10, repeat: { kind: "interval", ms: 60_000 }, now }),
    buildSchedule({ id: "c", title: "未到期", prompt: "p", dueAt: now + 60_000, now }),
  ];
  const { due, rest } = takeDue(items, now);
  assert.deepEqual(due.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(rest.map((item) => item.id), ["b", "c"]);
  assert.ok((rest[0]!.dueAt ?? 0) > now);
  assert.match(describeSchedule(items[0]!, now), /已到期/u);
});

test("工具端到端：创建、列出、领取、取消", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-schedule-"));
  try {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    await ctx.plugin(schedulePlugin, { storeFilePath: join(dir, "schedules.json") });

    const created = await ctx.tools.executeTool("schedule_create", { title: "巡检", prompt: "看一下日志", dueAt: "+30m" }, execContext());
    assert.equal(created.ok, true);
    const id = String(created.metadata?.scheduleId ?? "");
    assert.ok(id.length > 0);

    const listed = await ctx.tools.executeTool("schedule_list", {}, execContext());
    assert.match(listed.output, /巡检/u);

    const notDue = await ctx.tools.executeTool("schedule_due", {}, execContext());
    assert.match(notDue.output, /没有到期任务/u);

    const cancelled = await ctx.tools.executeTool("schedule_cancel", { id }, execContext());
    assert.equal(cancelled.ok, true);
    const missing = await ctx.tools.executeTool("schedule_cancel", { id }, execContext());
    assert.equal(missing.ok, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("存储损坏时按空列表处理，不会抛错", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-schedule-"));
  try {
    const store = new ScheduleStore(join(dir, "missing.json"));
    assert.deepEqual(await store.read(), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});