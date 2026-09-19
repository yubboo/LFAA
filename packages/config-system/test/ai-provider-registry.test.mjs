import assert from "node:assert/strict";
import test from "node:test";
import { AiProviderRegistry, builtinAiProviderPlugins, buildOpenAiCompatibleModelRequest, parseOpenAiCompatibleModelList } from "../src/settings/ai/index.ts";

test("内置 Provider ID 唯一且覆盖首批六家", () => {
  const ids = builtinAiProviderPlugins.map((item) => item.id);
  assert.deepEqual(ids, ["openai", "deepseek", "zhipu", "kimi", "qwen", "xiaomi"]);
  assert.equal(new Set(ids).size, ids.length);
});

test("Registry 通过注册扩展，不依赖核心厂商分支", () => {
  const registry = new AiProviderRegistry(builtinAiProviderPlugins);
  assert.equal(registry.get("deepseek").displayName, "DeepSeek");
  assert.equal(registry.list().length, 6);
  assert.throws(() => registry.register(builtinAiProviderPlugins[0]), /已注册/);
});

test("OpenAI 使用官方 /models 且 GPT-6 Astra 只暴露官方 reasoning.effort", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "openai");
  assert.ok(plugin);
  assert.deepEqual(plugin.authMethods.map((item) => item.id), ["api-key", "chatgpt"]);
  const api = plugin.resolveConnection({ authMethodId: "api-key", settings: {} });
  assert.equal(api.modelDiscovery.kind, "http-list");
  assert.equal(api.modelDiscovery.url, "https://api.openai.com/v1/models");
  const capability = plugin.describeModel("gpt-6-astra");
  assert.equal(capability.contextWindow, 1_050_000);
  assert.deepEqual(capability.settings[0].options.map((item) => item.value), ["low", "medium", "high", "xhigh", "max"]);
  assert.equal(capability.settings[0].requestPath, "reasoning.effort");
});

test("DeepSeek 使用官方 /models 与 none/low/high/max 思考强度", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "deepseek");
  const resolved = plugin.resolveConnection({ authMethodId: "api-key", settings: {} });
  assert.deepEqual(resolved.modelDiscovery, { kind: "http-list", method: "GET", url: "https://api.deepseek.com/models", responseShape: "openai-model-list", source: resolved.modelDiscovery.source });
  const capability = plugin.describeModel("deepseek-v4-pro");
  assert.deepEqual(capability.settings[0].options.map((item) => item.value), ["none", "low", "high", "max"]);
  assert.equal(capability.settings[0].requestPath, "reasoning_effort");
});

test("智谱使用官方文档模型目录，不伪造 /models", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "zhipu");
  const resolved = plugin.resolveConnection({ authMethodId: "api-key", settings: { endpoint: "standard" } });
  assert.equal(resolved.modelDiscovery.kind, "official-catalog");
  assert.ok(resolved.modelDiscovery.models.some((model) => model.id === "glm-5.3"));
  assert.equal(plugin.describeModel("glm-5.3").settings[0].requestPath, "reasoning_effort");
});

test("Kimi 模型能力按官方模型分别配置，不跨模型猜参数", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "kimi");
  assert.equal(plugin.resolveConnection({ authMethodId: "api-key", settings: { region: "china" } }).baseUrl, "https://api.moonshot.cn/v1");
  assert.equal(plugin.describeModel("kimi-k3").settings[0].requestPath, "reasoning_effort");
  assert.equal(plugin.describeModel("kimi-k2.6").settings[0].requestPath, "thinking.type");
  assert.deepEqual(plugin.describeModel("kimi-k2.7-code").settings, []);
  assert.equal(plugin.describeModel("unknown-kimi"), null);
});

test("千问官方模型列表与 Qwen3.8 reasoning_effort 契约", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "qwen");
  assert.throws(() => plugin.resolveConnection({ authMethodId: "api-key", settings: { region: "cn-beijing" } }), /Workspace ID/);
  const ready = plugin.resolveConnection({ authMethodId: "api-key", settings: { region: "cn-beijing", workspaceId: "ws123" } });
  assert.equal(ready.modelDiscovery.url, "https://ws123.cn-beijing.maas.aliyuncs.com/api/v1/models");
  const hybrid = plugin.describeModel("qwen3.8-max");
  assert.deepEqual(hybrid.settings[0].options.map((item) => item.value), ["none", "low", "medium", "xhigh"]);
  const thinkingOnly = plugin.describeModel("qwen3.8-2.4t-a95b");
  assert.deepEqual(thinkingOnly.settings[0].options.map((item) => item.value), ["low", "medium", "xhigh"]);
});

test("MiMo 区分按量/Token Plan 并只暴露官方有效 reasoning 参数", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "xiaomi");
  assert.equal(plugin.resolveConnection({ authMethodId: "api-key", settings: {} }).baseUrl, "https://api.xiaomimimo.com/v1");
  assert.equal(plugin.resolveConnection({ authMethodId: "token-plan", settings: { tokenPlanRegion: "sgp" } }).baseUrl, "https://token-plan-sgp.xiaomimimo.com/v1");
  const capability = plugin.describeModel("mimo-v2.5-pro");
  assert.equal(capability.contextWindow, 1_000_000);
  assert.equal(capability.maxOutputTokens, 131_072);
  assert.equal(capability.settings[0].requestPath, "reasoning.effort");
});

test("未知模型不获得猜测 Capability", () => {
  for (const plugin of builtinAiProviderPlugins) assert.equal(plugin.describeModel("vendor-unknown-model"), null);
});

test("OpenAI-compatible transport 只接收 credential，不保存 credential", () => {
  const request = buildOpenAiCompatibleModelRequest("https://example.test/v1/models", { name: "Authorization", scheme: "Bearer" }, "secret-value");
  assert.equal(request.headers.Authorization, "Bearer secret-value");
  const models = parseOpenAiCompatibleModelList({ data: [{ id: "m1", owned_by: "vendor" }, { id: "m2" }] });
  assert.deepEqual(models, [{ id: "m1", ownedBy: "vendor" }, { id: "m2" }]);
});
