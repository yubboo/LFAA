// 验证模型能力推断：套餐同步的 /models 列表缺少 effort 元数据时，按模型家族补出真实思考能力。
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeModelCapability, resolveModelCapabilities, resolveModelKind } from "../src/capabilities";

test("Qwen3 系列按 effort 三档推断，可调思考强度", () => {
  const cap = resolveModelCapabilities("qwen3.7-max");
  assert.equal(cap.supportsReasoning, true);
  assert.equal(cap.reasoningMode, "effort");
  assert.deepEqual(cap.reasoningLevels, ["low", "medium", "high"]);
  assert.equal(cap.defaultReasoningLevel, "medium");
  assert.equal(resolveModelCapabilities("qwen3.6-flash").reasoningMode, "effort");
});

test("GLM / Kimi thinking / MiniMax 推断为原生固定思考，不再显示普通对话模型", () => {
  for (const id of ["glm-5.2", "glm-4.6", "kimi-k2.8-thinking", "MiniMax-M3.1"]) {
    const cap = resolveModelCapabilities(id);
    assert.equal(cap.supportsReasoning, true, id);
    assert.equal(cap.reasoningMode, "fixed", id);
  }
});

test("同步来的旧记录（reasoningMode=none）会按家族升级能力，未知/图像模型保持无思考", () => {
  const upgraded = normalizeModelCapability({ id: "qwen3.7-plus", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] });
  assert.equal(upgraded.reasoningMode, "effort");
  assert.deepEqual(upgraded.reasoningLevels, ["low", "medium", "high"]);

  assert.equal(resolveModelCapabilities("wan2.7-image").reasoningMode, "none");
  assert.equal(resolveModelCapabilities("some-random-model").reasoningMode, "none");
});

test("既有家族规则不回归", () => {
  assert.equal(resolveModelCapabilities("deepseek-reasoner").reasoningMode, "fixed");
  assert.equal(resolveModelCapabilities("gpt-5.1").reasoningMode, "effort");
  assert.deepEqual(resolveModelCapabilities("gpt-5.1").reasoningLevels, ["minimal", "low", "medium", "high"]);
  assert.equal(resolveModelCapabilities("claude-sonnet-4").reasoningMode, "effort");
});

test("模型用途识别：生图/生视频/语音与对话模型区分", () => {
  assert.equal(resolveModelKind("wan2.7-image"), "image");
  assert.equal(resolveModelKind("wan2.7-image-pro"), "image");
  assert.equal(resolveModelKind("qwen-image-3.0-pro"), "image");
  assert.equal(resolveModelKind("doubao-seedream-4"), "image");
  assert.equal(resolveModelKind("wan3.0-video"), "video");
  assert.equal(resolveModelKind("doubao-seedance-1.5"), "video");
  assert.equal(resolveModelKind("qwen-audio-3.0-tts-plus"), "audio");
  assert.equal(resolveModelKind("qwen-audio-3.0-asr-flash"), "audio");
  assert.equal(resolveModelKind("qwen3.7-max"), "chat");
  assert.equal(resolveModelKind("glm-5.2"), "chat");
  assert.equal(resolveModelKind("unknown-model"), "chat");
});

test("媒体模型不提供思考能力，避免 UI 误判为对话模型", () => {
  for (const id of ["wan2.7-image", "wan3.0-video", "qwen-audio-3.0-tts-plus"]) {
    const cap = resolveModelCapabilities(id);
    assert.notEqual(cap.modelKind, "chat", id);
    assert.equal(cap.supportsReasoning, false, id);
    assert.equal(cap.reasoningMode, "none", id);
  }
  // 同步来的旧记录也会被识别为媒体模型
  const upgraded = normalizeModelCapability({ id: "wan2.7-image", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] });
  assert.equal(upgraded.modelKind, "image");
});
