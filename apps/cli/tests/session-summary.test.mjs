/**
 * 功能：验证 Session 用量与上下文投影只保留真实 Provider 数据。
 * 作用：覆盖多模型分组、缺失缓存字段、零值和最近请求上下文回报。
 * 关联文件：packages/session/session-persistence-jsonl/src/session-summary.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applySessionSummaryEvent, createSessionSummaryAccumulator, projectSessionUsage } from "../../../packages/session/session-persistence-jsonl/src/session-summary.ts";

function event(type, seq, data) { return { type, seq, data }; }

test("会话累计按 Provider/模型分组，缺失缓存值与显式零保持不同", () => {
  const accumulator = createSessionSummaryAccumulator();
  applySessionSummaryEvent(accumulator, event("usage/record", 1, { runId: "turn-a", providerId: "deepseek", modelId: "flash", requestCount: 2, cacheReadReportedRequestCount: 2, cacheReadReportedTokens: 375, promptTokens: 1000, completionTokens: 20, cacheReadTokens: 375 }));
  applySessionSummaryEvent(accumulator, event("usage/record", 2, { runId: "turn-b", providerId: "deepseek", modelId: "flash", requestCount: 1, cacheReadReportedRequestCount: 1, cacheReadReportedTokens: 0, promptTokens: 800, completionTokens: 10, cacheReadTokens: 0 }));
  applySessionSummaryEvent(accumulator, event("usage/record", 3, { runId: "turn-c", providerId: "other", modelId: "large", requestCount: 1, cacheReadReportedRequestCount: 0, cacheReadReportedTokens: 0, promptTokens: 300, completionTokens: 12, cacheReadTokens: null }));

  assert.deepEqual(projectSessionUsage(accumulator), {
    requestCount: 4,
    requestCountExact: true,
    promptTokens: 2100,
    completionTokens: 42,
    cacheReadTokens: null,
    models: [
      { providerId: "deepseek", modelId: "flash", requestCount: 3, requestCountExact: true, promptTokens: 1800, completionTokens: 30, cacheReadTokens: 375, cacheReadReportedTokens: 375, cacheReadReportedRequestCount: 3 },
      { providerId: "other", modelId: "large", requestCount: 1, requestCountExact: true, promptTokens: 300, completionTokens: 12, cacheReadTokens: null, cacheReadReportedTokens: 0, cacheReadReportedRequestCount: 0 }
    ]
  });
});

test("旧会话用量可以保留 Token 总量，但不假装还原了模型请求次数", () => {
  const accumulator = createSessionSummaryAccumulator();
  applySessionSummaryEvent(accumulator, event("usage/record", 1, { runId: "legacy", providerId: "deepseek", modelId: "flash", promptTokens: 100, completionTokens: 10, cacheReadTokens: null }));
  const summary = projectSessionUsage(accumulator);
  assert.equal(summary.requestCountExact, false);
  assert.equal(summary.models[0]?.requestCountExact, false);
  assert.equal(summary.models[0]?.cacheReadReportedRequestCount, null);
  assert.equal(summary.promptTokens, 100);
});

test("上下文快照随真实请求变化，并用响应中的实际 prompt token 更新总量", () => {
  const accumulator = createSessionSummaryAccumulator();
  applySessionSummaryEvent(accumulator, event("request/context", 8, { runId: "turn-a", contextUsage: {
    providerId: "deepseek", modelId: "flash", contextWindow: 64000, contextWindowSource: "model-catalog", promptTokens: null,
    estimatedPromptTokens: 410, systemTokens: 90, toolsTokens: 120, messageTokens: 200, includesImages: false
  } }));
  applySessionSummaryEvent(accumulator, event("assistant/response", 9, { runId: "turn-a", usage: { promptTokens: 512, completionTokens: 18 } }));
  applySessionSummaryEvent(accumulator, event("request/context", 10, { runId: "turn-b", contextUsage: {
    providerId: "other", modelId: "large", contextWindow: 1000000, contextWindowSource: "model-catalog", promptTokens: null,
    estimatedPromptTokens: 900, systemTokens: 100, toolsTokens: 300, messageTokens: 500, includesImages: true
  } }));
  applySessionSummaryEvent(accumulator, event("assistant/response", 11, { runId: "turn-b", usage: { promptTokens: 1024, completionTokens: 10 } }));

  assert.deepEqual(accumulator.contextUsage, {
    providerId: "other", modelId: "large", contextWindow: 1000000, contextWindowSource: "model-catalog", promptTokens: 1024,
    estimatedPromptTokens: 900, systemTokens: 100, toolsTokens: 300, messageTokens: 500, includesImages: true
  });
});
