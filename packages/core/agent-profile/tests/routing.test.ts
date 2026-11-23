// 验证路由候选解析、错误分类与派发器换目标规则（首 token 后不换、认不出就不换）。
import assert from "node:assert/strict";
import test from "node:test";
import type { LlmGenerateInput, LlmGenerateOutput, LlmProfile } from "@lfaa/llm";
import {
  classifyError,
  createRoutedLlm,
  DEFAULT_BINDING_ID,
  planRoute,
  type BindingSource,
  type ModelBinding,
  type RoutedAttempt,
} from "../src/index";

const binding = (patch: Partial<ModelBinding> = {}): ModelBinding => ({
  id: "b1",
  name: "测试绑定",
  strategy: "order",
  targets: [{ profileId: "a" }, { profileId: "b" }],
  onError: "next",
  createdAt: 0,
  updatedAt: 0,
  ...patch,
});

const profiles = new Set(["a", "b", "c"]);

function output(model: string): LlmGenerateOutput {
  return { model, provider: "openai-compatible", content: `来自 ${model}`, toolCalls: [], finishReason: "stop" };
}

test("order 保序并跳过不存在的配置", () => {
  const plan = planRoute(binding({ targets: [{ profileId: "a" }, { profileId: "ghost" }, { profileId: "c" }] }), {
    availableProfileIds: profiles,
  });
  assert.deepEqual(plan.candidates.map((candidate) => candidate.profileId), ["a", "c"]);
  assert.deepEqual(plan.skipped, [{ target: { profileId: "ghost" }, reason: "missing-profile" }]);
  assert.equal(plan.inheritGlobal, false);
});

test("重复目标只保留第一次出现", () => {
  const plan = planRoute(binding({ targets: [{ profileId: "a" }, { profileId: "a" }, { profileId: "b" }] }), {
    availableProfileIds: profiles,
  });
  assert.deepEqual(plan.candidates.map((candidate) => candidate.profileId), ["a", "b"]);
  assert.equal(plan.skipped.length, 1);
  assert.equal(plan.skipped[0]?.reason, "duplicate");
});

test("rotate 按游标偏移，usage 按本地用量升序", () => {
  const rotated = planRoute(binding({ strategy: "rotate", targets: [{ profileId: "a" }, { profileId: "b" }, { profileId: "c" }] }), {
    availableProfileIds: profiles,
    rotationIndex: 1,
  });
  assert.deepEqual(rotated.candidates.map((candidate) => candidate.profileId), ["b", "c", "a"]);

  const byUsage = planRoute(binding({ strategy: "usage" }), {
    availableProfileIds: profiles,
    usageCounts: { a: 5, b: 1 },
  });
  assert.deepEqual(byUsage.candidates.map((candidate) => candidate.profileId), ["b", "a"]);
});

test("内置 default 跟随全局，不产出候选", () => {
  const plan = planRoute(
    { ...binding({ id: DEFAULT_BINDING_ID, targets: [], inheritGlobal: true }), builtin: true },
    { availableProfileIds: profiles },
  );
  assert.equal(plan.inheritGlobal, true);
  assert.equal(plan.candidates.length, 0);
});

test("错误分类：限流、5xx、鉴权换目标；400 与未知错误不换", () => {
  assert.equal(classifyError(new Error("429 Too Many Requests")), "next-target");
  assert.equal(classifyError(new Error("模型接口返回错误 (502): bad gateway")), "next-target");
  assert.equal(classifyError(new Error("401 认证失败：Key 无效")), "next-target");
  assert.equal(classifyError(new Error("402 余额不足")), "next-target");
  assert.equal(classifyError(new Error("400 格式错误：messages 不合法")), "fatal");
  assert.equal(classifyError(new Error("模型连接失败或中途断开（ECONNRESET）")), "next-target");
  assert.equal(classifyError(new Error("凭空出现的怪错误")), "fatal");
  assert.equal(classifyError(new DOMException("已取消", "AbortError")), "fatal");
});

/** 假模型服务：按脚本返回或抛错，并记录每次调用的 profile/model。 */
function fakeLlm(script: Array<{ ok?: LlmGenerateOutput; error?: Error; onCall?: (input: LlmGenerateInput) => void }>) {
  const calls: Array<{ profileId?: string; modelId?: string }> = [];
  let index = 0;
  return {
    calls,
    async complete(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
      const step = script[Math.min(index, script.length - 1)];
      index += 1;
      calls.push({
        ...(input.profileId ? { profileId: input.profileId } : {}),
        ...(input.modelId ? { modelId: input.modelId } : {}),
      });
      step?.onCall?.(input);
      if (step?.error) throw step.error;
      return step?.ok ?? output("unknown");
    },
    async resolveProfile(profileId?: string): Promise<LlmProfile> {
      const id = profileId ?? "global";
      return {
        id,
        name: id,
        kind: "openai-compatible",
        baseUrl: "http://localhost",
        model: `${id}-model`,
        apiKey: "",
        configured: true,
        updatedAt: 0,
      } as LlmProfile;
    },
    async listPublicProfiles() {
      return {
        activeProfileId: "a",
        profiles: [
          { id: "a", name: "A", model: "a-model", availableModels: [] },
          { id: "b", name: "B", model: "b-model", availableModels: [] },
        ],
      };
    },
  };
}

