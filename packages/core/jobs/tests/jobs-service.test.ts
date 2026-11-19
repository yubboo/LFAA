// 验证 @lfaa/jobs 后台任务启动、输出读取、会话隔离、停止清理及 Cordis 生命周期。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { toolsPlugin } from "@lfaa/tools";
import { jobsPlugin } from "../src/index";

// 命令审计写入临时文件，避免测试污染用户目录。
process.env.LFAA_COMMAND_AUDIT_LOG = path.join(os.tmpdir(), `lfaa-jobs-audit-${process.pid}.jsonl`);

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
  // 进程树退出是异步的，轮询到终态而不是依赖固定等待，避免高负载下偶发失败。
  let afterStop = ctx.jobs.getJob(started.taskId);
  const stopDeadline = Date.now() + 5000;
  while (afterStop?.status === "running" && Date.now() < stopDeadline) {
    await new Promise((r) => setTimeout(r, 100));
    afterStop = ctx.jobs.getJob(started.taskId);
  }
  assert.equal(afterStop?.status, "killed");

  await jobsFiber.dispose();
  assert.equal((ctx as { jobs?: unknown }).jobs, undefined);
  assert.equal(ctx.tools.getTool("start_background_task"), undefined);
});

test("前台命令超时后由 JobsService 接管为后台任务", async (t) => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-jobs-timeout-"));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));

  const ctx = new Context();
  // 用可控的 Shell 替身模拟超时，验证真实 Tool -> Jobs 兜底链路。
  await ctx.plugin(toolsPlugin, {
    executeCommand: async () => ({ ok: false, output: "构建日志尾部", timedOut: true }),
  });
  const jobsFiber = ctx.plugin(jobsPlugin);
  await jobsFiber;

  const execCtx = {
    workspaceRoots: [workspace],
    sessionId: "sess-timeout",
    runId: "run-timeout",
    signal: new AbortController().signal,
  };

  const result = await ctx.tools.executeTool(
    "run_command",
    { command: `"${process.execPath}" -e "console.log('后台完成')"` },
    execCtx,
  );
  assert.equal(result.ok, false);
  const taskId = result.metadata?.backgroundTaskId;
  assert.equal(typeof taskId, "string");
  assert.match(result.output, /已自动转入后台任务/u);

  const jobs = ctx.jobs.listJobs("sess-timeout");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.id, taskId);

  let job = ctx.jobs.getJob(String(taskId));
  const doneDeadline = Date.now() + 5000;
  while (job?.status === "running" && Date.now() < doneDeadline) {
    await new Promise((r) => setTimeout(r, 100));
    job = ctx.jobs.getJob(String(taskId));
  }
  assert.equal(job?.status, "done");
  assert.ok(job?.output.includes("后台完成"));

  await jobsFiber.dispose();
});

test("后台任务同样拦截引用应用私有文件的命令", async () => {
  const ctx = new Context();
  await ctx.plugin(toolsPlugin);
  const jobsFiber = ctx.plugin(jobsPlugin);
  await jobsFiber;

  try {
    const result = await ctx.tools.executeTool(
      "start_background_task",
      { command: "type %USERPROFILE%\\.lfaa\\llm-config.json" },
      {
        workspaceRoots: [os.tmpdir()],
        sessionId: "sess-guard",
        runId: "run-guard",
        signal: new AbortController().signal,
      },
    );
    assert.equal(result.ok, false);
    assert.match(result.output, /已拦截/u);
    assert.equal(ctx.jobs.listJobs("sess-guard").length, 0);
  } finally {
    await jobsFiber.dispose();
  }
});
