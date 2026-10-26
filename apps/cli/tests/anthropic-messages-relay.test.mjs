import test from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";

const {
  ANTHROPIC_MESSAGES_ENDPOINT,
  ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES,
  forwardAnthropicMessages
} = await import("lfaa-llm/src/anthropic-messages.js");
const {
  ANTHROPIC_RELAY_RESPONSE_MAX_BYTES,
  createClaudeAnthropicRelay
} = await import("lfaa-subagent-claude-code/src/anthropic-relay.js");

const accountKey = "sk-ant-relay-contract-fixture";
const messageBody = Buffer.from(JSON.stringify({
  model: "claude-test-model",
  max_tokens: 32,
  stream: true,
  messages: [{ role: "user", content: "hello" }]
}));
const headersFor = token => ({
  "content-type": "application/json",
  "anthropic-version": "2023-06-01",
  "x-api-key": token
});

function rejectDeclaredOversizedRequest(relay) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${relay.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        ...headersFor(relay.token),
        "content-length": String(ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES + 1)
      }
    });
    request.once("response", response => {
      const status = response.statusCode;
      response.resume();
      response.once("end", () => resolve(status));
    });
    request.once("error", reject);
    request.end();
  });
}

test("LLM Owner 固定 Anthropic endpoint、POST、API version、Key 与 redirect:error", async () => {
  let captured;
  const signal = new AbortController().signal;
  const response = await forwardAnthropicMessages({
    apiKey: accountKey,
    body: messageBody,
    betaHeader: "fine-grained-tool-streaming-2025-05-14",
    signal
  }, async (url, init) => {
    captured = { url, init };
    return new Response("event: message_stop\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } });
  });

  assert.equal(response.status, 200);
  assert.equal(captured.url, ANTHROPIC_MESSAGES_ENDPOINT);
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.redirect, "error");
  assert.equal(captured.init.signal, signal);
  assert.equal(captured.init.headers["x-api-key"], accountKey);
  assert.equal(captured.init.headers["anthropic-version"], "2023-06-01");
  assert.equal(captured.init.headers["anthropic-beta"], "fine-grained-tool-streaming-2025-05-14");
  assert.equal(captured.init.headers.host, undefined);
  assert.deepEqual(JSON.parse(Buffer.from(captured.init.body).toString("utf8")), JSON.parse(messageBody.toString("utf8")));

  await assert.rejects(forwardAnthropicMessages({ apiKey: accountKey, body: messageBody, betaHeader: "bad\r\nheader", signal }, async () => new Response()));
  await assert.rejects(forwardAnthropicMessages({ apiKey: accountKey, body: Buffer.alloc(ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES + 1), signal }, async () => new Response()));
  await assert.rejects(forwardAnthropicMessages({ apiKey: "bad\nkey", body: messageBody, signal }, async () => new Response()));
});

