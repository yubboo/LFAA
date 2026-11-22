// 验证绑定工作树的会话使用工作树根运行，并在工作树失效时明确失败而不是回退项目主目录。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin, type LlmGenerateInput } from "@lfaa/llm";
import { memoryPlugin } from "@lfaa/memory";
import { rulesPlugin } from "@lfaa/rules";
import { toolsPlugin } from "@lfaa/tools";
import { agentPlugin } from "../src/index";

test("工作树会话把工作树目录作为运行根写进系统提示", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-wt-run-"));
  const mainRoot = path.join(tempRoot, "main");
  const worktreePath = path.join(tempRoot, "main-worktrees", "wt-1-feature-x");
  await fs.mkdir(mainRoot, { recursive: true });
  await fs.mkdir(worktreePath, { recursive: true });
  const ctx = new Context();
  const systemPrompts: string[] = [];

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input: LlmGenerateInput) => {
      systemPrompts.push(String(input.messages.find((message) => message.role === "system")?.content ?? ""));
      return { model: profile.model, provider: profile.kind, content: "完成。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });
  ctx.agent.setSessionRootsResolver(async (session) => (session.worktree ? [session.worktree.path] : null));

  const waitRun = (runId: string) => new Promise<void>((resolveDone, rejectDone) => {
    const timer = setTimeout(() => rejectDone(new Error("运行超时")), 5000);
    const off = ctx.agent.subscribeRun(runId, (event) => {
      if (event.type !== "run_finished") return;
      clearTimeout(timer);
      off();
      resolveDone();
    });
  });

  try {
    const session = await ctx.memory.createSession({
      title: "工作树会话",
      projectId: "proj-1",
      worktree: {
        id: "wt-1",
        projectId: "proj-1",
        path: worktreePath,
        branch: "feature/x",
        repositoryRoot: mainRoot,
      },
    });
    const started = await ctx.agent.startRun({ sessionId: session.id, userMessage: "检查目录" });
    await waitRun(started.runId);
    const system = systemPrompts.at(-1) ?? "";
    assert.match(system, /工作树 feature\/x/u);
    assert.match(system, /所有读写、命令与 Git 操作都以该目录为根/u);
    assert.match(system, /已授权目录：.+/u);
    assert.ok(system.includes(`已授权目录：${worktreePath}`));
    assert.equal(system.includes(`已授权目录：${mainRoot}、`), false);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("工作树解析失败时启动运行直接报错，不回退项目主目录", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-wt-fail-"));
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => ({ model: profile.model, provider: profile.kind, content: "不应执行", toolCalls: [], finishReason: "stop" }),
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });
  ctx.agent.setSessionRootsResolver(async () => {
    throw new Error("会话绑定的工作树不可用（目录缺失或已变更）");
  });

  try {
    const session = await ctx.memory.createSession({
      title: "失效工作树",
      projectId: "proj-1",
      worktree: {
        id: "wt-missing",
        projectId: "proj-1",
        path: path.join(tempRoot, "missing"),
        branch: "feature/missing",
        repositoryRoot: path.join(tempRoot, "main"),
      },
    });
    await assert.rejects(
      () => ctx.agent.startRun({ sessionId: session.id, userMessage: "继续" }),
      /工作树不可用/u,
    );
    assert.equal((await ctx.memory.getSession(session.id))?.messages.length, 0);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});