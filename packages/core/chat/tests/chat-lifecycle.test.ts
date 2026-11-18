// 验证 @lfaa/chat Host/Client 双端 Cordis 生命周期、最近会话注入与项目聊天计数统计。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "@lfaa/memory";
import { chatPlugin } from "../src/index";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

test("Host chatPlugin 管理会话 CRUD 并统计项目非归档聊天数", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-chat-host-"));
  const ctx = new Context();
  const memFiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await memFiber;
  const chatFiber = ctx.plugin(chatPlugin);
  await chatFiber;

  try {
    const s1 = await ctx.chat.createSession({ title: "会话 1", projectId: "proj-a" });
    const s2 = await ctx.chat.createSession({ title: "会话 2", projectId: "proj-a" });
    await ctx.chat.updateSession(s2.id, { archived: true });

    const counts = await ctx.chat.countByProject(false);
    assert.equal(counts["proj-a"], 1);
    assert.equal((await ctx.chat.getSession(s1.id))?.title, "会话 1");

    assert.equal(await ctx.chat.deleteSession(s1.id), true);
    assert.equal(await ctx.chat.getSession(s1.id), null);

    await chatFiber.dispose();
    assert.equal((ctx as { chat?: unknown }).chat, undefined);
    await memFiber.dispose();
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Client chatClientPlugin 注册 workspace/配置视图/上下文面板与 chatProvider 并在 dispose 时完全卸载", async () => {
  const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
  const { chatClientPlugin } = await import("../client/index");
  const ctx = new Context();
  new WorkbenchClientService(ctx);

  const fiber = ctx.plugin(chatClientPlugin);
  await fiber;

  const snap = ctx.workbench.getSnapshot();
  assert.ok(snap.views.some((v) => v.id === "workspace"), "应注册 workspace 聊天视图");
  assert.ok(snap.views.some((v) => v.id === "settings:config"), "应注册 settings:config 模型规则页");
  assert.ok(snap.contextPanels.some((p) => p.id === "agent-capabilities"), "应注册右侧 Agent 能力栏");
  assert.ok(snap.chatProvider !== null, "应注册 chatProvider");

  await fiber.dispose();
  const afterDispose = ctx.workbench.getSnapshot();
  assert.equal(afterDispose.views.some((v) => v.id === "workspace"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:config"), false);
  assert.equal(afterDispose.contextPanels.some((p) => p.id === "agent-capabilities"), false);
  assert.equal(afterDispose.chatProvider, null);
});
