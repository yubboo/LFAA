// 验证目标工具的输出格式、参数归一，以及在真实 Cordis 上下文里注册进工具表。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Context } from "@deepseek-ai/cordis";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GoalService } from "../src/service";
import { toolsPlugin } from "@lfaa/tools";
import { formatGoalLine, recentNotes, toCount, toolGoalPlugin } from "../src/index";

test("目标摘要带状态与进度，未设进度时明确标注", () => {
  assert.equal(
    formatGoalLine({ id: "g1", title: "补齐全局插件", status: "active", progress: { done: 2, total: 5 } }),
    "g1 · [active] 补齐全局插件（2/5）",
  );
  assert.equal(
    formatGoalLine({ id: "g2", title: "巡检", status: "blocked", progress: { done: 0, total: 0 } }),
    "g2 · [blocked] 巡检（未设进度）",
  );
});

test("进展只回最近几条，且至少保留一条", () => {
  const log = [1, 2, 3, 4, 5, 6].map((at) => ({ at, note: `n${at}` }));
  assert.deepEqual(recentNotes(log, 2), ["n5", "n6"]);
  assert.deepEqual(recentNotes(log, 0), ["n6"]);
});

test("数字参数兼容字符串，非法值返回 undefined", () => {
  assert.equal(toCount(3), 3);
  assert.equal(toCount("2"), 2);
  assert.equal(toCount("abc"), undefined);
  assert.equal(toCount(undefined), undefined);
});

test("三个目标工具真实注册进工具表", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-tool-goal-"));
  try {
    const ctx = new Context();
    new GoalService(ctx, { storeFilePath: join(dir, "goals.json") });
    await ctx.plugin(toolsPlugin);
    await ctx.plugin(toolGoalPlugin);
    const names = ctx.tools.getLlmToolSchemas().map((schema) => schema.name);
    assert.deepEqual(
      names.filter((name) => name.startsWith("goal_")).sort(),
      ["goal_create", "goal_list", "goal_update"],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});