// 验证群聊接口：只接管 /api/group/runs、缺 sessionId 报 400、非群会话把原因透出。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createGroupHttpHandler } from "../src/index";

type Handler = ReturnType<typeof createGroupHttpHandler>;

async function call(handler: Handler, method: string, url: string, body?: unknown) {
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
  return { handled, status, json: rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {} };
}

test("非群聊路径不接管", async () => {
  const handler = createGroupHttpHandler({
    memory: { async getSession() { return null; } },
    agent: {
      async startRun() { throw new Error("不应调用"); },
      async waitForRun() { throw new Error("不应调用"); },
    },
  });
  const result = await call(handler, "POST", "/api/agent/runs", {});
  assert.equal(result.handled, false);
});

test("缺少 sessionId 返回 400", async () => {
  const handler = createGroupHttpHandler({
    memory: { async getSession() { return null; } },
    agent: {
      async startRun() { throw new Error("不应调用"); },
      async waitForRun() { throw new Error("不应调用"); },
    },
  });
  const result = await call(handler, "POST", "/api/group/runs", { userMessage: "hi" });
  assert.equal(result.status, 400);
  assert.match(String(result.json.error), /sessionId/u);
});

test("非群会话的业务错误原样返回", async () => {
  const handler = createGroupHttpHandler({
    memory: {
      async getSession() {
        return {
          id: "s1", title: "单聊", projectId: null, sectionId: null, pinned: false, archived: false,
          messageCount: 0, createdAt: 0, updatedAt: 0, messages: [],
        };
      },
    },
    agent: {
      async startRun() { throw new Error("不应调用"); },
      async waitForRun() { throw new Error("不应调用"); },
    },
  });
  const result = await call(handler, "POST", "/api/group/runs", { sessionId: "s1", userMessage: "hi" });
  assert.equal(result.status, 400);
  assert.match(String(result.json.error), /不是群聊/u);
});

test("只接受 POST", async () => {
  const handler = createGroupHttpHandler({
    memory: { async getSession() { return null; } },
    agent: {
      async startRun() { throw new Error("不应调用"); },
      async waitForRun() { throw new Error("不应调用"); },
    },
  });
  const result = await call(handler, "GET", "/api/group/runs");
  assert.equal(result.status, 405);
});