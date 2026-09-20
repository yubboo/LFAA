import test from "node:test";
import assert from "node:assert/strict";
import { AiAccountService } from "../src/settings/ai/core/account-service.ts";
import { AiProviderRegistry } from "../src/settings/ai/core/provider-registry.ts";
import { builtinAiProviderPlugins } from "../src/settings/ai/providers/index.ts";
import { parseQwenModelList } from "../src/settings/ai/transports/qwen-model-list.ts";

function harness(response = { data: [{ id: "gpt-6-astra", owned_by: "openai" }, { id: "gpt-5.6-sol" }] }) {
  let accounts = [];
  let activeModel = null;
  const secrets = new Map();
  const requests = [];
  let seq = 0;
  const service = new AiAccountService(new AiProviderRegistry(builtinAiProviderPlugins), {
    repository: {
      async list() { return accounts; },
      async put(record) { accounts = [...accounts.filter((item) => item.id !== record.id), record]; },
      async delete(id) { accounts = accounts.filter((item) => item.id !== id); },
      async getActiveModel() { return activeModel; },
      async setActiveModel(binding) { activeModel = binding; },
    },
    secrets: { persistence: "os-credential-store", async put(ref, value) { secrets.set(ref, value); }, async get(ref) { return secrets.get(ref) ?? null; }, async delete(ref) { secrets.delete(ref); } },
    http: { async requestJson(request) { requests.push(request); return response; } },
    createId() { seq += 1; return `account-000${seq}`; },
    now() { return "2026-09-19T04:00:00.000Z"; },
  });
  return { service, get accounts() { return accounts; }, get activeModel() { return activeModel; }, secrets, requests };
}


function managedHarness() {
  let accounts = [];
  let activeModel = null;
  const secretCalls = { put: 0, get: 0, delete: 0 };
  const managedCalls = { start: 0, status: 0, probe: 0, cancel: 0 };
  const runtimeSource = { kind: "runtime-model-api", label: "Codex App Server model/list", url: "https://developers.openai.com/codex/app-server#list-models", checkedAt: "2026-09-19" };
  const runtimeCapability = {
    source: runtimeSource,
    inputModalities: ["text", "image"],
    settings: [{ id: "reasoningEffort", label: "思考强度", kind: "select", requestPath: "reasoningEffort", defaultValue: "app-server-only", options: [{ value: "app-server-only", label: "app-server-only" }] }],
  };
  const service = new AiAccountService(new AiProviderRegistry(builtinAiProviderPlugins), {
    repository: {
      async list() { return accounts; },
      async put(record) { accounts = [...accounts.filter((item) => item.id !== record.id), record]; },
      async delete(id) { accounts = accounts.filter((item) => item.id !== id); },
      async getActiveModel() { return activeModel; },
      async setActiveModel(binding) { activeModel = binding; },
    },
    secrets: {
      persistence: "os-credential-store",
      async put() { secretCalls.put += 1; },
      async get() { secretCalls.get += 1; return null; },
      async delete() { secretCalls.delete += 1; },
    },
    http: { async requestJson() { throw new Error("subscription must not use provider HTTP"); } },
    managedAuth: {
      kind: "codex-app-server",
      async status() { managedCalls.status += 1; return { available: true }; },
      async startLogin() { managedCalls.start += 1; return { loginId: "login-12345678", authUrl: "https://chatgpt.com/auth" }; },
      async loginStatus() { return { state: "succeeded" }; },
      async cancelLogin() { managedCalls.cancel += 1; },
      async probe() { managedCalls.probe += 1; return { status: "connected", message: "ChatGPT connected", models: [{ id: "gpt-5.6-sol", name: "GPT-5.6 Sol", discoverySource: runtimeSource, capabilities: runtimeCapability }] }; },
    },
    createId() { return "account-managed-0001"; },
    now() { return "2026-09-19T04:00:00.000Z"; },
  });
  return { service, get accounts() { return accounts; }, get activeModel() { return activeModel; }, secretCalls, managedCalls };
}

const chatGptDraft = { providerId: "openai", displayName: "ChatGPT 套餐", authMethodId: "chatgpt", settings: {}, selectedModelId: "gpt-5.6-sol", modelSettings: { reasoningEffort: "app-server-only" } };
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

test("first saved account becomes explicit active model and keeps a model catalog snapshot", async () => {
  const h = harness();
  const saved = await h.service.save(baseDraft, "sk-test-secret");
  assert.equal(saved.account.modelCatalog.length, 2);
  assert.deepEqual(h.activeModel, { accountId: saved.account.id, providerId: "openai", modelId: "gpt-6-astra" });
  const snapshot = await h.service.snapshot();
  assert.deepEqual(snapshot.activeModel, h.activeModel);
});

