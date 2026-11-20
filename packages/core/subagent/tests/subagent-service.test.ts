// 验证 @lfaa/subagent 并发派发、上下文隔离、递归深度防护、权限隔离与停止清理。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin } from "@lfaa/llm";
import { memoryPlugin } from "@lfaa/memory";
import { rulesPlugin } from "@lfaa/rules";
import { toolsPlugin, type SubagentActivityUpdate } from "@lfaa/tools";
import { subagentPlugin } from "../src/index";

test("SubagentService 支持并发派发只读调研、阻断递归并可续接对话", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-subagent-test-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  await fs.writeFile(path.join(tempRoot, "README.md"), "LFAA Subagent Target", "utf8");

  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      const toolNames = (input.tools ?? []).map((tool) => tool.name);
      // 严格校验只读子智能体不可见 write_file 且阻断递归 invoke_subagent
      assert.equal(toolNames.includes("invoke_subagent"), false);
      assert.equal(toolNames.includes("write_file"), false);
      const prompt = input.messages.at(-1)?.content ?? "";
      return {
        model: profile.model,
        provider: profile.kind,
        content: `子任务完成: ${prompt.slice(0, 40)}`,
        toolCalls: [],
        finishReason: "stop",
      };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  const fiber = ctx.plugin(subagentPlugin);
  await fiber;

  const updates: SubagentActivityUpdate[] = [];
  const execCtx = {
    workspaceRoots: [tempRoot],
    sessionId: "parent-sess",
    runId: "parent-run",
    signal: new AbortController().signal,
    onSubagentActivity: (update: SubagentActivityUpdate) => updates.push(update),
  };

  // 不能以只读的派发工具绕过父会话审批创建写入子任务。
  const rejectedWrite = await ctx.tools.executeTool("invoke_subagent", { role: "writer", prompt: "修改文件", mode: "write" }, execCtx);
  assert.equal(rejectedWrite.ok, false);
  assert.match(rejectedWrite.output, /审批上下文/u);

  // 并发启动 2 个异步子智能体
  const [a, b] = await Promise.all([
    ctx.tools.executeTool("invoke_subagent", { role: "模块分析 A", prompt: "分析 A", wait: false }, execCtx),
    ctx.tools.executeTool("invoke_subagent", { role: "模块分析 B", prompt: "分析 B", wait: false }, execCtx),
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const idA = (JSON.parse(a.output) as { subagentId: string }).subagentId;
  const idB = (JSON.parse(b.output) as { subagentId: string }).subagentId;

  const waited = await ctx.tools.executeTool("list_subagents", { waitForIds: [idA, idB] }, execCtx);
  assert.equal(waited.ok, true);
  const list = JSON.parse(waited.output) as Array<{ id: string; status: string; output: string }>;
  assert.equal(list.length, 2);
  assert.ok(list.every((item) => item.status === "done"));
  for (const id of [idA, idB]) {
    const own = updates.filter((update) => update.id === id);
    assert.deepEqual(own.map((update) => update.status), ["running", "done"]);
    assert.match(own[1]?.result ?? "", /子任务完成/u);
  }

  const followUp = await ctx.tools.executeTool("message_subagent", { subagentId: idA, message: "补充总结" }, execCtx);
  assert.equal(followUp.ok, true);
  assert.ok(followUp.output.includes("补充总结"));

  await fiber.dispose();
  assert.equal((ctx as { subagent?: unknown }).subagent, undefined);
  assert.equal(ctx.tools.getTool("invoke_subagent"), undefined);
});

test("写入子任务使用父审批，拒绝时不写入文件", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-subagent-approval-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));
  const ctx = new Context();
  let turns = 0;
  await ctx.plugin(llmPlugin, { storeFilePath: path.join(tempRoot, "llm.json"), adapter: async (profile) => {
    turns += 1;
    return turns === 1
      ? { model: profile.model, provider: profile.kind, content: "", toolCalls: [{ id: "write", name: "write_file", argumentsJson: JSON.stringify({ path: "denied.txt", content: "no" }) }], finishReason: "tool_calls" }
      : { model: profile.model, provider: profile.kind, content: "结束", toolCalls: [], finishReason: "stop" };
  } });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, { sessionsDir: path.join(tempRoot, "sessions"), memoryFilePath: path.join(tempRoot, "memory.json") });
  await ctx.plugin(toolsPlugin);
  const fiber = ctx.plugin(subagentPlugin);
  await fiber;
  let approvals = 0;
  const result = await ctx.tools.executeTool("invoke_subagent", { role: "writer", prompt: "写入", mode: "write" }, {
    workspaceRoots: [tempRoot], sessionId: "parent-sess", runId: "parent-run", signal: new AbortController().signal,
    parentApproval: { getPermissionMode: () => "ask", requestApproval: async () => { approvals += 1; return false; } },
  });
  assert.equal(result.ok, true);
  assert.equal(approvals, 1);
  await assert.rejects(fs.stat(path.join(tempRoot, "denied.txt")), { code: "ENOENT" });
  await fiber.dispose();
});