test("单次 relay 只接受绑定 token 的 POST /v1/messages 和有界流式 JSON", async () => {
  const forwarded = [];
  const sse = "event: message_start\ndata: {\"type\":\"message_start\"}\n\nevent: message_stop\ndata: {\"type\":\"message_stop\"}\n\n";
  const relay = await createClaudeAnthropicRelay(accountKey, new AbortController().signal, async input => {
    forwarded.push(input);
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  try {
    const invalidRoute = await fetch(`${relay.baseUrl}/other`, { method: "POST", headers: headersFor(relay.token), body: messageBody });
    assert.equal(invalidRoute.status, 404);
    const unsupportedQuery = await fetch(`${relay.baseUrl}/v1/messages?destination=https://attacker.invalid`, {
      method: "POST", headers: headersFor(relay.token), body: messageBody
    });
    assert.equal(unsupportedQuery.status, 404);
    const invalidMethod = await fetch(`${relay.baseUrl}/v1/messages`, { method: "GET", headers: headersFor(relay.token) });
    assert.equal(invalidMethod.status, 405);
    const invalidToken = await fetch(`${relay.baseUrl}/v1/messages`, { method: "POST", headers: headersFor("wrong-token"), body: messageBody });
    assert.equal(invalidToken.status, 401);
    const invalidContentType = await fetch(`${relay.baseUrl}/v1/messages`, {
      method: "POST", headers: { ...headersFor(relay.token), "content-type": "text/plain" }, body: messageBody
    });
    assert.equal(invalidContentType.status, 415);
    const invalidJson = await fetch(`${relay.baseUrl}/v1/messages`, {
      method: "POST", headers: headersFor(relay.token), body: "not-json"
    });
    assert.equal(invalidJson.status, 400);
    assert.equal(await rejectDeclaredOversizedRequest(relay), 413);
    assert.equal(forwarded.length, 0, "rejected requests must not reach the Anthropic transport");

    const valid = await fetch(`${relay.baseUrl}/v1/messages?beta=true`, {
      method: "POST",
      headers: { ...headersFor(relay.token), accept: "text/event-stream" },
      body: messageBody
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get("location"), null);
    assert.equal(await valid.text(), sse, "SSE bytes pass through without buffering or transformation");
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].apiKey, accountKey);
    assert.deepEqual(JSON.parse(Buffer.from(forwarded[0].body).toString("utf8")), JSON.parse(messageBody.toString("utf8")));
    assert.equal(forwarded[0].signal.aborted, false);
  } finally {
    await relay.close();
  }
});

test("relay refuses upstream redirects and redacts bounded provider error bodies", async () => {
  const relay = await createClaudeAnthropicRelay(accountKey, new AbortController().signal, async () => new Response("", {
    status: 302,
    headers: { location: "https://attacker.invalid/collect" }
  }));
  try {
    const redirect = await fetch(`${relay.baseUrl}/v1/messages`, {
      method: "POST", headers: headersFor(relay.token), body: messageBody, redirect: "manual"
    });
    assert.equal(redirect.status, 502);
    assert.equal(redirect.headers.get("location"), null, "provider redirect targets never reach the SDK");
  } finally {
    await relay.close();
  }

  let token;
  const errorRelay = await createClaudeAnthropicRelay(accountKey, new AbortController().signal, async () => new Response(
    JSON.stringify({ type: "error", error: { message: `echo ${accountKey} ${token}` } }),
    { status: 401, headers: { "content-type": "application/json" } }
  ));
  token = errorRelay.token;
  try {
    const error = await fetch(`${errorRelay.baseUrl}/v1/messages`, {
      method: "POST", headers: headersFor(errorRelay.token), body: messageBody
    });
    const text = await error.text();
    assert.equal(error.status, 401);
    assert.equal(text.includes(accountKey), false);
    assert.equal(text.includes(token), false);
    assert.match(text, /Anthropic API Key 已脱敏/u);
    assert.match(text, /relay token 已脱敏/u);
  } finally {
    await errorRelay.close();
  }
});

test("Run 取消会中止上游流并关闭临时 relay listener", async () => {
  const run = new AbortController();
  let upstreamSignal;
  let markAborted;
  const upstreamAborted = new Promise(resolve => { markAborted = resolve; });
  const upstreamStream = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode("event: ping\ndata: {}\n\n")); }
  });
  const relay = await createClaudeAnthropicRelay(accountKey, run.signal, async input => {
    upstreamSignal = input.signal;
    input.signal.addEventListener("abort", () => markAborted(), { once: true });
    return new Response(upstreamStream, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  try {
    const response = await fetch(`${relay.baseUrl}/v1/messages`, {
      method: "POST", headers: headersFor(relay.token), body: messageBody
    });
    const reader = response.body.getReader();
    const firstChunk = await reader.read();
    assert.equal(firstChunk.done, false);
    assert.ok(upstreamSignal);
    run.abort();
    let timeout;
    await Promise.race([
      upstreamAborted,
      new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("upstream cancellation timed out")), 3000); })
    ]);
    clearTimeout(timeout);
    assert.equal(upstreamSignal.aborted, true);
    await reader.cancel().catch(() => undefined);
  } finally {
    await relay.close();
  }
  await assert.rejects(fetch(`${relay.baseUrl}/v1/messages`, { method: "POST", headers: headersFor(relay.token), body: messageBody }));
});

test("relay 将上游响应流限制在固定字节预算内", async () => {
  const tooLargeStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(ANTHROPIC_RELAY_RESPONSE_MAX_BYTES + 1));
      controller.close();
    }
  });
  const relay = await createClaudeAnthropicRelay(accountKey, new AbortController().signal, async () => new Response(
    tooLargeStream,
    { status: 200, headers: { "content-type": "text/event-stream" } }
  ));
  try {
    await assert.rejects(fetch(`${relay.baseUrl}/v1/messages`, {
      method: "POST", headers: headersFor(relay.token), body: messageBody
    }));
  } finally {
    await relay.close();
  }
});
