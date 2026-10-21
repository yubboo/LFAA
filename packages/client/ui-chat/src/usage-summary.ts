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
  if (summary.models.length !== 1) return { totalTokens, cachePercent: null, cacheLabel: summary.models.length > 1 ? "多模型缓存明细" : "缓存命中未知" };
  const model = summary.models[0]!;
  if (model.cacheReadTokens === null) return { totalTokens, cachePercent: null, cacheLabel: "缓存读数不完整" };
  if (model.promptTokens === null) return { totalTokens, cachePercent: null, cacheLabel: "输入用量未知，无法计算命中率" };
  if (model.cacheReadTokens > model.promptTokens) return { totalTokens, cachePercent: null, cacheLabel: "缓存计数与输入量不一致" };
  if (model.promptTokens === 0) return { totalTokens, cachePercent: model.cacheReadTokens === 0 ? 0 : null, cacheLabel: model.cacheReadTokens === 0 ? "缓存命中 0.0%" : "缓存计数与输入量不一致" };
  const cachePercent = model.cacheReadTokens / model.promptTokens * 100;
  return { totalTokens, cachePercent, cacheLabel: `缓存命中 ${cachePercent.toFixed(1)}%` };
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
