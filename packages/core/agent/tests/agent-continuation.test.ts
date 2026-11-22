// 验证续写运行：不写用户消息、保留任务清单，只新增一条助手消息。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin } from "@lfaa/llm";
import { memoryPlugin } from "@lfaa/memory";
import { rulesPlugin } from "@lfaa/rules";
import { toolsPlugin } from "@lfaa/tools";
import { agentPlugin, type AgentRunEvent } from "../src/index";

test("续写运行不追加用户消息，保留清单并新增助手回复", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-continuation-"));
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile) => ({
      model: profile.model,
      provider: profile.kind,
      content: "继续完成。",
      finishReason: "stop",
      usage: { promptTokens: 20, completionTokens: 4, cachedPromptTokens: 0 },
      toolCalls: [],
    }),
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(dir, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(dir, "sessions"),
    memoryFilePath: path.join(dir, "memory.json"),
  });
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  await ctx.plugin(agentPlugin);

  try {
    const session = await ctx.memory.createSession({ title: "续写测试" });
    await ctx.memory.appendMessage(session.id, { id: "u1", role: "user", content: "写一段话", createdAt: 1 });
    await ctx.memory.appendMessage(session.id, {
      id: "a1", role: "assistant", content: "这是半句话", status: "aborted", createdAt: 2,
    });
    await ctx.memory.updateSession(session.id, {
      todos: [
        { id: "1", content: "写一段话", status: "in_progress" },
        { id: "2", content: "检查结果", status: "pending" },
      ],
    });

    const started = await ctx.agent.startRun({
      sessionId: session.id,
      continuation: { assistantMessageId: "a1" },
      workspaceRoots: [dir],
      permissionMode: "full",
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待续写运行结束超时")), 8000);
      const off = ctx.agent.subscribeRun(started.runId, (event: AgentRunEvent) => {
        if (event.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });

    const after = await ctx.memory.getSession(session.id);
    assert.ok(after);
    assert.equal(after.messages.filter((message) => message.role === "user").length, 1);
    assert.equal(after.messages.filter((message) => message.role === "assistant").length, 2);
    assert.equal(after.messages.at(-1)?.content, "继续完成。");
    assert.deepEqual(after.todos?.map((todo) => todo.status), ["in_progress", "pending"]);
    assert.doesNotMatch(after.messages.map((message) => message.content).join("\n"), /完整句边界/u);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});