// 验证目标服务的持久化往返、状态流转与进度归一。
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { Context } from "@deepseek-ai/cordis";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GoalService, normalizeGoalStatus, normalizeProgress, summarizeGoal } from "../src/index";

async function withService(task: (service: GoalService, dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-goal-"));
  try {
    await task(new GoalService(new Context(), { storeFilePath: join(dir, "goals.json") }), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("非法状态与负数进度被归一", () => {
  assert.equal(normalizeGoalStatus("complete"), "complete");
  assert.equal(normalizeGoalStatus("done"), undefined);
  assert.deepEqual(normalizeProgress(-3, 10), { done: 0, total: 10 });
  assert.deepEqual(normalizeProgress(99, 10), { done: 10, total: 10 });
  assert.deepEqual(normalizeProgress(2, 0), { done: 2, total: 0 });
});

test("新建目标写入文件，重新实例化后仍可读取", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-goal-"));
  try {
    const path = join(dir, "goals.json");
    const first = new GoalService(new Context(), { storeFilePath: path });
    const created = await first.create({ title: "全局插件", objective: "按清单补齐全局插件", total: 4 });
    assert.equal(created.status, "active");

    const second = new GoalService(new Context(), { storeFilePath: path });
    const listed = await second.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, created.id);
    assert.equal(summarizeGoal(listed[0]!), "[active] 全局插件（0/4）");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("更新追加进展、推进进度并支持完成与删除", async () => {
  await withService(async (service) => {
    const goal = await service.create({ title: "T", objective: "O", total: 3 });
    const advanced = await service.update(goal.id, { done: 1, note: "完成 web seam" });
    assert.equal(advanced.progress.done, 1);
    assert.equal(advanced.log.length, 1);
    assert.equal(advanced.log[0]?.note, "完成 web seam");

    const done = await service.update(goal.id, { status: "complete", done: 3, note: "全部完成" });
    assert.equal(done.status, "complete");
    assert.equal(done.progress.done, 3);
    assert.equal(done.log.at(-1)?.status, "complete");

    assert.equal(await service.remove(goal.id), true);
    assert.equal(await service.remove(goal.id), false);
    assert.deepEqual(await service.list(), []);
  });
});

test("按会话过滤与未知目标报错", async () => {
  await withService(async (service) => {
    await service.create({ title: "A", objective: "a", sessionId: "s1" });
    await service.create({ title: "B", objective: "b", sessionId: "s2" });
    assert.equal((await service.list({ sessionId: "s1" })).length, 1);
    await assert.rejects(() => service.update("missing", { note: "x" }), /目标不存在/u);
    await assert.rejects(() => service.create({ title: " ", objective: "x" }), /标题不能为空/u);
  });
});

test("自动续跑字段：默认值、暂停恢复、轮次推进与上限归一", async () => {
  await withService(async (service) => {
    const goal = await service.create({ title: "T", objective: "O" });
    assert.equal(goal.rounds, 0);
    assert.equal(goal.maxRounds, 10);
    assert.equal(goal.autoContinue, true);

    assert.equal((await service.update(goal.id, { autoContinue: false })).autoContinue, false);
    assert.equal((await service.update(goal.id, { autoContinue: true })).autoContinue, true);
    assert.equal((await service.update(goal.id, { maxRounds: 99 })).maxRounds, 50);
    assert.equal((await service.create({ title: "L", objective: "o", maxRounds: 3 })).maxRounds, 3);

    const advanced = await service.advanceRound(goal.id);
    assert.equal(advanced.rounds, 1);
    assert.equal(advanced.log.at(-1)?.note, "自动继续第 1 轮");
    assert.ok((advanced.lastContinuedAt ?? 0) > 0);
  });
});

test("旧 goals.json 缺少续跑字段时按默认值补齐", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-goal-"));
  try {
    const path = join(dir, "goals.json");
    await writeFile(path, JSON.stringify({
      version: 1,
      goals: [{
        id: "legacy",
        title: "旧目标",
        objective: "兼容旧数据",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
        progress: { done: 0, total: 0 },
        log: [],
      }],
    }), "utf8");
    const listed = await new GoalService(new Context(), { storeFilePath: path }).list();
    assert.equal(listed[0]?.rounds, 0);
    assert.equal(listed[0]?.maxRounds, 10);
    assert.equal(listed[0]?.autoContinue, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});