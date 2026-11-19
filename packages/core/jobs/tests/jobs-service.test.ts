// 验证 @lfaa/jobs 后台任务启动、输出读取、会话隔离、停止清理及 Cordis 生命周期。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { toolsPlugin } from "@lfaa/tools";
import { jobsPlugin } from "../src/index";

test("JobsService 支持启动后台任务、隔离会话读取与停止进程树", async (t) => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-jobs-test-"));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));

  const ctx = new Context();
  await ctx.plugin(toolsPlugin);
  const jobsFiber = ctx.plugin(jobsPlugin);
  await jobsFiber;

  const execCtx = {
    workspaceRoots: [workspace],
    sessionId: "sess-1",
    runId: "run-1",
    signal: new AbortController().signal,
  };

  // 启动一个持续输出的后台任务
  const startRes = await ctx.tools.executeTool(
    "start_background_task",
    {
      title: "后台心跳脚本",
      command: `"${process.execPath}" -e "console.log('中文启动'); setInterval(() => console.log('tick'), 120);"`,
    },
    execCtx,
  );
  assert.equal(startRes.ok, true);
  const started = JSON.parse(startRes.output) as { taskId: string; status: string };
  assert.equal(started.status, "running");

  await new Promise((r) => setTimeout(r, 350));

  const getRes = await ctx.tools.executeTool("get_background_task", { taskId: started.taskId }, execCtx);
  assert.equal(getRes.ok, true);
  assert.ok(getRes.output.includes("中文启动"));

  // 其他会话不能访问或停止 sess-1 的任务
  const crossRes = await ctx.tools.executeTool(
    "get_background_task",
    { taskId: started.taskId },
    { ...execCtx, sessionId: "sess-other" },
  );
  assert.equal(crossRes.ok, false);

  const stopRes = await ctx.tools.executeTool("stop_background_task", { taskId: started.taskId }, execCtx);
  assert.equal(stopRes.ok, true);
  await new Promise((r) => setTimeout(r, 200));
  const afterStop = ctx.jobs.getJob(started.taskId);
  assert.equal(afterStop?.status, "killed");

  await jobsFiber.dispose();
  assert.equal((ctx as { jobs?: unknown }).jobs, undefined);
  assert.equal(ctx.tools.getTool("start_background_task"), undefined);
});
