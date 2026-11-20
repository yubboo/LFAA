// 会话统计聚合：从已持久化的消息记录计算轮次、工具步数、模型/工具耗时、首 token、吞吐、上下文与成本。

/** 与 Host 默认上下文压缩预算保持一致，仅在没有模型窗口配置时作为兜底口径。 */
export const SESSION_CONTEXT_BUDGET_CHARS = 160_000;

export interface SessionContext {
  totalTokens: number;
  model?: string;
  windowSource?: "configured" | "provider-spec";
  windowTokens?: number;
  percent?: number;
}

export interface SessionCost {
  amount: number;
  currency: "CNY";
  input: number;
  cachedInput: number;
  output: number;
}

export interface SessionMetrics {
  turns: number;
  steps: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens: number;
  cacheMeasurement?: { promptTokens: number; cachedTokens: number };
  llmMs: number;
  toolMs: number;
  ttftMs: number;
  ttftSteps: number;
  decodeMs: number;
  decodeTokens: number;
  tokensPerSecond?: number;
  cacheHitRate?: number;
  context?: SessionContext;
  cost?: SessionCost;
}

/** 统计只依赖这些字段，Host 会话记录与浏览器消息模型都可直接传入。 */
export interface SessionMessage {
  role: "user" | "assistant";
  status?: string;
  steps?: ReadonlyArray<{ phase: string }>;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cachedPromptTokens?: number;
  };
  metrics?: {
    llmMs: number;
    toolMs: number;
    ttftMs: number;
    ttftSteps: number;
    decodeMs: number;
    decodeTokens: number;
    context: { systemTokens: number; toolsTokens: number; messageTokens: number };
    contextWindowTokens?: number;
    contextPromptTokens?: number;
    contextModel?: string;
    contextWindowSource?: "configured" | "provider-spec";
    cacheMeasurement?: { promptTokens: number; cachedTokens: number };
  };
  cost?: SessionCost;
  runDurationMs?: number;
}

function usageTotal(usage: NonNullable<SessionMessage["tokenUsage"]>): number {
  return usage.totalTokens ?? ((usage.promptTokens ?? 0) + (usage.completionTokens ?? 0));
}

/** 从消息记录计算会话级指标；缺失字段保持零值或缺省，由界面决定是否展示。 */
export function computeSessionMetrics(
  messages: ReadonlyArray<SessionMessage>,
): SessionMetrics {
  let turns = 0;
  let steps = 0;
  let totalTokens = 0;
  let promptTokens = 0;
  let cachedPromptTokens = 0;
  let completionTokens = 0;
  let llmMs = 0;
  let toolMs = 0;
  let ttftMs = 0;
  let ttftSteps = 0;
  let decodeMs = 0;
  let decodeTokens = 0;
  let durationMs = 0;
  let latestContext: SessionContext | undefined;
  let observedPrompt = 0;
  let observedCache = 0;
  let cost: SessionCost | undefined;

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    // 运行中的消息也计入 token/上下文/成本与步数，轮次只在完成后计数，统计栏才能实时变化。
    const streaming = message.status === "streaming";
    if (!streaming) turns += 1;
    steps += (message.steps ?? []).filter((step) => step.phase === "act").length;
    const usage = message.tokenUsage;
    if (usage) {
      totalTokens += usageTotal(usage);
      promptTokens += usage.promptTokens ?? 0;
      completionTokens += usage.completionTokens ?? 0;
      cachedPromptTokens += usage.cachedPromptTokens ?? 0;
    }
    if (message.runDurationMs && message.runDurationMs > 0) durationMs += message.runDurationMs;
    const runCost = message.cost;
    if (runCost) {
      cost ??= { amount: 0, currency: "CNY", input: 0, cachedInput: 0, output: 0 };
      cost.amount += runCost.amount;
      cost.input += runCost.input;
      cost.cachedInput += runCost.cachedInput;
      cost.output += runCost.output;
    }
    const metrics = message.metrics;
    latestContext = undefined;
    if (!metrics) continue;
    llmMs += metrics.llmMs;
    toolMs += metrics.toolMs;
    ttftMs += metrics.ttftMs;
    ttftSteps += metrics.ttftSteps;
    decodeMs += metrics.decodeMs;
    decodeTokens += metrics.decodeTokens;
    const measured = metrics.cacheMeasurement;
    if (measured && measured.promptTokens > 0 && measured.cachedTokens >= 0 && measured.cachedTokens <= measured.promptTokens) {
      observedPrompt += measured.promptTokens;
      observedCache += measured.cachedTokens;
    }
    const used = metrics.contextPromptTokens;
    if (typeof used === "number" && Number.isFinite(used) && used >= 0) {
      const window = metrics.contextWindowTokens;
      latestContext = {
        totalTokens: used,
        ...(metrics.contextModel ? { model: metrics.contextModel } : {}),
        ...(window && window > 0 && metrics.contextWindowSource
          ? { windowTokens: window, windowSource: metrics.contextWindowSource, percent: (used / window) * 100 } : {}),
      };
    }
  }

  return {
    turns,
    steps,
    totalTokens,
    promptTokens,
    completionTokens,
    cachedPromptTokens,
    llmMs,
    toolMs,
    ttftMs,
    ttftSteps,
    decodeMs,
    decodeTokens,
    // 有真实解码耗时时优先用它计算吞吐；旧消息退化为整轮时长估算。
    ...(decodeMs > 0 && decodeTokens > 0
      ? { tokensPerSecond: decodeTokens / (decodeMs / 1000) }
      : durationMs > 0 && completionTokens > 0
        ? { tokensPerSecond: completionTokens / (durationMs / 1000) }
        : {}),
    ...(observedPrompt > 0
      ? { cacheHitRate: observedCache / observedPrompt, cacheMeasurement: { promptTokens: observedPrompt, cachedTokens: observedCache } }
      : {}),
    ...(latestContext ? { context: latestContext } : {}),
    ...(cost ? { cost } : {}),
  };
}

/** 把 token 数压缩成 1.2k / 114.0M 形式。 */
export function formatCompactTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** 人民币成本格式：≥1 元两位小数，小额依次保留 3–4 位。 */
export function formatCost(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "¥0";
  if (amount >= 1) return `¥${amount.toFixed(2)}`;
  if (amount >= 0.01) return `¥${amount.toFixed(3)}`;
  return `¥${amount.toFixed(4)}`;
}

/** 把毫秒时长格式化为“34 分 13 秒 / 1.7 秒”。 */
export function formatDurationMs(ms: number, isZh: boolean): string {
  if (!Number.isFinite(ms) || ms <= 0) return isZh ? "0 秒" : "0s";
  if (ms < 1_000) return isZh ? "<1 秒" : "<1s";
  const totalSeconds = ms / 1_000;
  if (totalSeconds < 60) {
    return isZh ? `${totalSeconds.toFixed(1)} 秒` : `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return isZh ? `${minutes} 分 ${seconds} 秒` : `${minutes}m ${seconds}s`;
}
