// 提供商接入预设的回归测试：验证套餐凭据、计费路由和旧档案匹配保持隔离。
import assert from "node:assert/strict";
import test from "node:test";
import type { PublicLlmProfileItem } from "../client/chat-types";
import { MODEL_PROVIDER_CATALOG, findProfileForProvider, resolveNextBaseUrlForProtocol } from "../client/provider-catalog";
import { findProviderPlan, getProviderPlans } from "../client/provider-plans";

function profile(id: string, baseUrl: string, providerId?: string): PublicLlmProfileItem {
  return {
    id, baseUrl, name: id, kind: "openai-compatible", apiProtocol: "openai-chat",
    model: "test-model", hasApiKey: true, apiKeyMasked: "test****", configured: true,
    availableModels: [], updatedAt: 0, ...(providerId ? { providerId } : {}),
  };
}

test("火山方舟普通 API、Agent Plan 和 Coding Plan 各自匹配独立配置", () => {
  const ordinary = MODEL_PROVIDER_CATALOG.find((preset) => preset.id === "volcengine");
  const custom = MODEL_PROVIDER_CATALOG.find((preset) => preset.id === "custom");
  const [agent, coding] = getProviderPlans("volcengine");
  assert.ok(ordinary && custom && agent && coding);
  assert.equal(new URL(ordinary.defaultBaseUrl).pathname, "/api/v3");
  assert.equal(new URL(agent.defaultBaseUrl).pathname, "/api/plan/v3");
  assert.equal(new URL(coding.defaultBaseUrl).pathname, "/api/coding/v3");

  const plan = profile("agent", agent.defaultBaseUrl + "/", ordinary.id);
  const code = profile("coding", coding.defaultBaseUrl.replace(/\/v3$/u, ""));
  const api = profile("standard", ordinary.defaultBaseUrl, ordinary.id);
  const profiles = [plan, code, api];
  assert.equal(findProfileForProvider(profiles, ordinary)?.id, api.id);
  assert.equal(findProfileForProvider(profiles, agent)?.id, plan.id);
  assert.equal(findProfileForProvider(profiles, coding)?.id, code.id);
  assert.equal(findProfileForProvider([plan, code], ordinary), undefined);
  assert.equal(findProfileForProvider([plan, code], custom), undefined);
});

test("提供商仅在有独立套餐时进入选择页，套餐重新配置使用对应旧档案", () => {
  const supported = MODEL_PROVIDER_CATALOG
    .filter(({ id }) => getProviderPlans(id).length > 0)
    .map(({ id }) => id);
  assert.deepEqual(supported, ["minimax", "qwen", "volcengine", "zhipu"]);
  assert.equal(getProviderPlans("deepseek").length, 0);

  const qwen = MODEL_PROVIDER_CATALOG.find(({ id }) => id === "qwen");
  const zhipu = MODEL_PROVIDER_CATALOG.find(({ id }) => id === "zhipu");
  const custom = MODEL_PROVIDER_CATALOG.find(({ id }) => id === "custom");
  const [token, coding] = getProviderPlans("qwen");
  const [glm] = getProviderPlans("zhipu");
  assert.ok(qwen && zhipu && custom && token && coding && glm);
  const legacyToken = profile("previous-token", `${token.defaultBaseUrl}/chat/completions/`, qwen.id);
  const newCoding = profile("coding", coding.defaultBaseUrl, coding.id);
  const legacyGlm = profile("previous-glm", glm.defaultBaseUrl);
  const standardQwen = profile("standard", qwen.defaultBaseUrl, qwen.id);
  const profiles = [legacyToken, newCoding, legacyGlm, standardQwen];
  assert.equal(findProfileForProvider(profiles, qwen)?.id, standardQwen.id);
  assert.equal(findProfileForProvider(profiles, token)?.id, legacyToken.id);
  assert.equal(findProfileForProvider(profiles, coding)?.id, newCoding.id);
  assert.equal(findProfileForProvider(profiles, glm)?.id, legacyGlm.id);
  assert.equal(findProfileForProvider([legacyGlm], zhipu), undefined);
  assert.equal(findProfileForProvider([legacyToken, newCoding, legacyGlm], custom), undefined);
});

test("MiniMax 共用地址仅按档案类型区分普通 API 与套餐", () => {
  const ordinary = MODEL_PROVIDER_CATALOG.find(({ id }) => id === "minimax");
  const [planPreset] = getProviderPlans("minimax");
  assert.ok(ordinary && planPreset);
  const standard = profile("standard", planPreset.defaultBaseUrl, ordinary.id);
  const plan = profile("subscription", planPreset.defaultBaseUrl, planPreset.id);
  assert.equal(findProviderPlan(standard), undefined);
  assert.equal(findProfileForProvider([standard], planPreset), undefined);
  assert.equal(findProfileForProvider([plan, standard], ordinary)?.id, standard.id);
  assert.equal(findProfileForProvider([standard, plan], planPreset)?.id, plan.id);
});

test("所有常规提供商与官方套餐均支持多协议及端点联动", () => {
  for (const preset of MODEL_PROVIDER_CATALOG) {
    assert.ok(preset.supportedProtocols.length >= 2, `${preset.id} 应至少支持 2 种协议`);
    for (const planItem of getProviderPlans(preset.id)) {
      assert.ok(planItem.supportedProtocols.length >= 2, `${planItem.id} 应至少支持 2 种协议`);
    }
  }

  const [agent] = getProviderPlans("volcengine");
  assert.ok(agent);
  const antUrl = resolveNextBaseUrlForProtocol(agent, agent.defaultBaseUrl, "anthropic-messages");
  assert.equal(antUrl, "https://ark.cn-beijing.volces.com/api/plan");
  const antProfile = profile("agent-ant", antUrl, agent.id);
  assert.equal(findProfileForProvider([antProfile], agent)?.id, antProfile.id);
});
