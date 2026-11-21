// 验证 /api/agent/active-sessions 返回所有仍在运行的会话 id，供左二栏显示工作转圈。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { createAgentHttpHandler, type AgentService } from "../src/index";

function fakeRequest(url = "/api/agent/active-sessions", method = "GET"): IncomingMessage {
  return { url, method } as unknown as IncomingMessage;
}

function fakeResponse(): { res: ServerResponse; status: () => number; text: () => string } {
  let statusCode = 200;
  let body = "";
  const res = {
    set statusCode(value: number) { statusCode = value; },
    get statusCode() { return statusCode; },
    setHeader() {},
    end(chunk?: string) { body = chunk ?? ""; },
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, text: () => body };
}

test("运行中会话接口列出全部仍在工作的会话", async () => {
  const service = {
    listRunningSessionIds: () => ["s1", "s2"],
  } as unknown as AgentService;
  const handler = createAgentHttpHandler(service);
  const response = fakeResponse();

  const handled = await handler(fakeRequest(), response.res);

  assert.equal(handled, true);
  assert.equal(response.status(), 200);
  assert.deepEqual(JSON.parse(response.text()), { sessionIds: ["s1", "s2"] });
});

test("待处理接口返回需要用户确认或回答的会话", async () => {
  const items = [
    { sessionId: "s1", kind: "approval" as const, toolName: "write_file" },
    { sessionId: "s2", kind: "question" as const, question: "选哪个？", messageId: "m1", options: ["A", "B"] },
  ];
  const service = { listAttention: async () => items } as unknown as AgentService;
  const handler = createAgentHttpHandler(service);
  const response = fakeResponse();

  const handled = await handler(fakeRequest("/api/agent/attention"), response.res);

  assert.equal(handled, true);
  assert.equal(response.status(), 200);
  assert.deepEqual(JSON.parse(response.text()), { items });
});

test("跳过澄清接口清除会话的待回答状态", async () => {
  const dismissed: string[] = [];
  const service = {
    dismissPendingQuestion: async (sessionId: string) => {
      dismissed.push(sessionId);
      return true;
    },
  } as unknown as AgentService;
  const handler = createAgentHttpHandler(service);
  const response = fakeResponse();

  const handled = await handler(fakeRequest("/api/agent/sessions/s-1/clarification/dismiss", "POST"), response.res);

  assert.equal(handled, true);
  assert.equal(response.status(), 200);
  assert.deepEqual(dismissed, ["s-1"]);
  assert.deepEqual(JSON.parse(response.text()), { ok: true });
});