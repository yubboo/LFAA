// 验证运行级工作区租约：同工作区第二个会话被拒绝，首个运行收尾后可以接手，租约随运行释放。
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

/** 轮询到会话没有运行中的任务且租约已释放；运行记录在 startRun 返回前已登记。 */
async function waitSettled(ctx: Context, sessionId: string): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (!ctx.agent.getActiveRunForSession(sessionId) && ctx.agent.listWorkspaceLeases().length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("等待运行结束超时");
}

test("同工作区的第二个会话被租约拒绝，首个运行结束后可以接手", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-lease-"));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile) => {
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
    const started = await ctx.agent.startRun({
      sessionId: first.id,
      userMessage: "开始",
      workspaceRoots: [dir],
      permissionMode: "full",
    });
    assert.equal(ctx.agent.getActiveRunForSession(first.id)?.runId, started.runId);
    assert.equal(ctx.agent.listWorkspaceLeases().length, 1);

    await assert.rejects(
      () => ctx.agent.startRun({
        sessionId: second.id,
        userMessage: "开始",
        workspaceRoots: [dir],
        permissionMode: "full",
      }),
      /工作区正被/u,
    );

    release();
    await waitSettled(ctx, first.id);
    assert.equal(ctx.agent.listWorkspaceLeases().length, 0);

    await ctx.agent.startRun({
      sessionId: second.id,
      userMessage: "开始",
      workspaceRoots: [dir],
      permissionMode: "full",
    });
    await waitSettled(ctx, second.id);
    assert.equal(ctx.agent.listWorkspaceLeases().length, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});