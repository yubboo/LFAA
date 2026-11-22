// 验证方舟生图默认关闭厂商水印：未显式开启时不发送 watermark:true。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildImageRequestBody } from "../src/media/media";
import type { LlmProfile } from "../src/types";

function profile(overrides: Partial<LlmProfile> = {}): LlmProfile {
  return {
    id: "ark",
    kind: "openai-compatible",
    apiProtocol: "openai-chat",
    name: "Ark Plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    apiKey: "test",
    model: "doubao-seedream-5.0-flash",
    updatedAt: 0,
    ...overrides,
  };
}

test("方舟生图默认关闭厂商水印，显式开启才发送", () => {
  const off = buildImageRequestBody(profile(), { prompt: "海边日落" }, "ark") as Record<string, unknown>;
  assert.equal(off.watermark, false);

  const on = buildImageRequestBody(profile(), { prompt: "海边日落", watermark: true }, "ark") as Record<string, unknown>;
  assert.equal(on.watermark, true);
});

// 确保临时目录清理路径可用（与其他媒体测试一致的约定）。
test("临时目录可创建", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-ark-watermark-"));
  await rm(dir, { recursive: true, force: true });
  assert.ok(true);
});