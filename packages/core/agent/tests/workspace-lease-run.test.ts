// 验证同工作区多会话并行与并发感知：第二个会话可并发启动，收到同工作区活跃会话提示，运行结束后自动释放登记。
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
import { agentPlugin } from "../src/index";

/** 轮询到会话没有运行中的任务且所有并行登记均已释放。 */
async function waitAllSettled(ctx: Context, sessionIds: string[]): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const anyRunning = sessionIds.some((id) => Boolean(ctx.agent.getActiveRunForSession(id)));
    if (!anyRunning && ctx.agent.listWorkspaceLeases().length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("等待运行结束超时");
}

test("同工作区的多个会话支持并行运行，并向并发会话注入同工作区感知提示", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-lease-"));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const capturedSystems: string[] = [];
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile, request) => {
      const systemText = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
      capturedSystems.push(systemText);
      await gate;
      return {
        model: profile.model,
        provider: profile.kind,
        content: "完成。",
        finishReason: "stop",
        usage: { promptTokens: 20, completionTokens: 4, cachedPromptTokens: 0 },
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
  await ctx.plugin(agentPlugin);

  try {
    const first = await ctx.memory.createSession({ title: "会话一" });
    const second = await ctx.memory.createSession({ title: "会话二" });
    const startedFirst = await ctx.agent.startRun({
      sessionId: first.id,
      userMessage: "开始",
      workspaceRoots: [dir],
      permissionMode: "full",
    });
    assert.equal(ctx.agent.getActiveRunForSession(first.id)?.runId, startedFirst.runId);
    assert.equal(ctx.agent.listWorkspaceLeases().length, 1);

    const startedSecond = await ctx.agent.startRun({
      sessionId: second.id,
      userMessage: "并发任务",
      workspaceRoots: [dir],
      permissionMode: "full",
    });
    assert.equal(ctx.agent.getActiveRunForSession(second.id)?.runId, startedSecond.runId);
    assert.equal(ctx.agent.listWorkspaceLeases().length, 2);

    // 等两个并发运行都进入 LLM 调用后再放行，确保采集到第二个会话的动态系统提示。
    const waitCallDeadline = Date.now() + 4000;
    while (capturedSystems.length < 2 && Date.now() < waitCallDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(capturedSystems.length, 2);
    assert.match(capturedSystems[1]!, /同工作区多会话并行感知/);
    assert.match(capturedSystems[1]!, /会话一/);

    release();
    await waitAllSettled(ctx, [first.id, second.id]);
    assert.equal(ctx.agent.listWorkspaceLeases().length, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});