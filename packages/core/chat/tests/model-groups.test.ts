// 验证配置卡片的模型分类：按用途归组，顺序固定，未知用途按对话模型处理。
import assert from "node:assert/strict";
import test from "node:test";
import { describeModelCapability, groupModelsByKind } from "../client/components/model-reasoning-options";

test("模型能力简介按用途给出简短说明", () => {
  assert.match(describeModelCapability("image", true), /文生图/u);
  assert.match(describeModelCapability("video", true), /文生视频/u);
  assert.match(describeModelCapability("audio", true), /语音/u);
  assert.match(describeModelCapability("embedding", true), /向量化/u);
  assert.match(describeModelCapability("image", false), /text-to-image/u);
});

test("模型按用途分组，顺序为语言 / 向量化 / 视觉 / 语音", () => {
  const groups = groupModelsByKind([
    { id: "gpt-4o" },
    { id: "text-embedding-3-large", modelKind: "embedding" as const },
    { id: "dall-e-3", modelKind: "image" as const },
    { id: "sora-2", modelKind: "video" as const },
    { id: "whisper-1", modelKind: "audio" as const },
  ], true);
  assert.deepEqual(groups.map((group) => group.label), ["语言模型", "向量化模型", "视觉模型", "语音模型"]);
  assert.deepEqual(groups[0]?.items.map((item) => item.id), ["gpt-4o"]);
  assert.deepEqual(groups[2]?.items.map((item) => item.id), ["dall-e-3", "sora-2"]);
  assert.equal(groups[1]?.items[0]?.id, "text-embedding-3-large");
  assert.equal(groups[3]?.items[0]?.id, "whisper-1");
});

test("英文标签与空输入", () => {
  assert.deepEqual(groupModelsByKind([], true), []);
  const groups = groupModelsByKind([{ id: "a", modelKind: "chat" as const }], false);
  assert.equal(groups[0]?.label, "Language models");
});