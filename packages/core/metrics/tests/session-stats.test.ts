// 验证会话统计聚合：轮次、工具步数、模型/工具耗时、首 token、吞吐、token 构成、上下文与成本。
import assert from "node:assert/strict";
import test from "node:test";
import {
  computeSessionMetrics,
  formatCompactTokens,
  formatCost,
  formatDurationMs,
  type SessionMessage,
} from "../src/session-stats";

const messages: SessionMessage[] = [
  { role: "user" },
  {
    role: "assistant",
    status: "done",
    runDurationMs: 2_000,
    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cachedPromptTokens: 80 },
    steps: [{ phase: "think" }, { phase: "act" }],
    cost: { amount: 0.1, currency: "CNY", input: 0.05, cachedInput: 0.02, output: 0.03 },
    metrics: {
      llmMs: 1_500,
      toolMs: 300,
      ttftMs: 800,
      ttftSteps: 1,
      decodeMs: 700,
      decodeTokens: 50,
      context: { systemTokens: 10, toolsTokens: 20, messageTokens: 70 },
      contextWindowTokens: 1_000,
      contextPromptTokens: 95,
      contextWindowSource: "configured",
      cacheMeasurement: { promptTokens: 100, cachedTokens: 80 },
    },
  },
  {
    role: "assistant",
    status: "done",
    runDurationMs: 1_000,
    tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, cachedPromptTokens: 20 },
    cost: { amount: 0.25, currency: "CNY", input: 0.1, cachedInput: 0.05, output: 0.1 },
    metrics: {
      llmMs: 500,
      toolMs: 0,
      ttftMs: 600,
      ttftSteps: 1,
      decodeMs: 400,
      decodeTokens: 50,
      context: { systemTokens: 12, toolsTokens: 20, messageTokens: 80 },
      contextPromptTokens: 100,
      contextModel: "actual-model",
    },
  },
];

test("汇总轮次、工具步数、耗时、首 token、吞吐、token、上下文与成本", () => {
  const metrics = computeSessionMetrics(messages);
  assert.equal(metrics.turns, 2);
  assert.equal(metrics.steps, 1);
  assert.equal(metrics.totalTokens, 300);
  assert.equal(metrics.promptTokens, 200);
  assert.equal(metrics.completionTokens, 100);
  assert.equal(metrics.cachedPromptTokens, 100);
  assert.equal(metrics.llmMs, 2_000);
  assert.equal(metrics.toolMs, 300);
  assert.equal(metrics.ttftSteps, 2);
  assert.equal(metrics.ttftMs, 1_400);
  assert.equal(metrics.decodeMs, 1_100);
  assert.equal(metrics.tokensPerSecond, 100 / 1.1);
  assert.equal(metrics.cacheHitRate, 0.8);
  assert.ok(metrics.cost, "应汇总成本");
  assert.ok(Math.abs(metrics.cost.amount - 0.35) < 1e-9);
  assert.ok(Math.abs(metrics.cost.input - 0.15) < 1e-9);
  assert.ok(Math.abs(metrics.cost.cachedInput - 0.07) < 1e-9);
  assert.ok(Math.abs(metrics.cost.output - 0.13) < 1e-9);
  assert.deepEqual(metrics.context, {
    totalTokens: 100,
    model: "actual-model",
  });
});

test("运行中的消息也计入用量与上下文，但轮次只在完成后计数", () => {
  const metrics = computeSessionMetrics([
    {
      role: "assistant",
      status: "streaming",
      steps: [{ phase: "act" }],
      tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, cachedPromptTokens: 80 },
      cost: { amount: 0.01, currency: "CNY", input: 0.002, cachedInput: 0.004, output: 0.004 },
      metrics: {
        llmMs: 500,
        toolMs: 100,
        ttftMs: 200,
        ttftSteps: 1,
        decodeMs: 300,
        decodeTokens: 20,
        context: { systemTokens: 10, toolsTokens: 20, messageTokens: 30 },
        contextWindowTokens: 1_000,
        contextWindowSource: "provider-spec",
        contextPromptTokens: 100,
        cacheMeasurement: { promptTokens: 100, cachedTokens: 0 },
      },
    },
  ]);
  assert.equal(metrics.turns, 0);
  assert.equal(metrics.steps, 1);
  assert.equal(metrics.totalTokens, 120);
  assert.equal(metrics.context?.totalTokens, 100);
  assert.equal(metrics.context?.percent, 10);
  assert.equal(metrics.cacheHitRate, 0);
  assert.equal(metrics.cost?.amount, 0.01);
  assert.equal(metrics.tokensPerSecond, 20 / 0.3);
});

test("没有用量与指标时缺省，不伪造数据", () => {
  const metrics = computeSessionMetrics([
    { role: "user" },
    { role: "assistant", status: "done" },
  ]);
  assert.equal(metrics.turns, 1);
  assert.equal(metrics.steps, 0);
  assert.equal(metrics.totalTokens, 0);
  assert.equal(metrics.tokensPerSecond, undefined);
  assert.equal(metrics.cacheHitRate, undefined);
  assert.equal(metrics.context, undefined);
  assert.equal(metrics.cost, undefined);
});

test("token、成本与时长格式化", () => {
  assert.equal(formatCompactTokens(999), "999");
  assert.equal(formatCompactTokens(1_200), "1.2k");
  assert.equal(formatCompactTokens(114_000_000), "114.0M");
  assert.equal(formatDurationMs(1_700, true), "1.7 秒");
  assert.equal(formatDurationMs(2_053_000, true), "34 分 13 秒");
  assert.equal(formatDurationMs(0, true), "0 秒");
  assert.equal(formatCost(1.9), "¥1.90");
  assert.equal(formatCost(0.446), "¥0.446");
  assert.equal(formatCost(0.0023), "¥0.0023");
  assert.equal(formatCost(0), "¥0");
});
