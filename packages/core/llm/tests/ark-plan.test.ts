// 验证方舟套餐目录、官方思考档位及 OpenAI Chat 适配器发送的实际参数。
import assert from "node:assert/strict";
import test from "node:test";
import { ARK_PLAN_BASE_URLS, findArkChatModel, getArkPlanCatalog, getArkPlanKind } from "../src/ark-plan";
import { toPublicProfile } from "../src/index";
import { callOpenAiCompatibleChat } from "../src/openai-adapter";
import type { LlmProfile, ReasoningEffortLevel } from "../src/types";

const profile: LlmProfile = {
  id: "ark-plan-test",
  kind: "openai-compatible",
  apiProtocol: "openai-chat",
  name: "Ark",
  baseUrl: ARK_PLAN_BASE_URLS.agent,
  apiKey: "test-key",
  model: "ark-code-latest",
  updatedAt: 0,
};

test("方舟官方套餐模型按能力归类，聊天档案只提供语言模型和控制台路由", () => {
  const { chatModels, otherGroups } = getArkPlanCatalog("agent");
  assert.equal(new Set(chatModels.map(({ id }) => id)).size, 14);
  assert.deepEqual(otherGroups.map(({ kind, models }) => [kind, models.length]), [
    ["embedding", 1], ["vision", 3], ["speech", 2],
  ]);
  assert.deepEqual(getArkPlanCatalog("coding").otherGroups.map(({ kind }) => kind), ["embedding"]);
  assert.deepEqual(toPublicProfile(profile).availableModels.map(({ id }) => id), chatModels.map(({ id }) => id));
  assert.equal(getArkPlanKind(`${ARK_PLAN_BASE_URLS.agent}/chat/completions/`), "agent");
  assert.equal(getArkPlanKind("https://ark.cn-beijing.volces.com/api/v3"), undefined);
  assert.equal(getArkPlanKind("https://example.test/api/plan/v3"), undefined);
  assert.deepEqual(findArkChatModel("Kimi-K3.1-Pro")?.reasoningLevels, ["low", "high", "max"]);
  assert.equal(findArkChatModel("doubao-seed-2.0-mini")?.defaultReasoningLevel, "medium");
});

test("关闭思考按真实模型映射，控制台路由和未知 ID 不发送猜测的思考强度", async (t) => {
  const payloads: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, `${profile.baseUrl}/chat/completions`);
    payloads.push(JSON.parse(String(init.body)));
    return Response.json({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] });
  });

  const cases: Array<[string, ReasoningEffortLevel, string | undefined]> = [
    ["deepseek-v4.1-flash", "minimal", "none"],
    ["deepseek-v4.1-flash-economy", "max", "max"],
    ["deepseek-v4-pro", "minimal", "minimal"],
    ["doubao-seed-evolving", "medium", "medium"],
    ["kimi-k3.1-pro", "minimal", "max"],
    ["glm-5.3-flash", "low", "low"],
    ["glm-5.3", "max", undefined],
    ["ark-code-latest", "low", undefined],
    ["unknown-model", "high", undefined],
  ];
  for (const [model, reasoningEffort] of cases) {
    await callOpenAiCompatibleChat({ ...profile, model }, {
      messages: [{ role: "user", content: "Hello" }],
      reasoningEffort,
    });
  }
  assert.deepEqual(payloads.map(({ model, reasoning_effort }) => [model, reasoning_effort]),
    cases.map(([model, , expected]) => [model, expected]));
  assert.ok(payloads.every((payload) => !("thinking" in payload)));
});
