/**
 * 功能：回归 LLM Provider 的 HTTP 错误映射。
 * 作用：使用合成响应验证面向用户的失败提示，且不读取或泄漏 Provider 错误正文。
 * 关联文件：packages/llm/llm/src/completion.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { AiRecoverableRequestError, AiToolArgumentsTooLargeError, createAiCompletionService, streamAiCompletion } from "../../../packages/llm/llm/src/completion.ts";
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

test("无输出的连接和流读取超时归入现有恢复重试合同", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const input = completionInput();
    input.settings.requestTimeoutSeconds = 0.01;
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      const fail = () => reject(options.signal.reason);
      if (options.signal.aborted) fail();
      else options.signal.addEventListener("abort", fail, { once: true });
    });
    await assert.rejects(streamAiCompletion(input), error => error instanceof AiRecoverableRequestError);

    globalThis.fetch = async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        const fail = () => controller.error(options.signal.reason);
        if (options.signal.aborted) fail();
        else options.signal.addEventListener("abort", fail, { once: true });
      }
    }), { headers: { "Content-Type": "text/event-stream" } });
    await assert.rejects(streamAiCompletion(input), error => error instanceof AiRecoverableRequestError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("模型持续返回推理/回答数据时不会因累计总时长超过无进展时限而中断", async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  try {
    const input = completionInput();
    input.settings.requestTimeoutSeconds = 0.1;
    globalThis.fetch = async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        const first = setTimeout(() => controller.enqueue(encoder.encode('data: ' + JSON.stringify({ choices: [{ delta: { reasoning_content: "持续推理" } }] }) + "\n\n")), 70);
        const second = setTimeout(() => {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: "最终答复" }, finish_reason: "stop" }] }) + "\n\ndata: [DONE]\n\n"));
          controller.close();
        }, 140);
        const abort = () => {
          clearTimeout(first);
          clearTimeout(second);
          controller.error(options.signal.reason);
        };
        if (options.signal.aborted) abort();
        else options.signal.addEventListener("abort", abort, { once: true });
      }
    }), { headers: { "Content-Type": "text/event-stream" } });

    const deltas = [];
    input.onDelta = delta => deltas.push(delta);
    const result = await streamAiCompletion(input);
    assert.deepEqual(deltas, ["最终答复"]);
    assert.deepEqual(result.toolCalls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("已输出部分正文或形成工具选择后的流超时不得自动重放", async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const frames = [
    'data: ' + JSON.stringify({ choices: [{ delta: { content: "部分正文" } }] }) + "\n\n",
    'data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "partial-call", function: { name: "read_fixture", arguments: "{}" } }] } }] }) + "\n\n"
  ];
  try {
    for (const frame of frames) {
      const input = completionInput();
      input.settings.requestTimeoutSeconds = 0.01;
      globalThis.fetch = async (_url, options) => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(frame));
          const fail = () => controller.error(options.signal.reason);
          if (options.signal.aborted) fail();
          else options.signal.addEventListener("abort", fail, { once: true });
        }
      }), { headers: { "Content-Type": "text/event-stream" } });
      await assert.rejects(streamAiCompletion(input), error => {
        assert.equal(error.name, "TimeoutError");
        assert.equal(error instanceof AiRecoverableRequestError, false);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("最终请求准备器看到组合后的 system、附件和工具，并在 HTTP body 前应用改写", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [], snapshots = [], preparedRequests = [];
  const sourceTool = { type: "function", function: { name: "source_tool", description: "source", parameters: { type: "object", properties: {} } } };
  const spillTool = { type: "function", function: { name: "agent_context_read_spill", description: "read spill", parameters: { type: "object", properties: { ref: { type: "string" } } } } };
  try {
    globalThis.fetch = async (_url, options) => { bodies.push(JSON.parse(options.body)); return sse([{ content: "prepared request finished" }]); };
    const input = completionInput();
    input.systemPrompt = "fixture system context";
    input.messages = [
      { role: "user", content: "current request" },
      { role: "user", content: [{ type: "text", text: "image attachment" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] }
    ];
    input.tools = [sourceTool];
    input.onPrepareRequest = async request => {
      preparedRequests.push(request);
      assert.equal(request.messages[0].role, "system");
      assert.match(request.messages[0].content, /fixture system context/u);
      assert.equal(request.messages.at(-1).content[1].type, "image_url");
      assert.deepEqual(request.tools, [sourceTool]);
      return {
        messages: [...request.messages, { role: "user", content: "preflight checkpoint" }],
        tools: [sourceTool, spillTool]
      };
    };
    input.onRequest = request => snapshots.push(request);
    await streamAiCompletion(input);

    assert.equal(preparedRequests.length, 1);
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].messages[0].role, "system");
    assert.ok(bodies[0].messages.some(message => message.content === "preflight checkpoint"));
    assert.deepEqual(bodies[0].tools, [sourceTool, spillTool]);
    assert.equal(snapshots[0].messages.some(message => message.content === "preflight checkpoint"), true);
    assert.deepEqual(snapshots[0].tools, [sourceTool, spillTool]);
    assert.equal(snapshots[0].reasoningReplayCharacters, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("最终请求准备器取消时不会发送 Provider 请求", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls += 1; return sse([{ content: "must not send" }]); };
    const input = completionInput();
    input.signal = controller.signal;
    input.onPrepareRequest = async () => { controller.abort(new DOMException("cancelled", "AbortError")); };
    await assert.rejects(streamAiCompletion(input), error => error.name === "AbortError");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("工具图片保留 tool_call 配对并作为独立 user 视觉消息发送", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [], snapshots = [], preparedMessages = [];
  try {
    globalThis.fetch = async (_url, options) => { bodies.push(JSON.parse(options.body)); return sse([{ content: "我看到了工具返回的画面" }]); };
    const input = completionInput();
    input.messages = [
      { role: "user", content: [{ type: "text", text: "请分析画面" }, { type: "image_url", image_url: { url: "data:image/png;base64,VVNFUg==" } }] },
      { role: "assistant", content: null, tool_calls: [
        { id: "call-one", type: "function", function: { name: "observe_one", arguments: "{}" } },
        { id: "call-two", type: "function", function: { name: "observe_two", arguments: "{}" } }
      ] },
      { role: "tool", tool_call_id: "call-one", content: [{ type: "text", text: "第一张抽帧" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,AA==", detail: "high" } }] },
      { role: "tool", tool_call_id: "call-two", content: [{ type: "text", text: "第二张抽帧" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,AQ==", detail: "high" } }] }
    ];
    input.onPrepareRequest = async request => {
      preparedMessages.push(request.messages);
    };
    input.onRequest = request => snapshots.push(request);

    await streamAiCompletion(input);

    const messages = bodies[0].messages;
    assert.deepEqual(messages.map(message => message.role), ["system", "user", "assistant", "tool", "tool", "user"]);
    assert.equal(messages[1].content[1].image_url.url, "data:image/png;base64,VVNFUg==", "用户直接提供的图片保持原样");
    assert.equal(messages[3].tool_call_id, "call-one");
    assert.equal(messages[3].content, "第一张抽帧");
    assert.equal(messages[4].tool_call_id, "call-two");
    assert.equal(messages[4].content, "第二张抽帧");
    assert.equal(messages.slice(3, 5).some(message => Array.isArray(message.content)), false, "tool observation 不再携带图片块");
    assert.deepEqual(messages[5].content.filter(part => part.type === "image_url").map(part => part.image_url.url), [
      "data:image/jpeg;base64,AA==", "data:image/jpeg;base64,AQ=="
    ], "工具图片以原顺序附在 user 视觉消息中");
    assert.match(messages[5].content[0].text, /call-one/u);
    assert.match(messages[5].content[2].text, /call-two/u);
    assert.deepEqual(preparedMessages[0][3].content[1], { type: "image_url", image_url: { url: "data:image/jpeg;base64,AA==", detail: "high" } }, "预处理器仍能看到 Agent Loop 原始 tool observation 合同");
    assert.deepEqual(snapshots[0].messages.map(message => message.role), messages.map(message => message.role), "请求观察器记录实际发给 Provider 的消息角色");
    assert.equal(input.messages[2].content[1].image_url.url, "data:image/jpeg;base64,AA==", "标准化不修改 Agent Loop 的临时内存历史");
  } finally { globalThis.fetch = originalFetch; }
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

test("超长工具参数在派发前以可恢复错误拒绝，并保留安全上限", async () => {
  const originalFetch = globalThis.fetch;
  let onResponseCalled = false;
  try {
    globalThis.fetch = async () => sse([{ tool_calls: [{ index: 0, id: "oversized-call", function: { name: "write_file", arguments: "x".repeat(32_769) } }] }]);
    const input = completionInput();
    input.onResponse = () => { onResponseCalled = true; };
    await assert.rejects(streamAiCompletion(input), error => {
      assert.ok(error instanceof AiToolArgumentsTooLargeError);
      assert.equal(error.toolName, "write_file");
      assert.equal(error.maxCharacters, 32_768);
      assert.equal(error.message.includes("未执行"), true);
      return true;
    });
    assert.equal(onResponseCalled, false, "超限响应不得被当作完整结果或交给工具派发");
  } finally { globalThis.fetch = originalFetch; }
});

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
    assert.equal(snapshots[1].reasoningReplayCharacters, hidden.length, '本次有效续接只计入一次 Token 预算');
    assert.doesNotMatch(JSON.stringify(snapshots), /private-fixture/u);
    await streamAiCompletion({ ...input, account: { ...input.account, modelId: 'other-model' } });
    await streamAiCompletion({ ...input, account: { ...input.account, providerId: 'other-provider' } });
    await streamAiCompletion({ ...input, account: { ...input.account, accountId: 'other-account' } });
    for (const snapshot of snapshots.slice(2)) assert.equal(snapshot.reasoningReplayCharacters, 0, '跨账户/Provider/模型的 replay 不进入本次请求预算');
    for (const body of bodies.slice(2)) assert.equal(Object.hasOwn(body.messages[1], 'reasoning_content'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("没有 providerReplay 时不会读取其可选字段", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => sse([{ content: "完成" }]);
    const input = completionInput();
    delete input.account.accountId;
    await assert.doesNotReject(streamAiCompletion(input));
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

test("工具 observation 必须在发送前与唯一前序 tool_call_id 配对", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls += 1; return sse([{ content: "unused" }]); };
    const orphan = completionInput();
    orphan.messages = [{ role: "tool", content: "orphan observation" }];
    await assert.rejects(streamAiCompletion(orphan), /observation.*tool_call_id/u);
    const pending = completionInput();
    pending.messages = [{ role: "assistant", content: null, tool_calls: [{ id: "pending-call", type: "function", function: { name: "read_fixture", arguments: "{}" } }] }];
    await assert.rejects(streamAiCompletion(pending), /尚无 observation/u);
    assert.equal(calls, 0, "消息角色配对失败时不得发送 Provider 请求");
  } finally { globalThis.fetch = originalFetch; }
});

test("Provider 返回重复 tool_call_id 时不产生可派发调用", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => sse([{ tool_calls: [
      { index: 0, id: "duplicate-call", function: { name: "read_fixture", arguments: "{}" } },
      { index: 1, id: "duplicate-call", function: { name: "read_fixture", arguments: "{}" } }
    ] }]);
    await assert.rejects(streamAiCompletion(completionInput()), /重复 ID/u);
  } finally { globalThis.fetch = originalFetch; }
});
