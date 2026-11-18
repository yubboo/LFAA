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
