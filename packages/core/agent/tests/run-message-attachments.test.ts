// 验证 Agent 运行把用户图片附件与引用图写入用户消息，供聊天气泡还原缩略图。
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

// 命令审计写入临时文件，避免测试污染用户目录。
process.env.LFAA_COMMAND_AUDIT_LOG = path.join(os.tmpdir(), `lfaa-agent-attachment-${process.pid}.jsonl`);

test("运行落盘时保留用户图片附件与引用图", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-attachments-"));
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile) => ({
      model: profile.model,
      provider: profile.kind,
      content: "收到，已按这张图处理。",
      finishReason: "stop",
      toolCalls: [],
      usage: { promptTokens: 20, completionTokens: 6, cachedPromptTokens: 0 },
    }),
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(dir, "rules.json") });
  await ctx.plugin(memoryPlugin, { sessionsDir: path.join(dir, "sessions"), memoryFilePath: path.join(dir, "memory.json") });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin);
  try {
    const session = await ctx.memory.createSession({});
    const referencePath = path.join(dir, ".lfaa-media", "images", "generated.png");
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "按这张图改一下",
      workspaceRoots: [dir],
      permissionMode: "full",
      attachments: [{ id: "uploaded-1", kind: "image" }],
      references: [{ messageId: "assistant-1", path: referencePath }],
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待运行结束超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (event) => {
        if (event.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });

    const saved = (await ctx.memory.getSession(session.id))?.messages.find((message) => message.role === "user");
    assert.deepEqual(saved?.attachments, [{ id: "uploaded-1", kind: "image" }]);
    assert.deepEqual(saved?.references, [{ messageId: "assistant-1", path: referencePath }]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("没有图片时用户消息不写空的附件字段", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-no-attachments-"));
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile) => ({
      model: profile.model,
      provider: profile.kind,
      content: "好的。",
      finishReason: "stop",
      toolCalls: [],
      usage: { promptTokens: 8, completionTokens: 2, cachedPromptTokens: 0 },
    }),
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(dir, "rules.json") });
  await ctx.plugin(memoryPlugin, { sessionsDir: path.join(dir, "sessions"), memoryFilePath: path.join(dir, "memory.json") });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin);
  try {
    const session = await ctx.memory.createSession({});
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "只聊天",
      workspaceRoots: [dir],
      permissionMode: "full",
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待运行结束超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (event) => {
        if (event.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });
    const saved = (await ctx.memory.getSession(session.id))?.messages.find((message) => message.role === "user");
    assert.equal(Object.hasOwn(saved ?? {}, "attachments"), false);
    assert.equal(Object.hasOwn(saved ?? {}, "references"), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});