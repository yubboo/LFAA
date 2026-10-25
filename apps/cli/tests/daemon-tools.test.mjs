/**
 * 功能：回归本机托管节点的 Agent 工具合同。
 * 作用：验证只调用注入的 supervisor、幂等启动回执、危险操作风险级别，以及没有托管面时的明确失败。
 * 关联文件：packages/host/tool-daemon、host/daemon/src/supervisor.mjs、apps/cli/bin/lfaa.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const { Context } = await import("@deepseek-ai/cordis");

const context = { userId: randomUUID(), userRole: "admin", applicationId: "workspace", agentRunId: randomUUID(), signal: new AbortController().signal, onProgress() {} };

async function build(supervisor) {
  const ctx = new Context();
  await ctx.plugin(await import("lfaa-tools"));
  if (supervisor) ctx.provide("lfaaLocalDaemonSupervisor", supervisor);
  const fiber = await ctx.plugin(await import("lfaa-tool-daemon"));
  const tools = ctx.lfaaTools.listAiBusinessTools("workspace", "admin", null, "full_access", true);
  const byName = (name) => tools.find(tool => tool.name === name);
  return { ctx, fiber, tools, byName };
}

function fakeSupervisor() {
  const calls = [];
  const status = () => ({ managed: true, running: true, pid: 4242, attempts: 0, startedAt: "2026-10-25T00:00:00.000Z", lastExit: null });
  return { calls, status, start: async () => { calls.push("start"); return status(); }, stop: async () => { calls.push("stop"); return { ...status(), running: false, pid: null }; }, restart: async () => { calls.push("restart"); return status(); } };
}

test("工具登记为按需且覆盖本机节点状态与受控启停", async () => {
  const { fiber, byName } = await build(fakeSupervisor());
  try {
    for (const name of ["daemon_local_status", "daemon_local_start", "daemon_local_stop", "daemon_local_restart"]) assert.ok(byName(name), name);
    assert.equal(byName("daemon_local_status").risk({}), "read");
    assert.equal(byName("daemon_local_start").risk({}), "write");
    assert.equal(byName("daemon_local_stop").risk({}), "dangerous");
    assert.equal(byName("daemon_local_restart").risk({}), "dangerous");
  } finally { await fiber.dispose(); }
});

test("状态读取与启停只调用注入的 supervisor，并返回真实回执", async () => {
  const supervisor = fakeSupervisor();
  const { fiber, byName } = await build(supervisor);
  try {
    const status = await byName("daemon_local_status").execute({}, context);
    assert.equal(status.supervised, true);
    assert.equal(status.supervisor.pid, 4242);
    assert.ok(Array.isArray(status.nodes));
    const started = await byName("daemon_local_start").execute({}, context);
    assert.equal(started.started, true);
    await byName("daemon_local_stop").execute({}, context);
    await byName("daemon_local_restart").execute({}, context);
    assert.deepEqual(supervisor.calls, ["start", "stop", "restart"]);
  } finally { await fiber.dispose(); }
});

test("没有托管面时明确失败，不假装启动或退回到其它命令", async () => {
  const { fiber, byName } = await build(undefined);
  try {
    const status = await byName("daemon_local_status").execute({}, context);
    assert.equal(status.supervised, false);
    assert.match(status.reason, /没有托管本机节点/u);
    await assert.rejects(byName("daemon_local_start").execute({}, context), /没有托管本机节点/u);
    await assert.rejects(byName("daemon_local_stop").execute({}, context), /没有托管本机节点/u);
  } finally { await fiber.dispose(); }
});
