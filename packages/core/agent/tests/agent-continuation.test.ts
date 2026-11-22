// 验证续写运行：不写用户消息、保留任务清单，只新增一条助手消息；目标续跑自动接下一轮并停在上限。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context, Service } from "@deepseek-ai/cordis";
import { llmPlugin } from "@lfaa/llm";
import { memoryPlugin } from "@lfaa/memory";
import { rulesPlugin } from "@lfaa/rules";
import { toolsPlugin } from "@lfaa/tools";
import { agentPlugin, type AgentRunEvent } from "../src/index";

/** 目标服务替身：只实现 Agent 续跑判定需要的最小接口。 */
class FakeGoalService extends Service {
  constructor(ctx: Context, private readonly goals: Array<{
    id: string;
    sessionId: string;
    title: string;
    objective: string;
    status: "active" | "complete" | "blocked";
    autoContinue: boolean;
    rounds: number;
    maxRounds: number;
  }>) {
    super(ctx, "goal");
  }

  async list(filter: { sessionId?: string } = {}) {
    return this.goals.filter((goal) => !filter.sessionId || goal.sessionId === filter.sessionId);
  }

  async advanceRound(id: string) {
    const goal = this.goals.find((item) => item.id === id);
    if (!goal) throw new Error(`目标不存在：${id}`);
    goal.rounds += 1;
    return goal;
  }
}

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

test("目标 active 时自动续跑一轮，并在轮数上限停下", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-goal-continuation-"));
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
  const goals = [{
    id: "g1",
    title: "续跑测试",
    objective: "自动接下一轮",
    status: "active" as const,
    autoContinue: true,
    rounds: 0,
    maxRounds: 1,
    sessionId: "",
  }];
  new FakeGoalService(ctx, goals);
  await ctx.plugin(agentPlugin);

  try {
    const session = await ctx.memory.createSession({ title: "目标续跑" });
    goals[0]!.sessionId = session.id;
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "开始",
      workspaceRoots: [dir],
      permissionMode: "full",
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待首轮运行结束超时")), 8000);
      const off = ctx.agent.subscribeRun(started.runId, (event: AgentRunEvent) => {
        if (event.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });

    // 自动续跑在 200ms 后启动：轮询到第二条助手消息落盘且没有运行中的任务。
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const sessionNow = await ctx.memory.getSession(session.id);
      const assistants = sessionNow?.messages.filter((message) => message.role === "assistant").length ?? 0;
      if (assistants >= 2 && !ctx.agent.getActiveRunForSession(session.id)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const after = await ctx.memory.getSession(session.id);
    assert.ok(after);
    assert.equal(after.messages.filter((message) => message.role === "user").length, 1);
    assert.equal(after.messages.filter((message) => message.role === "assistant").length, 2);
    assert.equal(goals[0]?.rounds, 1);

    // maxRounds=1：再等一段时间不应出现第三条助手消息。
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal((await ctx.memory.getSession(session.id))?.messages.filter((message) => message.role === "assistant").length, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});