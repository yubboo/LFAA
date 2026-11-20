// 验证上下文窗口推断：模型名里的容量标记优先，家族兜底，无法确定时返回 undefined。
import assert from "node:assert/strict";
import test from "node:test";
import { inferContextWindow, resolveReportedContextWindow } from "../src/context-window";

test("模型名里的容量标记优先", () => {
  assert.equal(inferContextWindow("doubao-pro-32k"), 32_000);
  assert.equal(inferContextWindow("my-model-128k"), 128_000);
  assert.equal(inferContextWindow("x-1m-chat"), 1_000_000);
});

test("已知家族按公开值兜底", () => {
  assert.equal(inferContextWindow("claude-sonnet-4"), 200_000);
  assert.equal(inferContextWindow("gemini-2.5-pro"), 1_000_000);
  assert.equal(inferContextWindow("gpt-4o-mini"), 128_000);
  assert.equal(inferContextWindow("deepseek-chat"), 64_000);
});

test("无法确定时返回 undefined，不编造", () => {
  assert.equal(inferContextWindow("ark-code-latest"), undefined);
  assert.equal(inferContextWindow("deepseek-v4-1-flash-261017"), undefined);
  assert.equal(inferContextWindow(undefined), undefined);
  assert.equal(inferContextWindow(""), undefined);
});

test("方舟按响应模型匹配官方窗口，动态别名和未验证型号保持缺省", () => {
  const profile = { model: "ark-code-latest", providerId: "volcengine-agent-plan" };
  assert.deepEqual(resolveReportedContextWindow(profile, "deepseek-v4-1-flash-261017"), { tokens: 1_048_576, source: "provider-spec" });
  assert.equal(resolveReportedContextWindow(profile, profile.model), undefined);
  assert.equal(resolveReportedContextWindow({ ...profile, contextWindowTokens: 1000 }, "unknown-other-model"), undefined);
});
