// 验证 @lfaa/memory 短期会话持久化、项目聊天计数（不含归档）、窗口裁剪及长期记忆召回。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "../src/index";

test("Host memoryPlugin 持久化会话消息、裁剪上下文并召回相关长期记忆", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-memory-test-"));
  const ctx = new Context();
  const fiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await fiber;

  try {
    const s1 = await ctx.memory.createSession({ projectId: "proj-1" });
    await ctx.memory.appendMessage(s1.id, {
      id: "m1",
      role: "user",
      content: "帮我检查 src/index.ts 中的服务导出",
      createdAt: Date.now(),
    });
    await ctx.memory.appendMessage(s1.id, {
      id: "m2",
      role: "assistant",
      content: "已核查完毕，导出结构完整。",
      createdAt: Date.now(),
    });

    const s2 = await ctx.memory.createSession({ projectId: "proj-1" });
    await ctx.memory.updateSession(s2.id, { archived: true });

    const countsActive = await ctx.memory.countSessionsByProject(false);
    const countsWithArchived = await ctx.memory.countSessionsByProject(true);
    assert.equal(countsActive["proj-1"], 1);
    assert.equal(countsWithArchived["proj-1"], 2);

    const loaded = await ctx.memory.getSession(s1.id);
    assert.equal(loaded?.title, "帮我检查 src/index.ts 中的服务导出");
    assert.equal(loaded?.messages.length, 2);

    await ctx.memory.addMemory({
      scope: "project",
      projectId: "proj-1",
      content: "该项目严格要求 pnpm workspace 与中文文件头注释。",
      tags: ["规范", "pnpm"],
    });
    await ctx.memory.addMemory({
      scope: "global",
      content: "用户偏好简洁响应。",
    });

    const recalled = await ctx.memory.recallRelevantMemories({
      query: "检查 pnpm 注释规范",
      projectId: "proj-1",
    });
    assert.ok(recalled[0]?.content.includes("pnpm"));

    const windowCtx = await ctx.memory.buildContextMessages(s1.id, { maxRecentMessages: 1 });
    assert.equal(windowCtx.recentMessages.length, 1);
    assert.ok(windowCtx.summaryNote?.includes("1 条历史消息"));

    await fiber.dispose();
    assert.equal((ctx as { memory?: unknown }).memory, undefined);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
