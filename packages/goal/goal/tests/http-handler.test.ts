// 验证目标 HTTP 接口：按会话读取目标、编辑目标文字、空值与跨会话编辑被拒绝。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { createGoalHttpHandler, GoalService } from "../src/index";

async function call(handler: ReturnType<typeof createGoalHttpHandler>, method: string, url: string, body?: unknown) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body), "utf8");
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
  return { handled, status, json: JSON.parse(rawBody) as Record<string, unknown> };
}

test("目标接口按会话读取并可编辑目标文字", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-goal-http-"));
  try {
    const service = new GoalService(new Context(), { storeFilePath: path.join(dir, "goals.json") });
    const goal = await service.create({ title: "重组包", objective: "把 core/chat 拆成三个包", sessionId: "s1" });
    const handler = createGoalHttpHandler(service);

    const list = await call(handler, "GET", "/api/goals?sessionId=s1");
    assert.equal(list.handled, true);
    assert.equal(list.status, 200);
    assert.equal((list.json.goals as Array<{ id: string }>).length, 1);
    assert.equal((list.json.goals as Array<{ id: string }>)[0]?.id, goal.id);

    const patched = await call(handler, "PATCH", `/api/goals/${goal.id}`, { sessionId: "s1", objective: "新的目标文字" });
    assert.equal(patched.status, 200);
    assert.equal((patched.json.goal as { objective: string }).objective, "新的目标文字");
    assert.equal((await service.get(goal.id))?.objective, "新的目标文字");

    const missing = await call(handler, "GET", "/api/goals");
    assert.equal(missing.status, 400);
    const empty = await call(handler, "PATCH", `/api/goals/${goal.id}`, { sessionId: "s1", objective: "   " });
    assert.equal(empty.status, 400);
    const crossSession = await call(handler, "PATCH", `/api/goals/${goal.id}`, { sessionId: "other", objective: "越权" });
    assert.equal(crossSession.status, 404);
    const wrongMethod = await call(handler, "POST", "/api/goals");
    assert.equal(wrongMethod.status, 405);
    const passthrough = await handler({ url: "/api/chat/x", method: "GET" } as never, {} as never);
    assert.equal(passthrough, false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});