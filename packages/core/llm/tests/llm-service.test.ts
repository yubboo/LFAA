// 验证 @lfaa/llm Cordis 服务注册、API Key 脱敏持久化、活跃模型切换及流式/非流式适配器调用。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin, maskApiKey } from "../src/index";

test("maskApiKey 正确脱敏不同长度的 API Key", () => {
  assert.equal(maskApiKey(""), "");
  assert.equal(maskApiKey("sk-123"), "sk****");
  assert.equal(maskApiKey("sk-1234567890abcdef"), "sk-1****cdef");
});

test("Host llmPlugin 支持模型配置保存、脱敏读取、切换及 dispose 清理", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-llm-test-"));
  const storeFilePath = path.join(tempRoot, "llm-config.json");
  let capturedApiKey = "";

  const ctx = new Context();
  const fiber = ctx.plugin(llmPlugin, {
    storeFilePath,
    adapter: async (profile, input) => {
      capturedApiKey = profile.apiKey;
      input.onDelta?.({ type: "reasoning", text: "分析问题..." });
      input.onDelta?.({ type: "text", text: "已完成" });
      return {
        model: profile.model,
        provider: profile.kind,
        content: "已完成",
        reasoningContent: "分析问题...",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  });
  await fiber;

  try {
    const initial = await ctx.llm.listPublicProfiles();
    assert.ok(initial.profiles.length >= 3);
    assert.equal(initial.profiles.some((p) => "apiKey" in p), false);

    const saved = await ctx.llm.saveProfile({
      name: "我的 DeepSeek",
      kind: "deepseek",
      baseUrl: "https://api.deepseek.com/v1/",
      model: "deepseek-reasoner",
      apiKey: "sk-secret-987654321",
    });
    assert.equal(saved.hasApiKey, true);
    assert.equal(saved.apiKeyMasked, "sk-s****4321");

    const output = await ctx.llm.complete({
      messages: [{ role: "user", content: "hello" }],
    });
    assert.equal(capturedApiKey, "sk-secret-987654321");
    assert.equal(output.reasoningContent, "分析问题...");
    assert.equal(output.content, "已完成");

    await fiber.dispose();
    assert.equal((ctx as { llm?: unknown }).llm, undefined);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("resolveModelCapabilities 与 normalizeModelCapability 采信真实官方 effort 档位", async () => {
  const { resolveModelCapabilities, normalizeModelCapability, mapEffortForModelApi } = await import("../src/capabilities");

  const dsChat = resolveModelCapabilities("deepseek-chat", "deepseek");
  assert.equal(dsChat.supportsReasoning, false);
  assert.equal(dsChat.reasoningMode, "none");
  assert.deepEqual(dsChat.reasoningLevels, []);

  const dsFlash = normalizeModelCapability({
    id: "deepseek-flash",
    displayName: "DeepSeek-V4.1-Flash",
    supportsReasoning: true,
    reasoningMode: "effort",
    reasoningLevels: ["low", "high", "max"],
    defaultReasoningLevel: "high",
  });
  assert.equal(dsFlash.reasoningMode, "effort");
  assert.deepEqual(dsFlash.reasoningLevels, ["low", "high", "max"]);
  assert.equal(dsFlash.defaultReasoningLevel, "high");
  assert.equal(mapEffortForModelApi("max", dsFlash), "max");
  assert.equal(mapEffortForModelApi("medium", dsFlash), "high");

  const o3Cap = resolveModelCapabilities("o3-mini", "openai-compatible");
  assert.equal(o3Cap.reasoningMode, "effort");
  assert.deepEqual(o3Cap.reasoningLevels, ["low", "medium", "high"]);
  assert.equal(mapEffortForModelApi("max", o3Cap), "high");
});

test("formatLlmHttpError 覆盖 DeepSeek 官方 10 类 HTTP 错误码说明", async () => {
  const { formatLlmHttpError } = await import("../src/capabilities");
  const expectedCodes: Array<[number, string]> = [
    [400, "400 格式错误"],
    [401, "401 认证失败"],
    [402, "402 余额不足"],
    [408, "408 请求超时"],
    [413, "413 请求体过大"],
    [422, "422 参数错误"],
    [429, "429 请求速率达到上限"],
    [500, "500 服务器故障"],
    [503, "503 服务器繁忙"],
    [504, "504 网关超时"],
  ];
  for (const [code, label] of expectedCodes) {
    const formatted = formatLlmHttpError(code, JSON.stringify({ error: { message: "detail" } }), "Err");
    assert.ok(formatted.includes(label), `应包含 ${label}`);
    assert.ok(formatted.includes("detail"), `应附带上游明细`);
  }
});

test("401/402 提示不写死某家控制台地址，接入地址换到别家也不会指错平台", async () => {
  const { formatLlmHttpError } = await import("../src/capabilities");
  for (const code of [401, 402]) {
    const formatted = formatLlmHttpError(code, JSON.stringify({ error: { message: "invalid_api_key" } }), "Err");
    assert.ok(!/deepseek\.com|openai\.com|aliyuncs|volces/iu.test(formatted), `不应指向具体厂商：${formatted}`);
    assert.ok(formatted.includes("invalid_api_key"), "应保留上游明细供排查");
  }
  // 千问排在方舟之后出现过的真实事故：401 却提示去 DeepSeek 控制台。改为引导核对接口地址。
  assert.match(formatLlmHttpError(401, "", "Unauthorized"), /接口地址/u);
});

test("DeepSeek 思考模式下多轮工具调用必须附带 thinking 与 reasoning_content", async () => {
  const { callOpenAiCompatibleChat } = await import("../src/adapters/openai-adapter");
  const capturedBodies: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url, init) => {
    if (typeof init?.body === "string") {
      capturedBodies.push(JSON.parse(init.body) as Record<string, unknown>);
    }
    return new Response(
      JSON.stringify({
        model: "deepseek-flash",
        choices: [{ message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    await callOpenAiCompatibleChat(
      {
        id: "ds",
        name: "DeepSeek",
        kind: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-test",
        model: "deepseek-flash",
        availableModels: [
          {
            id: "deepseek-flash",
            supportsReasoning: true,
            reasoningMode: "effort",
            reasoningLevels: ["low", "high", "max"],
            defaultReasoningLevel: "high",
          },
        ],
        updatedAt: 1,
      },
      {
        reasoningEffort: "high",
        messages: [
          { role: "user", content: "hi" },
          {
            role: "assistant",
            content: "",
            reasoningContent: "need check",
            toolCalls: [{ id: "c1", name: "list_dir", argumentsJson: "{}" }],
          },
          { role: "tool", toolCallId: "c1", content: "ok" },
        ],
      },
    );

    assert.equal(capturedBodies.length, 1);
    const body = capturedBodies[0]!;
    assert.deepEqual(body.thinking, { type: "enabled" });
    assert.equal(body.reasoning_effort, "high");
    const msgs = body.messages as Array<Record<string, unknown>>;
    assert.equal(msgs[1]?.reasoning_content, "need check");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI 兼容 SSE 工具 ID 和名称分片归并为同一次准备和调用", async () => {
  const { callOpenAiCompatibleChat } = await import("../src/adapters/openai-adapter");
  const originalFetch = globalThis.fetch;
  const deltas = [
    { index: 0, function: { name: "write_" } },
    { index: 0, id: "call_write", function: { name: "file", arguments: '{"path":' } },
    { index: 0, function: { arguments: '"demo.txt"}' } },
  ];
  globalThis.fetch = async () => new Response(
    deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [delta] } }] })}\n\n`).join("")
      + "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );

  try {
    const received: unknown[] = [];
    const progress: Array<number | undefined> = [];
    const output = await callOpenAiCompatibleChat(
      { id: "local", name: "Local", kind: "ollama", baseUrl: "http://localhost/v1", apiKey: "", model: "fixture", updatedAt: 1 },
      {
        messages: [{ role: "user", content: "Create the fixture." }],
        tools: [{ name: "write_file", description: "Write file", parameters: {} }],
        onDelta: (delta) => received.push(delta),
        onActivity: (item) => progress.push(item?.argumentChars),
      },
    );
    assert.deepEqual(received, [{ type: "tool_call", toolCallId: "call_write", toolName: "write_file" }]);
    assert.deepEqual(progress, ['{"path":'.length, '{"path":"demo.txt"}'.length]);
    assert.deepEqual(output.toolCalls, [{ id: "call_write", name: "write_file", argumentsJson: '{"path":"demo.txt"}' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enrichDeepSeekReleaseNames 从官方文档提取精确版本后缀标签", async () => {
  const { enrichDeepSeekReleaseNames } = await import("../src/capabilities");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      "<td>DeepSeek-V4.1-Flash-1017</td><td>DeepSeek-V4-Pro-0813</td>",
      { status: 200 },
    )) as typeof fetch;

  try {
    const out = await enrichDeepSeekReleaseNames([
      {
        id: "deepseek-flash",
        displayName: "DeepSeek-V4.1-Flash",
        supportsReasoning: true,
        reasoningMode: "effort",
        reasoningLevels: ["low", "high", "max"],
        defaultReasoningLevel: "high",
      },
      {
        id: "deepseek-v4-pro",
        displayName: "DeepSeek-V4-Pro",
        supportsReasoning: true,
        reasoningMode: "effort",
        reasoningLevels: ["low", "high", "max"],
        defaultReasoningLevel: "high",
      },
    ]);
    assert.equal(out[0]?.displayName, "DeepSeek-V4.1-Flash-1017");
    assert.equal(out[1]?.displayName, "DeepSeek-V4-Pro-0813");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolveEffectiveProtocol 与四大 API 协议适配器（Responses / Anthropic / Gemini / Chat）请求分发正确", async () => {
  const { resolveEffectiveProtocol } = await import("../src/protocol-utils");
  const { callOpenAiResponsesApi } = await import("../src/adapters/responses-adapter");
  const { callAnthropicMessagesApi } = await import("../src/adapters/anthropic-adapter");
  const { callGeminiGenerateContentApi } = await import("../src/adapters/gemini-adapter");

  assert.equal(
    resolveEffectiveProtocol({ kind: "deepseek", baseUrl: "https://api.deepseek.com/anthropic" }),
    "anthropic-messages",
  );
  assert.equal(
    resolveEffectiveProtocol({ kind: "openai-compatible", baseUrl: "https://generativelanguage.googleapis.com/v1beta" }),
    "gemini-generate-content",
  );
  assert.equal(
    resolveEffectiveProtocol({ kind: "openai-compatible", apiProtocol: "openai-responses", baseUrl: "https://api.deepseek.com/v1" }),
    "openai-responses",
  );

  const calls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (inputUrl, init) => {
    const url = String(inputUrl);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    calls.push({ url, headers, body });

    if (url.endsWith("/responses")) {
      return new Response(
        JSON.stringify({
          model: "deepseek-flash",
          status: "completed",
          output: [
            { type: "reasoning", content: [{ type: "reasoning_text", text: "resp-cot" }] },
            { type: "message", content: [{ type: "output_text", text: "RESP_OK" }] },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/messages")) {
      return new Response(
        JSON.stringify({
          model: "deepseek-flash",
          stop_reason: "end_turn",
          content: [
            { type: "thinking", thinking: "ant-cot" },
            { type: "text", text: "ANT_OK" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [{ thought: true, text: "gem-cot" }, { text: "GEM_OK" }],
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const baseMsgs = [
      { role: "system" as const, content: "Be brief" },
      { role: "user" as const, content: "ping" },
    ];

    const rOut = await callOpenAiResponsesApi(
      {
        id: "ds-resp",
        name: "DeepSeek",
        kind: "deepseek",
        apiProtocol: "openai-responses",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-flash",
        apiKey: "sk-test",
        updatedAt: 1,
      },
      { messages: baseMsgs, reasoningEffort: "high" },
    );
    assert.equal(rOut.content, "RESP_OK");
    assert.equal(rOut.reasoningContent, "resp-cot");
    assert.equal(calls[0]?.url, "https://api.deepseek.com/v1/responses");
    assert.equal(calls[0]?.body.instructions, "Be brief");

    const aOut = await callAnthropicMessagesApi(
      {
        id: "ds-ant",
        name: "DeepSeek Anthropic",
        kind: "deepseek",
        apiProtocol: "anthropic-messages",
        baseUrl: "https://api.deepseek.com/anthropic",
        model: "deepseek-flash",
        apiKey: "sk-test",
        updatedAt: 1,
      },
      { messages: baseMsgs, reasoningEffort: "high" },
    );
    assert.equal(aOut.content, "ANT_OK");
    assert.equal(aOut.reasoningContent, "ant-cot");
    assert.equal(calls[1]?.url, "https://api.deepseek.com/anthropic/v1/messages");
    assert.equal(calls[1]?.headers["x-api-key"], "sk-test");
    assert.equal(calls[1]?.headers["anthropic-version"], "2023-06-01");

    const gOut = await callGeminiGenerateContentApi(
      {
        id: "gem",
        name: "Gemini",
        kind: "openai-compatible",
        apiProtocol: "gemini-generate-content",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-2.5-flash",
        apiKey: "gem-test",
        updatedAt: 1,
      },
      { messages: baseMsgs, reasoningEffort: "high" },
    );
    assert.equal(gOut.content, "GEM_OK");
    assert.equal(gOut.reasoningContent, "gem-cot");
    assert.equal(calls[2]?.headers["x-goog-api-key"], "gem-test");
    assert.ok(calls[2]?.url.includes("gemini-2.5-flash:streamGenerateContent"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI 兼容流式请求声明 include_usage 并解析末尾用量分片", async () => {
  const { callOpenAiCompatibleChat } = await import("../src/adapters/openai-adapter");
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> = {};
  globalThis.fetch = (async (_url, init) => {
    body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n`
      + `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14, prompt_tokens_details: { cached_tokens: 7 } } })}\n\n`
      + "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } },
    );
  }) as typeof fetch;

  try {
    const output = await callOpenAiCompatibleChat(
      { id: "local", name: "Local", kind: "openai-compatible", baseUrl: "http://localhost/v1", apiKey: "test-key", model: "fixture", updatedAt: 1 },
      { messages: [{ role: "user", content: "hi" }] },
    );
    assert.deepEqual(body.stream_options, { include_usage: true });
    assert.deepEqual(output.usage, { promptTokens: 11, completionTokens: 3, totalTokens: 14, cachedPromptTokens: 7 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("不识别 stream_options 的服务会自动去掉该字段重试一次", async () => {
  const { callOpenAiCompatibleChat } = await import("../src/adapters/openai-adapter");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    if (body.stream_options) {
      return new Response("unknown field: stream_options", { status: 400 });
    }
    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n` + "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } },
    );
  }) as typeof fetch;

  try {
    const output = await callOpenAiCompatibleChat(
      { id: "local", name: "Local", kind: "ollama", baseUrl: "http://localhost/v1", apiKey: "", model: "fixture", updatedAt: 1 },
      { messages: [{ role: "user", content: "hi" }] },
    );
    assert.equal(calls, 2);
    assert.equal(output.content, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("模型配置保存并公开上下文窗口", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-llm-window-"));
  const ctx = new Context();
  await ctx.plugin(llmPlugin, { storeFilePath: path.join(tempRoot, "llm.json") });
  try {
    const saved = await ctx.llm.saveProfile({
      name: "Window Model",
      kind: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "fixture",
      apiKey: "test-key",
      contextWindowTokens: 200_000,
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
      cachedInputPricePerMillion: 0.2,
    });
    assert.equal(saved.contextWindowTokens, 200_000);
    assert.equal(saved.inputPricePerMillion, 2);
    assert.equal(saved.outputPricePerMillion, 8);
    assert.equal(saved.cachedInputPricePerMillion, 0.2);
    const reloaded = await ctx.llm.resolveProfile(saved.id);
    assert.equal(reloaded.contextWindowTokens, 200_000);
    assert.equal(reloaded.inputPricePerMillion, 2);
    assert.equal(reloaded.outputPricePerMillion, 8);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});