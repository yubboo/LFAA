// 验证千问 Token Plan 官方套餐目录补齐：/models 不返回的视频模型（happyhorse）也要出现在清单里。
import assert from "node:assert/strict";
import test from "node:test";
import { isTokenPlanBaseUrl, TOKEN_PLAN_MODELS, tokenPlanCatalogModels } from "../src/token-plan";

test("千问 Token Plan 目录包含全部套餐模型（含 happyhorse 视频模型）", () => {
  const ids = TOKEN_PLAN_MODELS.map((model) => model.id);
  for (const id of [
    "auto", "qwen4-max", "qwen3.8-max", "qwen-audio-3.0-tts-plus",
    "qwen-image-3.0-pro", "wan2.7-image", "wan3.0-video",
    "happyhorse-1.1-r2v", "happyhorse-1.1-t2v", "happyhorse-1.1-i2v",
    "deepseek-v4.1-flash", "glm-5.3", "glm-5.2",
  ]) {
    assert.ok(ids.includes(id), `缺少套餐模型 ${id}`);
  }
  assert.equal(TOKEN_PLAN_MODELS.find((model) => model.id === "happyhorse-1.1-t2v")?.kind, "video");
});

test("补齐时跳过 /models 已返回的模型，并识别 Token Plan 地址", () => {
  const existing = [
    { id: "wan2.7-image", supportsReasoning: false, reasoningMode: "none" as const, reasoningLevels: [] },
  ];
  const extra = tokenPlanCatalogModels(existing);
  assert.ok(!extra.some((model) => model.id === "wan2.7-image"));
  assert.ok(extra.some((model) => model.id === "happyhorse-1.1-i2v"));
  assert.equal(isTokenPlanBaseUrl("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"), true);
  assert.equal(isTokenPlanBaseUrl("https://api.openai.com/v1"), false);
});