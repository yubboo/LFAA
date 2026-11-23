// 验证视频生成默认只使用当前配置，跨套餐必须由调用方显式指定，避免静默调用其他厂商。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin } from "../src/index";

test("Agent Plan Medium 不能保存或选择 Seedance 视频模型", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-plan-tier-"));
  const ctx = new Context();
  const fiber = ctx.plugin(llmPlugin, { storeFilePath: path.join(tempRoot, "llm.json") });
  await fiber;
  try {
    const saved = await ctx.llm.saveProfile({
      name: "火山方舟 Agent Plan",
      providerId: "volcengine-agent-plan",
      kind: "openai-compatible",
      baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
      model: "doubao-seedance-2.0",
      apiKey: "test-key",
      agentPlanTier: "medium",
    });
    // Medium 档位不能把 Seedance 存成当前模型，自动落回可用的语言模型。
    assert.equal(saved.model, "ark-code-latest");
    assert.equal(saved.agentPlanTier, "medium");
    await assert.rejects(
      ctx.llm.selectProfileModel(saved.id, "doubao-seedance-2.0"),
      /Agent Plan 档位不支持视频模型.*Large \/ Max/u,
    );
  } finally {
    await fiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("生成视频默认只用当前配置，跨套餐只给出备选并要求显式 profileId", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-media-routing-"));
  const ctx = new Context();
  const fiber = ctx.plugin(llmPlugin, { storeFilePath: path.join(tempRoot, "llm.json") });
  await fiber;
  try {
    const chat = await ctx.llm.saveProfile({
      name: "仅聊天配置",
      kind: "openai-compatible",
      baseUrl: "http://127.0.0.1:9/v1",
      model: "chat-only",
      apiKey: "test-key",
    });
    const video = await ctx.llm.saveProfile({
      name: "千问视频",
      kind: "openai-compatible",
      baseUrl: "http://127.0.0.1:9/v1",
      model: "wan3.0-video",
      apiKey: "test-key",
      availableModels: [{ id: "wan3.0-video", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }],
    });
    await ctx.llm.setActiveProfile(chat.id);

    // 当前配置没有视频模型：不得自动切到千问，必须把备选交给 Agent 先征询用户。
    await assert.rejects(
      ctx.llm.generateVideo({ prompt: "雨窗少女", duration: 5 }),
      (error: unknown) => error instanceof Error
        && /其他可用视频配置/u.test(error.message)
        && /千问视频/u.test(error.message)
        && /profileId/u.test(error.message),
    );

    // 显式指定后才允许跨套餐；这里用不可达地址验证请求确实发往该配置，而不是继续回退。
    await assert.rejects(
      ctx.llm.generateVideo({ prompt: "雨窗少女", duration: 5, profileId: video.id }),
      /无法连接视频接口/u,
    );
  } finally {
    await fiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});