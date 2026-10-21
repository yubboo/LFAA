/**
 * 功能：回归 LLM Provider 的 HTTP 错误映射。
 * 作用：使用合成响应验证面向用户的失败提示，且不读取或泄漏 Provider 错误正文。
 * 关联文件：packages/llm/llm/src/completion.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { AiRecoverableRequestError, createAiCompletionService, streamAiCompletion } from "../../../packages/llm/llm/src/completion.ts";
import { readArkUsage } from "../../../packages/llm/llm-pi-ai/src/adapter.ts";

function completionInput() {
  return {
    account: {
      accountId: "fixture-account",
      providerId: "fixture-provider",
      modelId: "fixture-model",
      maxOutputTokens: 0,
      reasoningMode: "default",
      maxTokensField: "max_tokens",
      chatUrl: "https://provider.example/v1/chat/completions",
      keyHeader: "Authorization",
      keyPrefix: "Bearer ",
      secret: "fixture-secret-not-a-real-key"
    },
    applicationId: "workspace",
    permissionMode: "full",
    messages: [],
    extensions: [],
    settings: { speed: "balanced", maxOutputTokens: 0, requestTimeoutSeconds: 5 },
    signal: new AbortController().signal,
    onDelta() {},
    onProgress() {}
  };
}

test("HTTP 402 explains the Provider balance/quota issue without exposing its response body", async () => {
  const originalFetch = globalThis.fetch;
  const providerBody = "private-provider-response-body";
  try {
    globalThis.fetch = async () => new Response(providerBody, { status: 402 });

    await assert.rejects(streamAiCompletion(completionInput()), error => {
      assert.equal(error.message, "当前模型 Provider 的账户余额或可用额度不足（HTTP 402）。请为该 Provider 充值，或检查套餐/额度后重试。");
      assert.equal(error instanceof AiRecoverableRequestError, false, "余额/额度类错误不应自动重试");
      assert.equal(error.message.includes(providerBody), false, "Provider 错误正文不得泄漏");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LLM Provider adapters replace one provider route and are removed with their owner", async () => {
  const service = createAiCompletionService();
  const expected = { text: "adapter result", usage: null, toolCalls: [], providerReplay: null };
  let calls = 0;
  const adapter = { async stream(input) { calls += 1; assert.equal(input.account.providerId, "fixture-provider"); return expected; } };
  const dispose = service.registerAdapter("fixture-provider", adapter);
  assert.deepEqual(service.listAdapters(), ["fixture-provider"]);
  assert.equal(await service.streamCompletion(completionInput()), expected);
  assert.equal(calls, 1);
  assert.throws(() => service.registerAdapter("fixture-provider", adapter), /重复登记/u);
  dispose();
  dispose();
  assert.deepEqual(service.listAdapters(), []);
});

const sse = (deltas, end = 'data: [DONE]\n\n') => new Response(deltas.map(delta => 'data: ' + JSON.stringify({ choices: [{ delta }] }) + '\n\n').join('') + end, { headers: { 'Content-Type': 'text/event-stream' } });

test("保留完整 reasoning_content 续接同模型，跨 Provider/模型与请求观察者不接收私有协议", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [], snapshots = [];
  const hidden = 'private-fixture-reasoning';
  try {
    globalThis.fetch = async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return bodies.length === 1
        ? sse([{ reasoning_content: 'private-fixture-' }, { reasoning_content: 'reasoning', tool_calls: [{ index: 0, id: 'call1', function: { name: 'read_fixture', arguments: '{}' } }] }])
        : sse([{ content: '已完成' }]);
    };
    const input = completionInput();
    input.onRequest = value => snapshots.push(value);
    const first = await streamAiCompletion(input);
    assert.equal(first.providerReplay.reasoningContent, hidden);
    input.messages = [{ role: 'assistant', content: null, providerReplay: first.providerReplay, tool_calls: [{ id: 'call1', type: 'function', function: { name: 'read_fixture', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'call1', content: '真实夹具结果' }];
    await streamAiCompletion(input);
    assert.equal(bodies[1].messages[1].reasoning_content, hidden);
    assert.equal(Object.hasOwn(bodies[1].messages[1], 'providerReplay'), false);
    assert.doesNotMatch(JSON.stringify(snapshots), /private-fixture/u);
    await streamAiCompletion({ ...input, account: { ...input.account, modelId: 'other-model' } });
    await streamAiCompletion({ ...input, account: { ...input.account, providerId: 'other-provider' } });
    await streamAiCompletion({ ...input, account: { ...input.account, accountId: 'other-account' } });
    for (const body of bodies.slice(2)) assert.equal(Object.hasOwn(body.messages[1], 'reasoning_content'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("SSE 提前 EOF 不完成半截回答或派发工具，无输出时仅标记为可恢复请求", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const delta of [{ content: '半截回答' }, { tool_calls: [{ index: 0, id: 'partial', function: { name: 'read_fixture', arguments: '{}' } }] }, { reasoning_content: 'private-fixture' }]) {
      let responseRecorded = false;
      globalThis.fetch = async () => sse([delta], '');
      await assert.rejects(streamAiCompletion({ ...completionInput(), onResponse: () => { responseRecorded = true; } }), error => {
        assert.match(error.message, /完成标记前中断/u);
        assert.equal(error instanceof AiRecoverableRequestError, Boolean(delta.reasoning_content));
        return true;
      });
      assert.equal(responseRecorded, false);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("DeepSeek 流式 usage 保留缓存命中数，兼容嵌套 cached_tokens 且不把 0 当缺失", async () => {
  const originalFetch = globalThis.fetch;
  const response = usage => new Response([
    `data: ${JSON.stringify({ choices: [{ delta: { content: "已完成" }, finish_reason: "stop" }], usage })}\n\n`,
    "data: [DONE]\n\n"
  ].join(""), { headers: { "Content-Type": "text/event-stream" } });
  try {
    globalThis.fetch = async () => response({ prompt_tokens: 100, completion_tokens: 8, prompt_cache_hit_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } });
    const cold = await streamAiCompletion(completionInput());
    assert.deepEqual(cold.usage, { promptTokens: 100, completionTokens: 8, cacheReadTokens: 0 });

    globalThis.fetch = async () => response({ prompt_tokens: 100, completion_tokens: 8, prompt_tokens_details: { cached_tokens: 76 } });
    const warm = await streamAiCompletion(completionInput());
    assert.deepEqual(warm.usage, { promptTokens: 100, completionTokens: 8, cacheReadTokens: 76 });

    globalThis.fetch = async () => response({ prompt_tokens: 100, completion_tokens: 8, prompt_cache_miss_tokens: 24 });
    const fromMissCount = await streamAiCompletion(completionInput());
    assert.deepEqual(fromMissCount.usage, { promptTokens: 100, completionTokens: 8, cacheReadTokens: 76 });

    globalThis.fetch = async () => response({ prompt_tokens: 100, completion_tokens: 8, prompt_cache_miss_tokens: 101 });
    const invalidMissCount = await streamAiCompletion(completionInput());
    assert.deepEqual(invalidMissCount.usage, { promptTokens: 100, completionTokens: 8, cacheReadTokens: null });
  } finally { globalThis.fetch = originalFetch; }
});

test("Ark usage 只在 Provider 返回命中或 miss 计数时计算缓存读取量", () => {
  assert.deepEqual(readArkUsage({ prompt_tokens: 100, completion_tokens: 8, prompt_cache_miss_tokens: 24 }), {
    promptTokens: 100, completionTokens: 8, cacheReadTokens: 76
  });
  assert.deepEqual(readArkUsage({ prompt_tokens: 100, completion_tokens: 8, prompt_cache_miss_tokens: 101 }), {
    promptTokens: 100, completionTokens: 8, cacheReadTokens: null
  });
  assert.deepEqual(readArkUsage({ prompt_tokens: 100, completion_tokens: 8 }), {
    promptTokens: 100, completionTokens: 8, cacheReadTokens: null
  });
});

test("无换行 DONE 与正常 finish_reason 均可结束，Provider 错误结束不得视为成功", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const end of ['data: [DONE]', 'data: '+JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })+'\n\n']) {
      globalThis.fetch = async () => sse([{ content: '完整回答' }], end);
      await streamAiCompletion(completionInput());
    }
    globalThis.fetch = async () => sse([{ content: '被过滤的半截回答' }], 'data: '+JSON.stringify({ choices: [{ delta: {}, finish_reason: 'content_filter' }] })+'\n\ndata: [DONE]\n\n');
    await assert.rejects(streamAiCompletion(completionInput()), /未以正常回答或工具选择结束/u);
  } finally { globalThis.fetch = originalFetch; }
});

test("带工具的 HTTP 400 不冒充模型不支持工具，也不泄露错误响应正文", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('private-provider-response-body', { status: 400 });
    await assert.rejects(streamAiCompletion({ ...completionInput(), tools: [{ type: 'function', function: { name: 'read_fixture', description: 'fixture', parameters: { type: 'object' } } }] }), error => {
      assert.equal(error.name, 'Error');
      assert.match(error.message, /对话协议/u);
      assert.doesNotMatch(error.message, /private-provider-response-body/u);
      return true;
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("SSE 错误帧不会被忽略为成功，错误正文不进入诊断", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => sse([{ content: '部分正文' }], 'data: '+JSON.stringify({ error: { message: 'private-provider-error' } })+'\n\ndata: [DONE]\n\n');
    await assert.rejects(streamAiCompletion(completionInput()), error => {
      assert.match(error.message, /Provider 流返回错误/u);
      assert.doesNotMatch(error.message, /private-provider-error/u);
      assert.equal(error instanceof AiRecoverableRequestError, false);
      return true;
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("其它 Provider 状态仍使用原有错误映射", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, expectedMessage, recoverable] of [
      [401, "Provider 拒绝了 API Key，请在“AI 与模型”检查密钥和区域。", false],
      [429, "Provider 请求过于频繁或账户额度不足（HTTP 429），请检查配额后重试。", true],
      [418, "Provider 返回 HTTP 418，请检查模型账户设置后重试。", false]
    ]) {
      globalThis.fetch = async () => new Response("private-provider-response-body", { status });
      await assert.rejects(streamAiCompletion(completionInput()), error => {
        assert.equal(error.message, expectedMessage);
        assert.equal(error instanceof AiRecoverableRequestError, recoverable);
        assert.equal(error.message.includes("private-provider-response-body"), false);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
