// 验证项目范围锚定：提示词内容，以及绑定项目的运行确实把项目名与简介送入系统提示。
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
import { buildProjectScopeHint } from "../src/context/agent-context";

test("项目范围提示包含项目名、简介与跑偏处理规则", () => {
  const hint = buildProjectScopeHint({
    projectId: "p1",
    name: "海洋图片",
    description: "生成并整理海洋主题图片素材。",
  });
  assert.match(hint, /本项目范围：海洋图片/u);
  assert.match(hint, /生成并整理海洋主题图片素材/u);
  assert.match(hint, /不属于本项目范围/u);
  assert.match(hint, /项目外聊天/u);

  const empty = buildProjectScopeHint({ projectId: "p2", name: "空白项目" });
  assert.match(empty, /尚未填写简介/u);
  assert.match(empty, /README/u);
});

test("绑定项目的运行把项目范围写入系统提示，未绑定项目时不出现", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-project-scope-"));
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
  ctx.agent.setProjectScopeProvider(async (projectId) => (
    projectId === "proj-ocean"
      ? { projectId, name: "海洋图片", description: "只生成海洋主题图片素材。" }
      : null
  ));

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
    const bound = await ctx.memory.createSession({ title: "项目会话", projectId: "proj-ocean" });
    const started = await ctx.agent.startRun({ sessionId: bound.id, userMessage: "做一张海图", workspaceRoots: [tempRoot] });
    await waitRun(started.runId);
    assert.match(systemPrompts.at(-1) ?? "", /本项目范围：海洋图片/u);
    assert.match(systemPrompts.at(-1) ?? "", /只生成海洋主题图片素材/u);
    assert.match(systemPrompts.at(-1) ?? "", /不属于本项目范围/u);

    const free = await ctx.memory.createSession({ title: "项目外会话" });
    const freeRun = await ctx.agent.startRun({ sessionId: free.id, userMessage: "随便聊聊", workspaceRoots: [tempRoot] });
    await waitRun(freeRun.runId);
    assert.doesNotMatch(systemPrompts.at(-1) ?? "", /本项目范围/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});