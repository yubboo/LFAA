/**
 * 文件：session-summary.ts
 * 功能：在受限会话页投影中汇总 Provider 用量和最近一次模型上下文。
 * 作用：只保存可展示的数字和模型分组，不复制会话正文或请求 Schema。
 * 关联文件：repository.ts、persistence.ts。
 */

export interface SessionUsageModelSummary {
  providerId: string;
  modelId: string;
  requestCount: number;
  requestCountExact: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  cacheReadReportedTokens: number | null;
  /** Number of model requests whose Provider usage contained an exact cache-read counter. */
  cacheReadReportedRequestCount: number | null;
}

export interface SessionUsageSummary {
  requestCount: number;
  requestCountExact: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  models: SessionUsageModelSummary[];
}

export interface SessionContextUsage {
  providerId: string;
  modelId: string;
  contextWindow: number | null;
  contextWindowSource: "model-catalog" | "settings-fallback" | "unknown";
  promptTokens: number | null;
  estimatedPromptTokens: number;
  systemTokens: number;
  toolsTokens: number;
  messageTokens: number;
  includesImages: boolean;
}

type UsageTotals = {
  requestCount: number;
  legacyRequestRecordCount: number;
  promptTokens: number;
  promptCount: number;
  completionTokens: number;
  completionCount: number;
  cacheReadTokens: number;
  cacheReadCount: number;
  cacheReadReportedTokens: number;
  cacheReadReportedRequestCount: number;
};

export interface SessionSummaryAccumulator {
  models: Map<string, UsageTotals & { providerId: string; modelId: string }>;
  contextUsage: SessionContextUsage | null;
  contextRunId: string | null;
  contextSeq: number;
}

const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

export function createSessionSummaryAccumulator(): SessionSummaryAccumulator {
  return { models: new Map(), contextUsage: null, contextRunId: null, contextSeq: -1 };
}

function adjustUsage(accumulator: SessionSummaryAccumulator, data: Record<string, unknown>, direction: 1 | -1): void {
  const providerId = typeof data.providerId === "string" ? data.providerId : "";
  const modelId = typeof data.modelId === "string" ? data.modelId : "";
  if (!providerId || !modelId) return;
  const key = JSON.stringify([providerId, modelId]);
  let totals = accumulator.models.get(key);
  if (!totals && direction === 1) {
    totals = { providerId, modelId, requestCount: 0, legacyRequestRecordCount: 0, promptTokens: 0, promptCount: 0, completionTokens: 0, completionCount: 0, cacheReadTokens: 0, cacheReadCount: 0, cacheReadReportedTokens: 0, cacheReadReportedRequestCount: 0 };
    accumulator.models.set(key, totals);
  }
  if (!totals) return;
  const requestCountIsExact = count(data.requestCount) && data.requestCount > 0;
  const requestCount = requestCountIsExact ? Number(data.requestCount) : 1;
  totals.requestCount += direction * requestCount;
  if (!requestCountIsExact) totals.legacyRequestRecordCount += direction;
  if (count(data.promptTokens)) { totals.promptTokens += direction * data.promptTokens; totals.promptCount += direction * requestCount; }
  if (count(data.completionTokens)) { totals.completionTokens += direction * data.completionTokens; totals.completionCount += direction * requestCount; }
  if (count(data.cacheReadTokens)) { totals.cacheReadTokens += direction * data.cacheReadTokens; totals.cacheReadCount += direction * requestCount; }
  const partialCacheTokens = count(data.cacheReadReportedTokens) ? data.cacheReadReportedTokens : count(data.cacheReadTokens) ? data.cacheReadTokens : 0;
  totals.cacheReadReportedTokens += direction * partialCacheTokens;
  const reportedRequestCount = count(data.cacheReadReportedRequestCount)
    ? Math.min(data.cacheReadReportedRequestCount, requestCount)
    : count(data.cacheReadTokens) && requestCountIsExact ? requestCount : 0;
  totals.cacheReadReportedRequestCount += direction * reportedRequestCount;
  if (totals.requestCount <= 0) accumulator.models.delete(key);
}

