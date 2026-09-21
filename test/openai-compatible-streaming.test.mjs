/**
 * 文件：openai-compatible-streaming.test.mjs
 * 作用：验证 OpenAI-compatible Runtime 会消费真实 SSE 增量，而不是等待完整 JSON 后一次性返回。
 * 负责：DeepSeek/Chat Completions 风格 SSE、OpenAI Responses 风格 SSE、delta 回调与最终文本收敛。
 * 不负责：真实网络、账户 Secret 持久化、React 渲染、Codex/ChatGPT 套餐 Runtime。
 * 状态归属：测试内临时 fetch stub；不写磁盘状态。
 * 对外接口：Node test runner。
 * 关联文件：packages/llm/openai-compatible/src/index.ts、packages/api/agent-controller/src/agent-runtime-bridge.ts。
 * 修改注意事项：本测试必须证明 delta 在流读取过程中被回调；禁止退化成只断言源码字符串存在。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { callOpenAiCompatibleTextModel } from "@lfaa/llm-openai-compatible";

const account = {
  id: "deepseek-account",
  providerId: "deepseek",
  displayName: "DeepSeek",
  authMethodId: "api-key",
  credentialRef: "secret:test",
  settings: {},
  selectedModelId: "deepseek-flash",
  modelSettings: { reasoningEffort: "high" },
  modelCatalog: [],
  verificationStatus: "connected",
  lastVerifiedAt: null,
  createdAt: "2026-09-21T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
};

const request = {
  workspaceMode: "chat",
  input: "你好",
  model: { accountId: account.id, providerId: "deepseek", modelId: "deepseek-flash", settings: { reasoningEffort: "high" } },
  permissionProfileId: "request-approval",
  workspaceId: "workspace:test",
};

function sseResponse(frames) {
  const encoder = new TextEncoder();
  let index = 0;
  return new Response(new ReadableStream({
    async pull(controller) {
      if (index >= frames.length) {
        controller.close();
        return;
      }
      await Promise.resolve();
      controller.enqueue(encoder.encode(frames[index++]));
    },
  }), { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } });
}

test("DeepSeek/OpenAI-compatible Chat Completions streams assistant deltas before final completion", async () => {
  const originalFetch = globalThis.fetch;
  const deltas = [];
  let seenBody = null;
  globalThis.fetch = async (_url, init) => {
    seenBody = JSON.parse(String(init.body));
    return sseResponse([
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);
  };
  try {
    const text = await callOpenAiCompatibleTextModel({
      account,
      request,
      credential: "test-secret",
      history: [{ role: "user", content: "你好" }],
      signal: new AbortController().signal,
      onTextDelta(delta) { deltas.push(delta); },
    });
    assert.equal(seenBody.stream, true);
    assert.deepEqual(deltas, ["你", "好"]);
    assert.equal(text, "你好");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI Responses SSE response.output_text.delta uses the same delta contract", async () => {
  const originalFetch = globalThis.fetch;
  const openAiAccount = { ...account, id: "openai-account", providerId: "openai", selectedModelId: "gpt-5.6-luna" };
  const openAiRequest = { ...request, model: { accountId: openAiAccount.id, providerId: "openai", modelId: "gpt-5.6-luna" } };
  const deltas = [];
  globalThis.fetch = async () => sseResponse([
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"流"}\n\n',
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"式"}\n\n',
    'data: [DONE]\n\n',
  ]);
  try {
    const text = await callOpenAiCompatibleTextModel({
      account: openAiAccount,
      request: openAiRequest,
      credential: "test-secret",
      history: [{ role: "user", content: "test" }],
      signal: new AbortController().signal,
      onTextDelta(delta) { deltas.push(delta); },
    });
    assert.deepEqual(deltas, ["流", "式"]);
    assert.equal(text, "流式");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
