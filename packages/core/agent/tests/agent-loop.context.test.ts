// 验证 @lfaa/agent 的上下文压缩、记忆召回与并行工具。
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


test("软预算用尽后按上一轮真实工具进展自动延长，并写入滚动会话摘要", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-budget-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn <= 3 && (input.tools?.length ?? 0) > 0) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: `ls-${turn}`, name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      input.onDelta?.({ type: "text", text: "延长预算后完成。" });
      return { model: profile.model, provider: profile.kind, content: "延长预算后完成。", toolCalls: [], finishReason: "stop" };
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
    const session = await ctx.memory.createSession({ title: "预算延长" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "连续检查三次",
      workspaceRoots: [tempRoot],
      maxSteps: 2,
      autoExtendSteps: 2,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("预算延长任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const saved = await ctx.memory.getSession(session.id);
    const message = saved?.messages.find((m) => m.id === started.assistantMessageId);
    assert.equal(message?.content, "延长预算后完成。");
    assert.equal(message?.steps?.filter((s) => s.phase === "act").length, 3);
    assert.ok(message?.steps?.some((s) => s.title.includes("自动延长 2 步")));

    // 运行结束写入滚动摘要：包含本轮目标与真实工具轨迹
    assert.match(saved?.contextSummary ?? "", /本轮：连续检查三次/u);
    assert.match(saved?.contextSummary ?? "", /list_dir×3/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("模型上下文超限时强制压缩并重试一次，而不是直接失败", async () => {  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-overflow-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn === 1) {
        throw new Error("This model's maximum context length is 65536 tokens");
      }
      return {
        model: profile.model,
        provider: profile.kind,
        content: "压缩后完成。",
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
    const session = await ctx.memory.createSession({ title: "上下文压缩" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "执行一个长任务",
      workspaceRoots: [tempRoot],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("上下文压缩任务超时")), 5000);
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
    assert.equal(message?.content, "压缩后完成。");
    assert.ok(message?.steps?.some((step) => step.title.includes("上下文超限")));
    assert.equal(turn, 2);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("明确偏好自动沉淀并在下次运行召回，模型用量随消息持久化", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-memory-loop-"));
  const ctx = new Context();
  let turn = 0;
  let firstSystemPrompt = "";
  let secondSystemPrompt = "";
  let secondAllMessages = "";

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn === 1) {
        firstSystemPrompt = input.messages[0]?.content ?? "";
        return {
          model: profile.model,
          provider: profile.kind,
          content: "好的，已记录。",
          toolCalls: [],
          finishReason: "stop",
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        };
      }
      secondSystemPrompt = input.messages[0]?.content ?? "";
      secondAllMessages = input.messages.map((m) => m.content).join("\n");
      return {
        model: profile.model,
        provider: profile.kind,
        content: "构建步骤说明。",
        toolCalls: [],
        finishReason: "stop",
        usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
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

  const waitRun = (runId: string) => new Promise<void>((resolveDone, rejectDone) => {
    const timer = setTimeout(() => rejectDone(new Error("记忆闭环任务超时")), 5000);
    const off = ctx.agent.subscribeRun(runId, (evt) => {
      if (evt.type === "run_finished") {
        clearTimeout(timer);
        off();
        resolveDone();
      }
    });
  });

  try {
    const session = await ctx.memory.createSession({ projectId: "proj-mem", title: "记忆闭环" });
    const first = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "记住：本项目统一使用 pnpm。",
      projectId: "proj-mem",
      workspaceRoots: [tempRoot],
    });
    await waitRun(first.runId);

    const saved = await ctx.memory.getSession(session.id);
    const message = saved?.messages.find((item) => item.id === first.assistantMessageId);
    assert.deepEqual(message?.tokenUsage, { promptTokens: 100, completionTokens: 20, totalTokens: 120 });
    assert.ok(message?.steps?.some((step) => step.title.includes("自动沉淀长期记忆")));
    const memories = await ctx.memory.listLongTermMemories({ projectId: "proj-mem" });
    assert.ok(memories.some((item) => item.content.includes("pnpm")));

    const second = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "继续说明构建步骤",
      projectId: "proj-mem",
      workspaceRoots: [tempRoot],
    });
    await waitRun(second.runId);
    // 动态召回记忆下沉至本轮尾部上下文，既送达模型又保证跨轮 messages[0] 字节级一致以命中 KV Cache。
    assert.equal(secondSystemPrompt, firstSystemPrompt);
    assert.match(secondAllMessages, /项目事实/u);
    assert.match(secondAllMessages, /pnpm/u);
    const secondMessage = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === second.assistantMessageId);
    assert.deepEqual(secondMessage?.tokenUsage, { promptTokens: 50, completionTokens: 10, totalTokens: 60 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("同轮连续只读工具并行执行，结果按调用顺序回填", async () => {  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-parallel-"));
  const ctx = new Context();
  let active = 0;
  let maxActive = 0;
  let turn = 0;
  let toolOrder: Array<string | undefined> = [];

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [
            { id: "read-a", name: "slow_read", argumentsJson: "{}" },
            { id: "read-b", name: "slow_read", argumentsJson: "{}" },
          ],
          finishReason: "tool_calls",
        };
      }
      toolOrder = input.messages.filter((item) => item.role === "tool").map((item) => item.toolCallId);
      return {
        model: profile.model,
        provider: profile.kind,
        content: "并行完成。",
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
  ctx.tools.registerTool({
    name: "slow_read",
    title: "慢速只读工具",
    description: "测试同轮并行执行",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 60));
      active -= 1;
      return { ok: true, output: "ok", summary: "ok" };
    },
  });
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "并行只读" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "并行读取两个文件",
      workspaceRoots: [tempRoot],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("并行任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    assert.ok(maxActive >= 2, `只读工具应并行执行，实际最大并发 ${maxActive}`);
    assert.deepEqual(toolOrder, ["read-a", "read-b"]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("注册 browser_navigate 工具时，系统提示自动注入右侧工作台自测验收闭环协议", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-wb-protocol-"));
  const ctx = new Context();
  let capturedSystem = "";

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      capturedSystem = input.messages[0]?.content ?? "";
      return { model: profile.model, provider: profile.kind, content: "ok", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  ctx.tools.registerTool({
    name: "browser_navigate",
    title: "打开网页",
    description: "测试用内置浏览器导航占位",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => ({ ok: true, output: "ok", summary: "ok" }),
  });
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "工作台自测协议" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "帮我检查页面",
      workspaceRoots: [tempRoot],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    assert.match(capturedSystem, /右侧工作台与内置浏览器闭环验收/u);
    assert.match(capturedSystem, /browser_visual_check/u);
    assert.match(capturedSystem, /browser_console/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("仅打开预览时主 Agent 可以展示浏览器，多步操控工具仍交给子智能体", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-browser-sub-enforced-"));
  const ctx = new Context();
  let seenToolNames: string[] = [];

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      seenToolNames = (input.tools ?? []).map((t) => t.name);
      return { model: profile.model, provider: profile.kind, content: "ok", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  ctx.tools.registerTool({
    name: "invoke_subagent",
    title: "派发子智能体",
    description: "测试占位",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => ({ ok: true, output: "ok", summary: "ok" }),
  });
  ctx.tools.registerTool({
    name: "browser_navigate",
    title: "打开网页",
    description: "测试占位",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => ({ ok: true, output: "ok", summary: "ok" }),
  });
  ctx.tools.registerTool({
    name: "browser_present",
    title: "展示网页预览",
    description: "测试占位",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => ({ ok: true, output: "ok", summary: "ok" }),
  });
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "子智能体隔离" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "打开浏览器给我看",
      workspaceRoots: [tempRoot],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    assert.equal(seenToolNames.includes("invoke_subagent"), true);
    assert.equal(seenToolNames.includes("browser_navigate"), false);
    assert.equal(seenToolNames.includes("browser_present"), true);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
