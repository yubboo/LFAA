import test from "node:test";
import assert from "node:assert/strict";
import { AiAccountService } from "../src/settings/ai/core/account-service.ts";
import { AiProviderRegistry } from "../src/settings/ai/core/provider-registry.ts";
import { builtinAiProviderPlugins } from "../src/settings/ai/providers/index.ts";
import { parseQwenModelList } from "../src/settings/ai/transports/qwen-model-list.ts";

function harness(response = { data: [{ id: "gpt-6-astra", owned_by: "openai" }, { id: "gpt-5.6-sol" }] }) {
  let accounts = [];
  const secrets = new Map();
  const requests = [];
  let seq = 0;
  const service = new AiAccountService(new AiProviderRegistry(builtinAiProviderPlugins), {
    repository: { async list() { return accounts; }, async put(record) { accounts = [...accounts.filter((item) => item.id !== record.id), record]; }, async delete(id) { accounts = accounts.filter((item) => item.id !== id); } },
    secrets: { persistence: "os-credential-store", async put(ref, value) { secrets.set(ref, value); }, async get(ref) { return secrets.get(ref) ?? null; }, async delete(ref) { secrets.delete(ref); } },
    http: { async requestJson(request) { requests.push(request); return response; } },
    createId() { seq += 1; return `account-000${seq}`; },
    now() { return "2026-09-19T04:00:00.000Z"; },
  });
  return { service, get accounts() { return accounts; }, secrets, requests };
}

const baseDraft = { providerId: "openai", displayName: "OpenAI 主账户", authMethodId: "api-key", settings: {}, selectedModelId: "gpt-6-astra", modelSettings: { reasoningEffort: "high", maxOutputTokens: 64000 } };

test("OpenAI probe uses runtime model list and decorates official capability", async () => {
  const h = harness();
  const result = await h.service.probe(baseDraft, "sk-test-secret");
  assert.equal(result.status, "connected");
  assert.deepEqual(result.models.map((item) => item.id), ["gpt-5.6-sol", "gpt-6-astra"]);
  const astra = result.models.find((item) => item.id === "gpt-6-astra");
  assert.equal(astra.contextWindow, 1_050_000);
  assert.equal(astra.capabilities.settings[0].requestPath, "reasoning.effort");
  assert.equal(astra.discoverySource.kind, "runtime-model-api");
});

test("credential prefix mismatch is rejected before HTTP", async () => {
  const h = harness();
  await assert.rejects(() => h.service.probe(baseDraft, "wrong-key"), /格式/);
  assert.equal(h.requests.length, 0);
});

test("save stores credentialRef and validated model settings only", async () => {
  const h = harness();
  const result = await h.service.save(baseDraft, "sk-test-secret");
  assert.match(h.accounts[0].credentialRef, /^lfaa-ai:openai:/);
  assert.equal(JSON.stringify(h.accounts).includes("sk-test-secret"), false);
  assert.deepEqual(h.accounts[0].modelSettings, { reasoningEffort: "high", maxOutputTokens: 64000 });
  assert.equal(h.secrets.get(result.account.credentialRef), "sk-test-secret");
});

test("unsupported model setting is rejected by core even if UI sends it", async () => {
  const h = harness();
  await assert.rejects(() => h.service.save({ ...baseDraft, modelSettings: { fakeThinkingLevel: "ultra" } }, "sk-test-secret"), /未在当前模型的官方能力中声明/);
});

test("model not returned by official runtime catalog cannot be saved", async () => {
  const h = harness();
  await assert.rejects(() => h.service.save({ ...baseDraft, selectedModelId: "made-up-model", modelSettings: {} }, "sk-test-secret"), /不在当前账户的官方模型目录/);
});

test("reprobe reads secret from Secret Store", async () => {
  const h = harness();
  const saved = await h.service.save(baseDraft, "sk-test-secret");
  h.requests.length = 0;
  const result = await h.service.reprobe(saved.account.id);
  assert.equal(result.status, "connected");
  assert.equal(h.requests[0].headers.Authorization, "Bearer sk-test-secret");
});

test("selectModel revalidates model against current official catalog and settings", async () => {
  const h = harness();
  const saved = await h.service.save(baseDraft, "sk-test-secret");
  await h.service.selectModel(saved.account.id, "gpt-5.6-sol", { reasoningEffort: "none", maxOutputTokens: 32000 });
  assert.equal(h.accounts[0].selectedModelId, "gpt-5.6-sol");
  assert.deepEqual(h.accounts[0].modelSettings, { reasoningEffort: "none", maxOutputTokens: 32000 });
});

test("delete removes metadata and Secret", async () => {
  const h = harness();
  const saved = await h.service.save(baseDraft, "sk-test-secret");
  await h.service.delete(saved.account.id);
  assert.equal(h.accounts.length, 0);
  assert.equal(h.secrets.has(saved.account.credentialRef), false);
});

test("Zhipu uses official documentation catalog instead of arbitrary manual model ID", async () => {
  const h = harness();
  const result = await h.service.probe({ providerId: "zhipu", displayName: "GLM", authMethodId: "api-key", settings: { endpoint: "standard" }, selectedModelId: "glm-5.3", modelSettings: { reasoningEffort: "max" } }, "real-looking-key");
  assert.equal(result.status, "unverified");
  assert.ok(result.models.some((item) => item.id === "glm-5.3"));
  assert.equal(h.requests.length, 0);
});

test("ChatGPT subscription cannot masquerade as API key flow", async () => {
  const h = harness();
  await assert.rejects(() => h.service.probe({ providerId: "openai", displayName: "ChatGPT", authMethodId: "chatgpt", settings: {}, selectedModelId: null, modelSettings: {} }, ""), /Codex App Server/);
});

test("Qwen parser reads official output.models shape", () => {
  const models = parseQwenModelList({ output: { models: [{ model: "qwen3.8-max", name: "Qwen3.8 Max", provider: "qwen", model_info: { context_window: 131072, max_output_tokens: 16384 } }] } });
  assert.deepEqual(models, [{ id: "qwen3.8-max", name: "Qwen3.8 Max", ownedBy: "qwen", contextWindow: 131072, maxOutputTokens: 16384 }]);
});

test("save rolls back newly written Secret when metadata persistence fails", async () => {
  const secrets = new Map();
  const service = new AiAccountService(new AiProviderRegistry(builtinAiProviderPlugins), {
    repository: { async list() { return []; }, async put() { throw new Error("metadata-write-failed"); }, async delete() {} },
    secrets: { persistence: "os-credential-store", async put(ref, value) { secrets.set(ref, value); }, async get(ref) { return secrets.get(ref) ?? null; }, async delete(ref) { secrets.delete(ref); } },
    http: { async requestJson() { return { data: [{ id: "gpt-6-astra" }] }; } },
    createId() { return "account-rollback"; }, now() { return "2026-09-19T04:00:00.000Z"; },
  });
  await assert.rejects(() => service.save(baseDraft, "sk-test-secret"), /metadata-write-failed/);
  assert.equal(secrets.size, 0);
});
