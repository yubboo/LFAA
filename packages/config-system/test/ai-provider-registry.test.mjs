import assert from "node:assert/strict";
import test from "node:test";
import {
  AiProviderRegistry,
  builtinAiProviderPlugins,
  buildOpenAiCompatibleModelRequest,
  parseOpenAiCompatibleModelList,
} from "../src/settings/ai/index.ts";

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

test("OpenAI 同时声明 API Key 与 ChatGPT/Codex 套餐认证", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "openai");
  assert.ok(plugin);
  assert.deepEqual(plugin.authMethods.map((item) => item.id), ["api-key", "chatgpt"]);
  const chatgpt = plugin.resolveConnection({ authMethodId: "chatgpt", settings: {} });
  assert.equal(chatgpt.protocol, "codex-app-server");
  assert.equal(chatgpt.modelDiscovery.kind, "codex-account");
});

test("DeepSeek 使用官方 Base URL 与 /models", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "deepseek");
  const resolved = plugin.resolveConnection({ authMethodId: "api-key", settings: {} });
  assert.equal(resolved.baseUrl, "https://api.deepseek.com");
  assert.deepEqual(resolved.modelDiscovery, { kind: "http-list", method: "GET", url: "https://api.deepseek.com/models", responseShape: "openai-model-list" });
});

test("智谱不伪造未确认的统一模型列表端点", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "zhipu");
  const resolved = plugin.resolveConnection({ authMethodId: "api-key", settings: { endpoint: "coding" } });
  assert.equal(resolved.baseUrl, "https://open.bigmodel.cn/api/coding/paas/v4");
  assert.equal(resolved.modelDiscovery.kind, "manual");
});

test("Kimi 中国与国际区域解析为不同官方入口", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "kimi");
  assert.equal(plugin.resolveConnection({ authMethodId: "api-key", settings: { region: "china" } }).baseUrl, "https://api.moonshot.cn/v1");
  assert.equal(plugin.resolveConnection({ authMethodId: "api-key", settings: { region: "international" } }).baseUrl, "https://api.moonshot.ai/v1");
});

test("千问需要 Workspace 的区域不会伪造模型列表 URL", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "qwen");
  const missing = plugin.resolveConnection({ authMethodId: "api-key", settings: { region: "cn-beijing" } });
  assert.equal(missing.modelDiscovery.kind, "manual");
  const ready = plugin.resolveConnection({ authMethodId: "api-key", settings: { region: "cn-beijing", workspaceId: "ws123" } });
  assert.equal(ready.modelDiscovery.kind, "http-list");
  assert.equal(ready.modelDiscovery.url, "https://ws123.cn-beijing.maas.aliyuncs.com/api/v1/models");
});

test("MiMo 区分按量 sk 与 Token Plan tp 路由", () => {
  const plugin = builtinAiProviderPlugins.find((item) => item.id === "xiaomi");
  assert.equal(plugin.resolveConnection({ authMethodId: "api-key", settings: {} }).baseUrl, "https://api.xiaomimimo.com/v1");
  assert.equal(plugin.resolveConnection({ authMethodId: "token-plan", settings: { tokenPlanRegion: "sgp" } }).baseUrl, "https://token-plan-sgp.xiaomimimo.com/v1");
});

test("OpenAI-compatible transport 只接收 credential，不保存 credential", () => {
  const request = buildOpenAiCompatibleModelRequest("https://example.test/v1/models", { name: "Authorization", scheme: "Bearer" }, "secret-value");
  assert.equal(request.headers.Authorization, "Bearer secret-value");
  const models = parseOpenAiCompatibleModelList({ data: [{ id: "m1", owned_by: "vendor" }, { id: "m2" }] });
  assert.deepEqual(models, [{ id: "m1", ownedBy: "vendor" }, { id: "m2" }]);
});