test("saving another account does not steal active model; activation is explicit", async () => {
  const h = harness();
  const first = await h.service.save(baseDraft, "sk-test-secret");
  const second = await h.service.save({ ...baseDraft, displayName: "OpenAI 第二账户", selectedModelId: "gpt-5.6-sol", modelSettings: { reasoningEffort: "none", maxOutputTokens: 32000 } }, "sk-second-secret");
  assert.equal(h.activeModel.accountId, first.account.id);
  await h.service.activateModel(second.account.id);
  assert.deepEqual(h.activeModel, { accountId: second.account.id, providerId: "openai", modelId: "gpt-5.6-sol" });
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

test("ChatGPT subscription requires managed auth instead of masquerading as API key flow", async () => {
  const h = harness();
  await assert.rejects(() => h.service.probe({ providerId: "openai", displayName: "ChatGPT", authMethodId: "chatgpt", settings: {}, selectedModelId: null, modelSettings: {} }, null), /codex-app-server/);
  assert.equal(h.requests.length, 0);
});

test("managed ChatGPT login is delegated to Codex App Server capability", async () => {
  const h = managedHarness();
  const snapshot = await h.service.snapshot();
  assert.equal(snapshot.hostCapabilities["codex-app-server"].available, true);
  const login = await h.service.startManagedLogin(chatGptDraft);
  assert.equal(login.loginId, "login-12345678");
  assert.equal(h.managedCalls.start, 1);
  assert.equal(h.secretCalls.put, 0);
});

test("managed subscription save persists no credentialRef and trusts runtime model capabilities", async () => {
  const h = managedHarness();
  const result = await h.service.save(chatGptDraft, null);
  assert.equal(result.account.credentialRef, null);
  assert.deepEqual(result.account.modelSettings, { reasoningEffort: "app-server-only" });
  assert.equal(result.probe.models[0].capabilities.source.label, "Codex App Server model/list");
  assert.equal(h.secretCalls.put, 0);
  assert.equal(h.secretCalls.get, 0);
  assert.equal(h.managedCalls.probe, 1);
});

test("managed subscription reprobe/select/delete never touches Secret Store or global auth", async () => {
  const h = managedHarness();
  const saved = await h.service.save(chatGptDraft, null);
  await h.service.reprobe(saved.account.id);
  await h.service.selectModel(saved.account.id, "gpt-5.6-sol", { reasoningEffort: "app-server-only" });
  await h.service.delete(saved.account.id);
  assert.equal(h.accounts.length, 0);
  assert.deepEqual(h.secretCalls, { put: 0, get: 0, delete: 0 });
  assert.equal(h.managedCalls.cancel, 0);
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

test("save rolls back account, active model, and Secret when active binding persistence fails", async () => {
  let accounts = [];
  const secrets = new Map();
  const service = new AiAccountService(new AiProviderRegistry(builtinAiProviderPlugins), {
    repository: {
      async list() { return accounts; },
      async put(record) { accounts = [...accounts.filter((item) => item.id !== record.id), record]; },
      async delete(id) { accounts = accounts.filter((item) => item.id !== id); },
      async getActiveModel() { return null; },
      async setActiveModel() { throw new Error("active-write-failed"); },
    },
    secrets: { persistence: "os-credential-store", async put(ref, value) { secrets.set(ref, value); }, async get(ref) { return secrets.get(ref) ?? null; }, async delete(ref) { secrets.delete(ref); } },
    http: { async requestJson() { return { data: [{ id: "gpt-6-astra" }] }; } },
    createId() { return "account-active-rollback"; }, now() { return "2026-09-19T04:00:00.000Z"; },
  });
  await assert.rejects(() => service.save(baseDraft, "sk-test-secret"), /active-write-failed/);
  assert.equal(accounts.length, 0);
  assert.equal(secrets.size, 0);
});

test("delete restores account, active model, and Secret when Secret deletion fails", async () => {
  let accounts = [];
  let activeModel = null;
  const secrets = new Map();
  let failDelete = false;
  const service = new AiAccountService(new AiProviderRegistry(builtinAiProviderPlugins), {
    repository: {
      async list() { return accounts; },
      async put(record) { accounts = [...accounts.filter((item) => item.id !== record.id), record]; },
      async delete(id) { accounts = accounts.filter((item) => item.id !== id); },
      async getActiveModel() { return activeModel; },
      async setActiveModel(binding) { activeModel = binding; },
    },
    secrets: {
      persistence: "os-credential-store",
      async put(ref, value) { secrets.set(ref, value); },
      async get(ref) { return secrets.get(ref) ?? null; },
      async delete(ref) { if (failDelete) throw new Error("secret-delete-failed"); secrets.delete(ref); },
    },
    http: { async requestJson() { return { data: [{ id: "gpt-6-astra" }] }; } },
    createId() { return "account-delete-rollback"; }, now() { return "2026-09-19T04:00:00.000Z"; },
  });
  const saved = await service.save(baseDraft, "sk-test-secret");
  const activeBefore = activeModel;
  failDelete = true;
  await assert.rejects(() => service.delete(saved.account.id), /secret-delete-failed/);
  assert.equal(accounts.length, 1);
  assert.deepEqual(activeModel, activeBefore);
  assert.equal(secrets.get(saved.account.credentialRef), "sk-test-secret");
});

test("setActiveModel switches from cached catalog without another Provider request", async () => {
  const h = harness();
  const saved = await h.service.save(baseDraft, "sk-test-secret");
  const requestsAfterSave = h.requests.length;
  await h.service.setActiveModel(saved.account.id, "gpt-5.6-sol", { reasoningEffort: "none", maxOutputTokens: 32000 });
  assert.equal(h.requests.length, requestsAfterSave);
  assert.equal(h.accounts[0].selectedModelId, "gpt-5.6-sol");
  assert.deepEqual(h.accounts[0].modelSettings, { reasoningEffort: "none", maxOutputTokens: 32000 });
  assert.deepEqual(h.activeModel, { accountId: saved.account.id, providerId: "openai", modelId: "gpt-5.6-sol" });
});

test("setActiveModel preserves current settings when selecting the already active model", async () => {
  const h = harness();
  const saved = await h.service.save(baseDraft, "sk-test-secret");
  await h.service.setActiveModel(saved.account.id, "gpt-6-astra");
  assert.deepEqual(h.accounts[0].modelSettings, { reasoningEffort: "high", maxOutputTokens: 64000 });
});