/** 绑定来源桩：固定返回一份绑定。 */
function bindingsOf(record: ModelBinding): BindingSource {
  return {
    async getBinding(id) {
      return id === record.id ? record : undefined;
    },
    async resolveBindingId(_agentId, overrideId) {
      return overrideId ?? record.id;
    },
  };
}

test("主目标限流后切到第二个目标并如实记录两次尝试", async () => {
  const attempts: RoutedAttempt[] = [];
  const llm = fakeLlm([
    { error: new Error("429 Too Many Requests") },
    { ok: output("b-model") },
  ]);
  const routed = createRoutedLlm({
    llm: llm as never,
    bindings: bindingsOf(binding()),
    onAttempt: (attempt) => attempts.push(attempt),
  });
  const result = await routed.complete({ messages: [{ role: "user", content: "hi" }] });
  assert.equal(result.model, "b-model");
  assert.deepEqual(llm.calls.map((call) => call.profileId), ["a", "b"]);
  assert.deepEqual(attempts.map((attempt) => attempt.outcome), ["failed", "success"]);
  assert.equal(attempts[0]?.errorClass, "next-target");
});

test("首 token 之后失败不再换目标，避免拼接两段输出", async () => {
  const llm = fakeLlm([
    {
      error: new Error("502 网关错误"),
      onCall: (input) => input.onDelta?.({ type: "text", text: "已经说了一半" }),
    },
    { ok: output("b-model") },
  ]);
  const routed = createRoutedLlm({ llm: llm as never, bindings: bindingsOf(binding()) });
  await assert.rejects(routed.complete({ messages: [{ role: "user", content: "hi" }] }), /502/u);
  assert.deepEqual(llm.calls.map((call) => call.profileId), ["a"]);
});

test("400 不做无谓切换；onError=fail 的绑定也不切换", async () => {
  const llm = fakeLlm([{ error: new Error("400 格式错误") }, { ok: output("b-model") }]);
  const routed = createRoutedLlm({ llm: llm as never, bindings: bindingsOf(binding()) });
  await assert.rejects(routed.complete({ messages: [] }), /400/u);
  assert.equal(llm.calls.length, 1);

  const strict = fakeLlm([{ error: new Error("429 Too Many Requests") }, { ok: output("b-model") }]);
  const routedStrict = createRoutedLlm({
    llm: strict as never,
    bindings: bindingsOf(binding({ onError: "fail" })),
  });
  await assert.rejects(routedStrict.complete({ messages: [] }), /429/u);
  assert.equal(strict.calls.length, 1);
});

test("调用方显式给 profileId 或绑定跟随全局时不介入路由", async () => {
  const explicit = fakeLlm([{ ok: output("a-model") }]);
  const routedExplicit = createRoutedLlm({ llm: explicit as never, bindings: bindingsOf(binding()) });
  await routedExplicit.complete({ messages: [], profileId: "a", modelId: "custom" });
  assert.deepEqual(explicit.calls, [{ profileId: "a", modelId: "custom" }]);

  const inherit = fakeLlm([{ ok: output("global-model") }]);
  const routedInherit = createRoutedLlm({
    llm: inherit as never,
    bindings: bindingsOf({ ...binding({ id: DEFAULT_BINDING_ID, targets: [], inheritGlobal: true }) }),
  });
  await routedInherit.complete({ messages: [] });
  assert.deepEqual(inherit.calls, [{}]);
});

test("绑定目标全都不在配置里时报错而不是静默走全局", async () => {
  const llm = fakeLlm([{ ok: output("x") }]);
  const routed = createRoutedLlm({
    llm: {
      ...llm,
      async listPublicProfiles() {
        return { activeProfileId: "a", profiles: [] };
      },
    } as never,
    bindings: bindingsOf(binding()),
  });
  await assert.rejects(routed.complete({ messages: [] }), /没有可用目标/u);
  assert.equal(llm.calls.length, 0);
});

test("绑定不存在时直接报错，提示去 Agents 页重选", async () => {
  const llm = fakeLlm([{ ok: output("x") }]);
  const missing: BindingSource = {
    async getBinding() {
      return undefined;
    },
    async resolveBindingId() {
      return "ghost";
    },
  };
  const routed = createRoutedLlm({ llm: llm as never, bindings: missing });
  await assert.rejects(routed.complete({ messages: [] }), /模型绑定不存在/u);
  assert.equal(llm.calls.length, 0);
});

test("resolveProfile 按绑定首目标解析，跟随全局时用全局配置", async () => {
  const llm = fakeLlm([{ ok: output("a-model") }]);
  const routed = createRoutedLlm({ llm: llm as never, bindings: bindingsOf(binding()) });
  assert.equal((await routed.resolveProfile()).id, "a");
  assert.equal((await routed.resolveProfile("b")).id, "b");

  const inherit = createRoutedLlm({
    llm: llm as never,
    bindings: bindingsOf({ ...binding({ id: DEFAULT_BINDING_ID, targets: [], inheritGlobal: true }) }),
  });
  assert.equal((await inherit.resolveProfile()).id, "global");
});