function complete(values: UsageTotals[], field: "prompt" | "completion" | "cacheRead"): number | null {
  if (values.length === 0) return 0;
  const expected = values.reduce((sum, value) => sum + value.requestCount, 0);
  const reported = values.reduce((sum, value) => sum + (field === "prompt" ? value.promptCount : field === "completion" ? value.completionCount : value.cacheReadCount), 0);
  if (expected !== reported) return null;
  return values.reduce((sum, value) => sum + (field === "prompt" ? value.promptTokens : field === "completion" ? value.completionTokens : value.cacheReadTokens), 0);
}

export function projectSessionUsage(accumulator: SessionSummaryAccumulator): SessionUsageSummary {
  const values = [...accumulator.models.values()];
  const models = values
    .map(({ providerId, modelId, requestCount, legacyRequestRecordCount, promptTokens, promptCount, completionTokens, completionCount, cacheReadTokens, cacheReadCount, cacheReadReportedTokens, cacheReadReportedRequestCount }) => ({
      providerId, modelId, requestCount, requestCountExact: legacyRequestRecordCount === 0,
      promptTokens: requestCount === promptCount ? promptTokens : null,
      completionTokens: requestCount === completionCount ? completionTokens : null,
      cacheReadTokens: requestCount === cacheReadCount ? cacheReadTokens : null,
      cacheReadReportedTokens: legacyRequestRecordCount === 0 ? cacheReadReportedTokens : null,
      cacheReadReportedRequestCount: legacyRequestRecordCount === 0 ? cacheReadReportedRequestCount : null
    }))
    .sort((left, right) => left.providerId.localeCompare(right.providerId) || left.modelId.localeCompare(right.modelId));
  return {
    requestCount: values.reduce((sum, value) => sum + value.requestCount, 0),
    requestCountExact: values.every(value => value.legacyRequestRecordCount === 0),
    promptTokens: complete(values, "prompt"),
    completionTokens: complete(values, "completion"),
    cacheReadTokens: complete(values, "cacheRead"),
    models
  };
}

function contextUsage(value: unknown): SessionContextUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.providerId !== "string" || typeof row.modelId !== "string"
    || !(row.contextWindow === null || count(row.contextWindow) && row.contextWindow > 0)
    || !(row.contextWindowSource === "model-catalog" || row.contextWindowSource === "settings-fallback" || row.contextWindowSource === "unknown")
    || !(row.promptTokens === null || count(row.promptTokens))
    || !count(row.estimatedPromptTokens) || !count(row.systemTokens) || !count(row.toolsTokens) || !count(row.messageTokens)
    || typeof row.includesImages !== "boolean") return null;
  return {
    providerId: row.providerId, modelId: row.modelId,
    contextWindow: row.contextWindow as number | null,
    contextWindowSource: row.contextWindowSource,
    promptTokens: row.promptTokens as number | null,
    estimatedPromptTokens: Number(row.estimatedPromptTokens),
    systemTokens: Number(row.systemTokens), toolsTokens: Number(row.toolsTokens), messageTokens: Number(row.messageTokens),
    includesImages: row.includesImages
  };
}

export function applySessionSummaryEvent(accumulator: SessionSummaryAccumulator, event: Record<string, unknown>, direction: 1 | -1 = 1): void {
  const data = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const row = data as Record<string, unknown>;
  if (event.type === "usage/record") {
    adjustUsage(accumulator, row, direction);
  } else if (direction === 1 && event.type === "request/context" && Number.isSafeInteger(event.seq) && Number(event.seq) >= accumulator.contextSeq) {
    accumulator.contextUsage = contextUsage(row.contextUsage);
    accumulator.contextRunId = typeof row.runId === "string" ? row.runId : null;
    accumulator.contextSeq = Number(event.seq);
  } else if (direction === 1 && event.type === "assistant/response" && row.runId === accumulator.contextRunId) {
    const usage = row.usage;
    if (usage && typeof usage === "object" && !Array.isArray(usage) && accumulator.contextUsage) {
      const promptTokens = (usage as Record<string, unknown>).promptTokens;
      if (promptTokens === null || count(promptTokens)) accumulator.contextUsage = { ...accumulator.contextUsage, promptTokens };
    }
  }
}

