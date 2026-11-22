// 验证任务清单只读：HTTP PATCH 带 todos 会被明确拒绝，清单保持 Agent 写入的状态。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "@lfaa/memory";
import { chatPlugin, createChatHttpHandler } from "../src/index";

const TODOS = [
  { id: "1", content: "读源码", status: "completed" as const },
  { id: "2", content: "写测试", status: "in_progress" as const },
  { id: "3", content: "跑构建", status: "pending" as const },
];

test("手动改写任务清单被拒绝，已完成/进行中/待处理保持 Agent 写入值", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-chat-todo-readonly-"));
  const ctx = new Context();
  const memFiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await memFiber;
  const chatFiber = ctx.plugin(chatPlugin);
  await chatFiber;

  try {
    const session = await ctx.chat.createSession({ title: "清单只读" });
    await ctx.memory.updateSession(session.id, { todos: TODOS });

    const handler = createChatHttpHandler(ctx.chat);
    const req = Object.assign(new EventEmitter(), {
      url: `/api/chat/sessions/${session.id}`,
      method: "PATCH",
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({
          todos: TODOS.map((item) => ({ ...item, status: "completed" })),
        }), "utf8");
      },
    });
    let status = 200;
    let rawBody = "";
    const res = {
      statusCode: 200,
      setHeader: () => undefined,
      end: (chunk?: string | Buffer) => {
        status = res.statusCode;
        rawBody = chunk ? chunk.toString() : "";
      },
    };

    const handled = await handler(req as never, res as never);
    assert.equal(handled, true);
    assert.equal(status, 400);
    assert.match((JSON.parse(rawBody) as { error: string }).error, /Agent 维护/u);
    assert.deepEqual((await ctx.chat.getSession(session.id))?.todos, TODOS);
  } finally {
    await chatFiber.dispose();
    await memFiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});