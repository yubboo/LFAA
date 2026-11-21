// 验证 /api/agent/runs 把附件与引用图转成宿主校验后的落库字段，并忽略无法校验的来源。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { createAgentHttpHandler, type AgentService, type StartAgentRunInput } from "../src/index";

/** 捕获 startRun 入参的最小服务替身。 */
function fakeService(captured: StartAgentRunInput[]) {
  return {
    startRun: async (input: StartAgentRunInput) => {
      captured.push(input);
      return { runId: "run-1", sessionId: input.sessionId, assistantMessageId: "assistant-1" };
    },
  } as unknown as AgentService;
}

function fakeRequest(body: Record<string, unknown>): IncomingMessage {
  const payload = Buffer.from(JSON.stringify(body));
  return {
    url: "/api/agent/runs",
    method: "POST",
    async *[Symbol.asyncIterator]() { yield payload; },
  } as unknown as IncomingMessage;
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

test("附件与引用图经宿主校验后进入运行输入", async () => {
  const captured: StartAgentRunInput[] = [];
  const handler = createAgentHttpHandler(fakeService(captured), {
    resolveAttachments: async (_sessionId, ids) => (Array.isArray(ids) ? ids : [])
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({ id, kind: "image" as const })),
    resolveReferenceImages: async () => ["C:\\ws\\.lfaa-media\\images\\resolved.png"],
  });
  const response = fakeResponse();
  const handled = await handler(fakeRequest({
    sessionId: "s1",
    userMessage: "按这张图改",
    attachmentIds: ["att-1"],
    referenceSources: [{ messageId: "m1", path: "C:\\ws\\.lfaa-media\\images\\client-path.png" }],
  }), response.res);

  assert.equal(handled, true);
  assert.equal(response.status(), 201);
  assert.deepEqual(captured[0]?.attachments, [{ id: "att-1", kind: "image" }]);
  // 落库用宿主解析出的真实路径，而不是客户端传来的路径。
  assert.deepEqual(captured[0]?.references, [{ messageId: "m1", path: "C:\\ws\\.lfaa-media\\images\\resolved.png" }]);
});

test("引用来源数量与解析结果不一致时不落引用", async () => {
  const captured: StartAgentRunInput[] = [];
  const handler = createAgentHttpHandler(fakeService(captured), {
    resolveReferenceImages: async () => ["only-one.png"],
  });
  const response = fakeResponse();
  await handler(fakeRequest({
    sessionId: "s1",
    userMessage: "按这张图改",
    referenceSources: [{ messageId: "m1" }, { messageId: "m2" }],
  }), response.res);

  assert.equal(response.status(), 201);
  assert.equal(Object.hasOwn(captured[0] ?? {}, "references"), false);
  assert.equal(Object.hasOwn(captured[0] ?? {}, "attachments"), false);
});