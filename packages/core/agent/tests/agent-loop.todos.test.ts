// 验证工具回传的任务清单会广播 todos 事件并进入运行快照，供前端任务面板订阅。
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

const TODOS = [
  { id: "1", content: "读源码", status: "in_progress" as const },
  { id: "2", content: "写测试", status: "pending" as const },
];

test("工具 metadata.todos 触发 todos 事件，并保留在运行快照中", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-todos-"));
  const ctx = new Context();
  let calls = 0;
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile) => {
      calls += 1;
      if (calls === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          finishReason: "tool_calls",
          usage: { promptTokens: 50, completionTokens: 10, cachedPromptTokens: 0 },
          toolCalls: [{ id: "call-1", name: "sync_todos", argumentsJson: "{}" }],
        };
      }
      return {
        model: profile.model,
        provider: profile.kind,
        content: "清单已更新，继续执行。",
        finishReason: "stop",
        usage: { promptTokens: 80, completionTokens: 12, cachedPromptTokens: 0 },
        toolCalls: [],
      };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(dir, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(dir, "sessions"),
    memoryFilePath: path.join(dir, "memory.json"),
  });
  await ctx.plugin(toolsPlugin, { includeBuiltins: false });
  // 用最小工具模拟 todo_write：只回传 metadata.todos，不落会话（落盘由工具包自己负责）。
  ctx.tools.registerTool({
    moduleName: "test",
    name: "sync_todos",
    title: "同步任务清单",
    description: "测试用",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => ({
      ok: true,
      output: JSON.stringify(TODOS),
      summary: "任务清单已更新：共 2 条",
      metadata: { todos: TODOS },
    }),
  });
  await ctx.plugin(agentPlugin);

  try {
    const session = await ctx.memory.createSession({ title: "清单事件测试" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "请先列出任务清单再执行",
      workspaceRoots: [dir],
      permissionMode: "full",
    });

    const events: AgentRunEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待运行结束超时")), 8000);
      const off = ctx.agent.subscribeRun(started.runId, (event) => {
        events.push(event);
        if (event.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });

    const todoEvent = events.find((event) => event.type === "todos");
    assert.ok(todoEvent, "应广播 todos 事件");
    assert.deepEqual(todoEvent.type === "todos" ? todoEvent.todos : undefined, TODOS);

    // 快照：断线重连时前端拿到的运行状态里要带清单。
    const snapshot = ctx.agent.getRunStatus(started.runId);
    assert.deepEqual(snapshot?.todos, TODOS);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});