// 验证方舟套餐目录：未配置凭据不显示模型；配置后四类模型统一用 chip，并标记非接口返回的「目录」条目。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { ArkModels } = await import("../client/models/Ark-Models");

const chatModels = [
  "ark-code-latest", "doubao-seed-evolving", "doubao-seed-2.1-pro", "doubao-seed-2.1-lite", "doubao-seed-2.0-mini",
  "kimi-k3.1-pro", "kimi-k2.8-preview", "deepseek-v4.1-flash", "deepseek-v4.1-flash-economy", "glm-5.3",
  "glm-5.3-flash", "deepseek-v4-pro", "deepseek-v4-flash", "kimi-k3",
].map((id) => ({ id, supportsReasoning: false, reasoningMode: "none" as const, reasoningLevels: [] }));

test("未配置凭据时方舟套餐不展示任何模型", () => {
  const html = renderToStaticMarkup(createElement(ArkModels, {
    plan: "agent",
    model: "ark-code-latest",
    isZh: true,
    onSelect: () => {},
    configured: false,
    syncedModels: [],
  }));
  assert.match(html, /填写 API Key/u);
  assert.doesNotMatch(html, /doubao-seedream/u);
});

test("已配置时四类模型都用 chip，并区分接口同步与目录条目", () => {
  const html = renderToStaticMarkup(createElement(ArkModels, {
    plan: "agent",
    model: "ark-code-latest",
    isZh: true,
    onSelect: () => {},
    configured: true,
    syncedModels: chatModels,
  }));
  for (const label of ["语言模型", "向量化模型", "视觉模型", "语音模型"]) {
    assert.ok(html.includes(label), `缺少分组 ${label}`);
  }
  assert.match(html, /接口同步与官方套餐目录/u);
  assert.ok(html.includes("doubao-seedream-5-0-pro"));
  assert.ok(html.includes("doubao-seedream-5.5"));
  // 同一用途内按品牌分组，并显示能力说明。
  for (const brand of ["豆包", "Kimi", "DeepSeek", "智谱AI", "方舟路由"]) {
    assert.ok(html.includes(brand), `缺少品牌 ${brand}`);
  }
  assert.match(html, /图片生成/u);
  assert.match(html, /语音合成/u);
  assert.match(html, /文本生成、推理/u);
  // 不再用「目录」标签区分未同步条目，避免 chip 被长 ID + 小字撑破。
  assert.doesNotMatch(html, />目录<\/small>/u);
  // 向量化模型只读，但外观仍是 chip。
  assert.match(html, /data-static="true"/u);
});