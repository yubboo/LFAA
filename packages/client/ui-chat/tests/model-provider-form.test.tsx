// 验证套餐配置表单也提供「获取官方模型」，并把拉取到的全部模型列出可选（普通接口保留首屏截断）。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ModelCapabilityItem } from "../client/store/chat-types";
import type { ModelProviderPreset } from "../client/models/provider-catalog";

(globalThis as { React?: typeof React }).React = React;

const { ModelProviderForm } = await import("../client/models/ModelProviderForm");

const model = (id: string): ModelCapabilityItem => ({
  id,
  supportsReasoning: false,
  reasoningMode: "none",
  reasoningLevels: [],
});

// 普通接口与套餐共用同一份品牌字段，套餐额外声明 subscription 以走套餐表单分支。
const planBase: Omit<ModelProviderPreset, "subscription"> = {
  id: "qwen-token-plan",
  nameZh: "通义千问 Token Plan",
  nameEn: "Qwen Token Plan",
  descZh: "使用百炼 Token Plan 专属 API Key",
  descEn: "Use an Alibaba Model Studio Token Plan API key",
  kind: "openai-compatible",
  defaultProtocol: "openai-chat",
  supportedProtocols: ["openai-chat", "anthropic-messages"],
  defaultBaseUrl: "https://token-plan.example.com/compatible-mode/v1",
  protocolBaseUrls: {
    "openai-chat": "https://token-plan.example.com/compatible-mode/v1",
    "anthropic-messages": "https://token-plan.example.com/apps/anthropic",
  },
  defaultModel: "qwen4-max",
  sampleModels: [],
  accentColor: "#6366f1",
  glyph: "QW",
};

const planPreset: ModelProviderPreset = { ...planBase, subscription: true };

const manyModels = Array.from({ length: 23 }, (_, index) => model(index === 0 ? "qwen4-max" : `qwen-model-${index}`));

function renderForm(overrides: {
  subscription: boolean;
  officialModels: ModelCapabilityItem[];
  provider?: ModelProviderPreset;
  statusNotice?: { tone: "loading" | "success" | "error"; title?: string; message: string } | null;
  arkPlan?: "agent" | "coding";
}) {
  const provider = overrides.provider ?? (overrides.subscription ? planPreset : planBase);
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(ModelProviderForm, {
      isZh: true,
      provider,
      profile: undefined,
      subscription: overrides.subscription,
      isLocal: false,
      arkPlan: overrides.arkPlan,
      configBaseUrl: provider.protocolBaseUrls?.["openai-chat"] ?? provider.defaultBaseUrl,
      values: {
        name: "千问 Token Plan",
        kind: "openai-compatible",
        apiProtocol: "openai-chat",
        baseUrl: provider.defaultBaseUrl,
        model: "qwen4-max",
        apiKey: "",
        contextWindow: "",
        inputPrice: "",
        outputPrice: "",
        cachedInputPrice: "",
        agentPlanTier: "medium",
      },
      setters: {
        setName: noop,
        setApiProtocol: noop,
        setBaseUrl: noop,
        setModel: noop,
        setApiKey: noop,
        setContextWindow: noop,
        setInputPrice: noop,
        setOutputPrice: noop,
        setCachedInputPrice: noop,
        setAgentPlanTier: noop,
      },
      officialModels: overrides.officialModels,
      fetchingModels: false,
      busy: false,
      statusNotice: overrides.statusNotice ?? null,
      modelInputId: "model-id",
      focusForm: noop,
      focusFormOnOpen: false,
      onFetchModels: noop,
    }),
  );
}

test("套餐表单也提供拉取模型入口，不再只允许手填一个模型 ID", () => {
  const html = renderForm({ subscription: true, officialModels: [] });
  assert.match(html, /获取官方模型/u);
  assert.match(html, /点击「获取官方模型」拉取该套餐下全部可用模型/u);
  assert.doesNotMatch(html, /填写该套餐支持的官方模型 ID/u);
});

test("套餐拉取后列出全部模型，不受普通接口的 18 项截断影响", () => {
  const html = renderForm({ subscription: true, officialModels: manyModels });
  for (const item of manyModels) assert.ok(html.includes(item.id), `缺少模型 ${item.id}`);
  assert.match(html, /chipBtnActive/u);
});

test("API Key 输入框禁止浏览器自动填充，避免把别家 Key 覆盖进来", () => {
  const html = renderForm({ subscription: true, officialModels: [] });
  assert.match(html, /type="password"/u);
  assert.match(html, /autocomplete="new-password"/iu);
});

test("普通接口仍按首屏截断，避免超长清单刷屏", () => {
  const html = renderForm({ subscription: false, officialModels: manyModels });
  assert.ok(html.includes("qwen4-max"));
  assert.ok(!html.includes("qwen-model-22"));
});

test("Agent Plan 表单提供套餐档位，并提示视频仅 Large / Max 可用", () => {
  const html = renderForm({ subscription: true, officialModels: [], arkPlan: "agent" });
  assert.match(html, /套餐档位/u);
  assert.match(html, /value="medium"/u);
  assert.match(html, /视频生成仅 Large \/ Max 套餐可用/u);
});