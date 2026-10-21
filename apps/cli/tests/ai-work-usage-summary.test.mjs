/**
 * 功能：回归 AI Work 主聊天与侧边聊天共用的 Provider 用量标签。
 * 作用：确认缓存命中率只使用 Provider 的真实计数，缺失值保持未知。
 * 关联文件：packages/client/ui-chat/src/usage-summary.ts、AiUsageFooter.tsx。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { formatAiUsageFooterLabel, projectAiSessionUsageDisplay } from "../../../packages/client/ui-chat/src/usage-summary.ts";

test("缓存标签根据 Provider 回报计算，显式零保持为零", () => {
  assert.equal(formatAiUsageFooterLabel({ providerId: "deepseek", modelId: "deepseek-flash", promptTokens: 1000, completionTokens: 25, cacheReadTokens: 375 }, false, true), "本轮 1,000 输入 · 25 输出 · 缓存命中 37.5% · 375 tokens · deepseek / deepseek-flash");
  assert.equal(formatAiUsageFooterLabel({ providerId: "deepseek", modelId: "deepseek-flash", promptTokens: 1000, completionTokens: 0, cacheReadTokens: 0 }, false, true), "本轮 1,000 输入 · 0 输出 · 缓存命中 0.0% · 0 tokens · deepseek / deepseek-flash");
});

test("缺失计数与不一致的 Provider 计数不会伪造成命中率", () => {
  assert.equal(formatAiUsageFooterLabel({ providerId: "deepseek", modelId: "deepseek-flash", promptTokens: 1000, completionTokens: 25, cacheReadTokens: null }, false, true), "本轮 1,000 输入 · 25 输出 · Provider 未返回缓存读取计数 · deepseek / deepseek-flash");
  assert.equal(formatAiUsageFooterLabel({ providerId: "deepseek", modelId: "deepseek-flash", promptTokens: 10, completionTokens: null, cacheReadTokens: 12 }, false, true), "本轮 10 输入 · 输出量未提供 · 缓存用量与总输入量不一致 · deepseek / deepseek-flash");
  assert.equal(formatAiUsageFooterLabel({ providerId: "deepseek", modelId: "deepseek-flash", promptTokens: null, completionTokens: null, cacheReadTokens: 12 }, false, true), "本轮 输入量未提供 · 输出量未提供 · 缓存命中 12 tokens · 总输入量未提供 · deepseek / deepseek-flash");
});

test("没有本轮用量时明确区分正在获取、未上报和尚无会话", () => {
  assert.equal(formatAiUsageFooterLabel(null, true, false), "正在获取本轮 Provider 用量…");
  assert.equal(formatAiUsageFooterLabel(null, false, true), "本轮 Provider 未返回用量");
  assert.equal(formatAiUsageFooterLabel(null, false, false), "缓存读数会在 Provider 返回用量后显示");
});

test("会话缓存展示不跨模型合并命中率，缺字段和异常值不伪造结果", () => {
  const oneModel = projectAiSessionUsageDisplay({ requestCount: 2, promptTokens: 1500, completionTokens: 35, cacheReadTokens: 375, models: [
    { providerId: "deepseek", modelId: "flash", requestCount: 2, promptTokens: 1500, completionTokens: 35, cacheReadTokens: 375, cacheReadReportedRequestCount: 2 }
  ] });
  assert.deepEqual(oneModel, { totalTokens: 1535, cachePercent: 25, cacheLabel: "缓存命中 25.0%" });

  const twoModels = projectAiSessionUsageDisplay({ requestCount: 2, promptTokens: 300, completionTokens: 25, cacheReadTokens: 50, models: [
    { providerId: "deepseek", modelId: "flash", requestCount: 1, promptTokens: 100, completionTokens: 10, cacheReadTokens: 50, cacheReadReportedRequestCount: 1 },
    { providerId: "other", modelId: "large", requestCount: 1, promptTokens: 200, completionTokens: 15, cacheReadTokens: 0, cacheReadReportedRequestCount: 1 }
  ] });
  assert.deepEqual(twoModels, { totalTokens: 325, cachePercent: null, cacheLabel: "多模型缓存明细" });

  const missing = projectAiSessionUsageDisplay({ requestCount: 1, promptTokens: 10, completionTokens: 2, cacheReadTokens: null, models: [
    { providerId: "deepseek", modelId: "flash", requestCount: 1, promptTokens: 10, completionTokens: 2, cacheReadTokens: null, cacheReadReportedRequestCount: 0 }
  ] });
  assert.equal(missing.cachePercent, null);
  assert.equal(missing.cacheLabel, "缓存读数不完整");

  const partial = projectAiSessionUsageDisplay({ requestCount: 3, promptTokens: 400, completionTokens: 20, cacheReadTokens: null, models: [
    { providerId: "deepseek", modelId: "flash", requestCount: 3, promptTokens: 400, completionTokens: 20, cacheReadTokens: null, cacheReadReportedRequestCount: 2 }
  ] });
  assert.equal(partial.cachePercent, null);
  assert.equal(partial.cacheLabel, "缓存读数不完整");
});
