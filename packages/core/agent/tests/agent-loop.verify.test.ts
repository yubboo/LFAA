// 验证 @lfaa/agent 的完成前自检、耗时统计与重复调用提醒。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin, type LlmGenerateInput } from "@lfaa/llm";
import { memoryPlugin } from "@lfaa/memory";
import { rulesPlugin } from "@lfaa/rules";
import { toolsPlugin } from "@lfaa/tools";
import { agentPlugin, evaluateToolApproval, SMART_APPROVAL_THRESHOLD, type AgentRunEvent } from "../src/index";

// 命令审计写入临时文件，避免测试污染用户目录。
process.env.LFAA_COMMAND_AUDIT_LOG = path.join(os.tmpdir(), `lfaa-agent-audit-${process.pid}.jsonl`);


test("修改代码后未验证即结束会触发完成前自检并补验证", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-verify-gate-"));
  const ctx = new Context();
  let turn = 0;
  let nudgeSeen = false;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      const lastUser = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "";
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "先写入文件。",
          toolCalls: [{
            id: "write-1",
            name: "write_file",
            argumentsJson: JSON.stringify({ path: "src/app.ts", content: "export const value = 1;\n" }),
          }],
          finishReason: "tool_calls",
        };
      }
      if (turn === 2) {
        return { model: profile.model, provider: profile.kind, content: "已完成修改。", toolCalls: [], finishReason: "stop" };
      }
      if (turn === 3) {
        nudgeSeen = lastUser.includes("完成前请先验证");
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{
            id: "verify-1",
            name: "run_command",
            argumentsJson: JSON.stringify({ command: "tsc --noEmit" }),
          }],
          finishReason: "tool_calls",
        };
      }
      return { model: profile.model, provider: profile.kind, content: "已补做验证。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "完成前自检" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "新增 src/app.ts",
      workspaceRoots: [tempRoot],
      autoApproveTools: true,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("自检任务超时")), 8000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    assert.equal(message?.content, "已补做验证。");
    assert.ok(message?.steps?.some((step) => step.title.includes("完成前自检")));
    assert.equal(nudgeSeen, true);
    assert.equal(turn, 4);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("只改文档不会触发完成前自检", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-verify-doc-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{
            id: "write-doc",
            name: "write_file",
            argumentsJson: JSON.stringify({ path: "README.md", content: "# 说明\n" }),
          }],
          finishReason: "tool_calls",
        };
      }
      return { model: profile.model, provider: profile.kind, content: "文档已更新。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "文档修改" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "更新 README",
      workspaceRoots: [tempRoot],
      autoApproveTools: true,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("文档任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    assert.equal(message?.content, "文档已更新。");
    assert.equal(message?.steps?.some((step) => step.title.includes("完成前自检")), false);
    assert.equal(turn, 2);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("运行持久化模型/工具耗时与上下文构成", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-run-metrics-"));
  const ctx = new Context();
  let turn = 0;
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: "ls-1", name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      input.onDelta?.({ type: "text", text: "完成。" });
      return {
        model: profile.model,
        provider: profile.kind,
        content: "完成。",
        toolCalls: [],
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    await ctx.llm.saveProfile({
      name: "Priced Model",
      kind: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "fixture",
      apiKey: "test-key",
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
    });
    const session = await ctx.memory.createSession({ title: "运行指标" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "列出目录",
      workspaceRoots: [tempRoot],
    });
    let usageEvents = 0;
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("指标任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_usage") usageEvents += 1;
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    assert.ok(usageEvents >= 1, "运行中应推送累计用量，统计栏才能实时变化");

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    const metrics = message?.metrics;
    assert.ok(metrics, "应持久化运行指标");
    assert.ok(metrics.llmMs >= 0);
    assert.ok(metrics.toolMs >= 0);
    assert.ok(metrics.ttftSteps >= 1);
    assert.ok(metrics.context.systemTokens > 0);
    assert.ok(metrics.context.toolsTokens > 0);
    assert.ok(metrics.context.messageTokens > 0);
    assert.ok(message?.cost, "应持久化人民币成本");
    assert.equal(message?.cost?.currency, "CNY");
    assert.ok((message?.cost?.amount ?? 0) > 0);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("重复工具调用会插入建议性提醒且不阻断执行", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-repeat-guard-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn <= 6) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: `ls-${turn}`, name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      return {
        model: profile.model,
        provider: profile.kind,
        content: "已结束。",
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
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "重复调用提醒" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "反复列出目录",
      workspaceRoots: [tempRoot],
      maxSteps: 6,
      autoExtendSteps: 0,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("重复调用任务超时")), 15000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    const reminders = (message?.steps ?? []).filter((step) => step.title.includes("检测到重复工具调用"));
    assert.ok(reminders.length >= 2, "应在连续 3 次与 5 次时各提醒一次");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("重复调用阈值可由运行参数覆盖", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-repeat-threshold-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn <= 2) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: `ls-${turn}`, name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      return { model: profile.model, provider: profile.kind, content: "已结束。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "阈值覆盖" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "重复两次",
      workspaceRoots: [tempRoot],
      maxSteps: 2,
      autoExtendSteps: 0,
      repeatToolThresholds: [2],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("阈值任务超时")), 15000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    const reminders = (message?.steps ?? []).filter((step) => step.title.includes("检测到重复工具调用"));
    assert.equal(reminders.length, 1);
    assert.ok(reminders[0]?.title.includes("连续 2 次"));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});