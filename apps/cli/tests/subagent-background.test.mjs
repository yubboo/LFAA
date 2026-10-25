/** 仅在隔离数据和合成 Provider 中验证委派，不使用真实账户、密钥或外部 CLI。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = fileURLToPath(new URL("../../../dist/.tmp/", import.meta.url));
mkdirSync(testRoot, { recursive: true });
const testData = mkdtempSync(join(testRoot, "lfaa-subagent-background-"));
process.env.LFAA_DATA_DIR = testData; process.env.NODE_ENV = "test"; process.env.JWT_SECRET = ""; process.env.LFAA_HARNESS_HOME = "";
process.env.LFAA_LOCAL_MODE = "true";
const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
process.env.SERVER_HOST = "127.0.0.1"; process.env.SERVER_PORT = String(reservation.address().port);
await new Promise(resolve => reservation.close(resolve));
test.after(() => { if (dirname(testData) !== testRoot.replace(/[\\/]$/u, "")) throw new Error("拒绝清理隔离根以外路径。"); rmSync(testData, { recursive: true, force: true }); });
const { SubagentManager } = await import("lfaa-subagent/src/manager.js");
const { toolExecutionState } = await import("lfaa-agent-loop/src/tool-outcome.js");

test("取消信号在派发前拒绝驱动，派发后不能误记为完成", async () => {
  const manager = new SubagentManager();
  let executions = 0;
  const release = Promise.withResolvers();
  manager.registerDriver({ name: "fixture", displayName: "隔离驱动", async run() { executions++; await release.promise; return { runId: "", stopReason: "completed", answer: "真实返回" }; } });
  const cancelled = new AbortController(); cancelled.abort();
  const task = { driver: "fixture", description: "验证取消", prompt: "fixture", appId: "workspace" };
  const context = { userId: "owner", userRole: "admin", signal: cancelled.signal, onProgress() {} };
  const notStarted = manager.start(task, context);
  assert.equal((await notStarted.done).stopReason, "aborted");
  assert.equal(executions, 0);
  const controller = new AbortController();
  const running = manager.start(task, { ...context, signal: controller.signal });
  assert.equal(manager.getRun("other", running.runId), null);
  controller.abort(); release.resolve();
  assert.equal((await running.done).stopReason, "aborted");
  assert.equal(running.status, "aborted");
  assert.equal(toolExecutionState({ status: "aborted" }, true), "unconfirmed");
  assert.equal(toolExecutionState({ status: "timeout" }, true), "unconfirmed");
  manager.close();
});

test("完整 Agent 链：后台继续、前台等待、回收结果、取消等待和预算/账户/持久化边界", { timeout: 90_000 }, async t => {
  const { boot } = await import("lfaa-app-boot/src/index.js");
  const ctx = await boot(["web"]);
  const { createAiPluginHost } = await import("lfaa-app-boot/src/ai-host.js");
  const settings = await import("lfaa-settings/src/service.js");
  const sessions = await import("lfaa-session/src/sessions.js");
  const runs = await import("lfaa-agent-loop/src/runs.js");
  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
  const owner = randomUUID(), stranger = randomUUID();
  for (const [id, uid] of [[owner, 1], [stranger, 2]]) database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','admin')").run(id, uid, `isolated-${uid}`);
  const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }], usage: { prompt_tokens: 1, completion_tokens: 1 } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  const toolCall = (name, args) => sse({ tool_calls: [{ index: 0, id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] });
  let releaseChild = Promise.withResolvers();
  let selectedMode = "background";
  let childCalls = 0;
  let shellScenario = null;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "fixture-model", context_window: 32768 }] });
    const body = JSON.parse(options.body);
    const prompt = body.messages.find(message => message.role === "user")?.content ?? "";
    if (String(prompt).startsWith("isolated-shell")) {
      const results = body.messages.filter(message => message.role === "tool");
      if (!results.length || results.length === 2) return toolCall("local_execute_command", shellScenario.parameters);
      if (results.length === 1) return toolCall("fixture_repair", {});
      return sse({ content: "已核对命令真实执行结果" });
    }
    if (String(prompt).includes("isolated-child")) {
      childCalls++;
      await new Promise((resolve, reject) => {
        const abort = () => { cleanup(); reject(options.signal.reason); };
        const cleanup = () => options.signal.removeEventListener("abort", abort);
        if (options.signal.aborted) { abort(); return; }
        options.signal.addEventListener("abort", abort, { once: true });
        void releaseChild.promise.then(() => { cleanup(); resolve(); });
      });
      return sse({ content: "子任务真实结果：已完成核查" });
    }
    return body.messages.some(message => message.role === "tool") ? sse({ content: "父任务已接收真实委派状态" })
      : toolCall("lfaa_delegate_subagent", { description: "隔离子任务", prompt: "isolated-child", mode: selectedMode });
  });
  try {
    const account = await settings.saveAiAccount(owner, { providerId: "openai", secret: "fixture-invalid-key", options: {}, displayName: "隔离模型", modelId: "fixture-model", reasoningMode: "default" });
    settings.activateAiAccount(owner, account.id);
    settings.saveUserSettings(owner, "permissions", { mode: "full_access" });
    settings.saveUserSettings(owner, "general", { ...settings.defaultSettings.general, taskFolder: testData });
    settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, requestRetries: 0, executionSandboxMode: "danger-full-access" });
    const host = createAiPluginHost(ctx);
    const waitFor = async read => { const deadline = Date.now() + 15_000; while (Date.now() < deadline) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error("隔离场景等待超时"); };
    const start = () => runs.startAiRun(owner, "admin", { appId: "workspace", sessionId: null, content: "isolated-parent" }, host, { allowedToolNames: ["lfaa_delegate_subagent"] });
    const tools = () => ctx.lfaaTools.listAiBusinessTools("workspace", "admin", null, "full_access", true);
    const readResult = tools().find(tool => tool.name === "lfaa_get_subagent_result"); assert.ok(readResult);
    const cancel = tools().find(tool => tool.name === "lfaa_cancel_subagent"); assert.ok(cancel);
    const context = (parent, signal = new AbortController().signal) => ({ userId: owner, userRole: "admin", applicationId: "workspace", agentRunId: parent.id, sessionId: parent.sessionId, signal, onProgress() {} });
    const taskFor = parent => sessions.listAiSubagentTasks(owner, parent.sessionId)[0];
    const finish = parent => waitFor(() => { const run = runs.getAiRun(owner, parent.id); return run.status !== "streaming" && run; });

    const background = start(); await finish(background);
    assert.equal(runs.getAiRun(owner, background.id).status, "complete", runs.getAiRun(owner, background.id).message.content);
    assert.equal(taskFor(background).status, "running", "父回复结束后子任务仍独立运行");
    const bgTask = taskFor(background);
    assert.deepEqual(sessions.listAiSubagentTasks(stranger, background.sessionId), []);
    await assert.rejects(readResult.execute({ runId: bgTask.runId, wait: false }, { ...context(background), userId: stranger }), /找不到/);
    const waitController = new AbortController();
    const pending = readResult.execute({ runId: bgTask.runId, wait: true }, context(background, waitController.signal));
    const cancelledWait = assert.rejects(pending, error => error.name === "AbortError"); waitController.abort(); await cancelledWait;
    assert.equal(ctx.lfaaSubagents.getRun(owner, bgTask.runId).status, "running", "取消读取不取消任务");
    releaseChild.resolve();
    await waitFor(() => taskFor(background).status === "completed");
    const result = await readResult.execute({ runId: bgTask.runId, wait: true }, context(background));
    assert.equal(result.status, "complete"); assert.match(result.answer, /真实结果/);
    const events = sessionRecords.allForSession("session_events", background.sessionId).filter(event => event.type === "subagent/task");
    assert.deepEqual(events.map(event => event.data.status), ["running", "completed"]);
    assert.match(events.at(-1).data.answer, /真实结果/);

    selectedMode = "foreground"; releaseChild = Promise.withResolvers();
    const foreground = start(); await waitFor(() => taskFor(foreground)?.status === "running");
    assert.equal(runs.getAiRun(owner, foreground.id).status, "streaming", "前台委派等待子任务终态");
    releaseChild.resolve(); await finish(foreground); assert.equal(taskFor(foreground).status, "completed");

    selectedMode = "background"; releaseChild = Promise.withResolvers();
    const cancelled = start(); await finish(cancelled); const cancelledTask = taskFor(cancelled);
    await cancel.execute({ runId: cancelledTask.runId }, context(cancelled));
    await waitFor(() => taskFor(cancelled).status === "aborted");
    assert.equal((await readResult.execute({ runId: cancelledTask.runId }, context(cancelled))).status, "aborted");

    const previousCalls = childCalls;
    settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, maxSubagents: 0, requestRetries: 0 });
    const blocked = start(); await finish(blocked);
    assert.equal(childCalls, previousCalls); assert.equal(taskFor(blocked), undefined, "后台模式不能绕过子任务预算");

    const pendingRecord = { ...bgTask, runId: randomUUID() };
    sessions.saveAiSubagentTask(owner, background.sessionId, pendingRecord);
    const interrupted = await readResult.execute({ runId: pendingRecord.runId }, context(background));
    assert.equal(interrupted.status, "aborted"); assert.match(interrupted.diagnostic, /中断/);
    ctx.lfaaSubagents.close();
    assert.match((await readResult.execute({ runId: bgTask.runId }, context(background))).answer, /真实结果/, "运行器卸载后仍能读持久化结果");
    assert.throws(() => sessions.saveAiSubagentTask(stranger, background.sessionId, pendingRecord), /不属于/);

    await t.test("真实 Shell：确认失败后修复可重验，超时后修复也不能原样重放", async () => {
      const registry = await import("lfaa-tools/src/registry.js");
      const disposers = [];
      registry.registerAiBusinessTool({ effect: setup => disposers.push(setup()) }, {
        id: "fixture.repair", name: "fixture_repair", coreManaged: true, applicationIds: ["workspace"],
        description: "仅在隔离测试目录写修复标记", schema: { type: "object", properties: {}, additionalProperties: false },
        parse: value => value, risk: () => "write", approval: () => ({ scopeKey: "fixture-repair", scopeSummary: "隔离修复", summary: "写入测试修复标记" }),
        async execute() { writeFileSync(shellScenario.marker, "fixed"); return { executed: true }; }
      });
      try {
        settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, requestRetries: 0, executionSandboxMode: "danger-full-access" });
        for (const unknown of [false, true]) {
          const marker = join(testData, `shell-repaired-${unknown}`);
          shellScenario = { marker, parameters: { command: unknown ? "Start-Sleep -Seconds 3" : `if (Test-Path -LiteralPath '${marker.replaceAll("'", "''")}') { exit 0 } else { exit 1 }`, workingDirectory: testData, timeoutSeconds: unknown ? 1 : 10 } };
          const parent = runs.startAiRun(owner, "admin", { appId: "workspace", sessionId: null, content: "isolated-shell" }, host, { allowedToolNames: ["local_execute_command", "fixture_repair"] });
          await finish(parent);
          assert.equal(runs.getAiRun(owner, parent.id).status, "complete", runs.getAiRun(owner, parent.id).message.content);
          const calls = sessionRecords.allForSession("session_events", parent.sessionId).filter(event => event.type === "tool/call" && event.data.name === "local_execute_command");
          assert.deepEqual(calls.map(event => event.data.dispatched), unknown ? [true, false] : [true, true]);
          const results = sessionRecords.allForSession("session_events", parent.sessionId).filter(event => event.type === "tool/result");
          assert.ok(results.some(event => JSON.stringify(event.data).includes(unknown ? "unconfirmed" : "failed")));
        }
      } finally { for (const dispose of disposers) dispose(); shellScenario = null; }
    });
  } finally { releaseChild.resolve(); await ctx.fiber.dispose(); }
});
