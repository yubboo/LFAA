import type { AiMessageUsage, AiSessionUsageSummary } from "lfaa-client-connection/src/api.js";

export interface AiSessionUsageDisplay {
  totalTokens: number | null;
  cachePercent: number | null;
  cacheLabel: string;
}

/** Produces display values only from the durable Provider usage projection. */
export function projectAiSessionUsageDisplay(summary: AiSessionUsageSummary): AiSessionUsageDisplay {
  const totalTokens = summary.promptTokens === null || summary.completionTokens === null
    ? null
    : summary.promptTokens + summary.completionTokens;
  if (!summary.models.length) return { totalTokens, cachePercent: null, cacheLabel: "缓存命中未知" };

  // 缓存布局与汇总是系统级能力；多模型会话使用同一组累计计数，不因路由变化隐藏此前的命中。
  if (summary.promptTokens !== null && summary.cacheReadTokens !== null) {
    if (summary.cacheReadTokens > summary.promptTokens) return { totalTokens, cachePercent: null, cacheLabel: "缓存计数与输入量不一致" };
    if (summary.promptTokens === 0) return { totalTokens, cachePercent: summary.cacheReadTokens === 0 ? 0 : null, cacheLabel: summary.cacheReadTokens === 0 ? "缓存命中 0.0%" : "缓存计数与输入量不一致" };
    const cachePercent = summary.cacheReadTokens / summary.promptTokens * 100;
    return { totalTokens, cachePercent, cacheLabel: `缓存命中 ${cachePercent.toFixed(1)}%` };
  }

  // 有请求缺少缓存字段时，仍展示已经确认的读取量；只对完整覆盖的会话计算命中率。
  let reportedTokens = 0;
  let hasReportedTokens = false;
  for (const model of summary.models) {
    const knownTokens = model.cacheReadTokens ?? model.cacheReadReportedTokens;
    if (knownTokens !== null && knownTokens !== undefined && Number.isSafeInteger(knownTokens) && knownTokens >= 0) {
      reportedTokens += knownTokens;
      hasReportedTokens = true;
    }
  }
  if (!hasReportedTokens) return { totalTokens, cachePercent: null, cacheLabel: summary.promptTokens === null ? "输入用量未知，无法计算命中率" : "缓存读数不完整" };

  const exactRequestCounts = summary.requestCountExact !== false && summary.models.every(model => model.requestCountExact !== false);
  const exactCoverage = exactRequestCounts && summary.models.every(model => model.cacheReadReportedRequestCount !== null && model.cacheReadReportedRequestCount !== undefined);
  const coverage = exactCoverage
    ? `${summary.models.reduce((sum, model) => sum + (model.cacheReadReportedRequestCount ?? 0), 0).toLocaleString("zh-CN")}/${summary.models.reduce((sum, model) => sum + model.requestCount, 0).toLocaleString("zh-CN")} 次模型请求已统计`
    : "缓存统计覆盖数未知";
  return { totalTokens, cachePercent: null, cacheLabel: `缓存读取 ${reportedTokens.toLocaleString("zh-CN")} tokens · ${coverage}` };
}

export function formatAiSessionUsageEmptyLabel(input: { busy: boolean; usageLoadState: "loading" | "ready" | "error"; hasAssistantMessage: boolean }): string {
  if (input.busy) return "正在获取会话用量…";
  if (input.usageLoadState === "loading") return "正在读取会话用量…";
  if (input.usageLoadState === "error") return "会话用量读取失败";
  return input.hasAssistantMessage ? "当前会话暂无可用用量记录" : "发送消息后显示用量";
}

/** Formats only Provider-reported usage; missing fields stay unknown. */
export function formatAiUsageFooterLabel(usage: AiMessageUsage | null | undefined, busy: boolean, hasAssistantMessage: boolean): string {
  if (!usage) {
    if (busy) return "正在获取本轮 Provider 用量…";
    return hasAssistantMessage ? "本轮 Provider 未返回用量" : "缓存读数会在 Provider 返回用量后显示";
  }

  const cacheLabel = usage.cacheReadTokens === null
    ? "Provider 未返回缓存读取计数"
    : usage.promptTokens === null || usage.promptTokens === 0
      ? `缓存命中 ${usage.cacheReadTokens.toLocaleString("zh-CN")} tokens · 总输入量未提供`
      : usage.cacheReadTokens > usage.promptTokens
        ? "缓存用量与总输入量不一致"
        : `缓存命中 ${((usage.cacheReadTokens / usage.promptTokens) * 100).toFixed(1)}% · ${usage.cacheReadTokens.toLocaleString("zh-CN")} tokens`;

  return `本轮 ${usage.promptTokens === null ? "输入量未提供" : `${usage.promptTokens.toLocaleString("zh-CN")} 输入`} · ${usage.completionTokens === null ? "输出量未提供" : `${usage.completionTokens.toLocaleString("zh-CN")} 输出`} · ${cacheLabel} · ${usage.providerId} / ${usage.modelId}`;
}
