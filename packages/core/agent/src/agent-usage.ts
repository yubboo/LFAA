// 运行用量与性能统计：累计 token/缓存命中、模型与工具耗时，并组装上下文构成与成本。
import { resolveReportedContextWindow, type LlmGenerateOutput, type LlmProfile, type LlmUsage } from "@lfaa/llm";
import { computeTokenCost, type TokenPricing } from "@lfaa/metrics";
import type { AgentRunCost, AgentRunMetrics } from "@lfaa/memory";
import type { RunExecutionParams } from "./run-types";

interface ContextSnapshot {
  systemTokens: number;
  toolsTokens: number;
  messageTokens: number;
}

export class RunUsageTracker {
  private readonly usage: LlmUsage = {};
  private hasUsage = false;
  private latestPromptTokens: number | undefined;
  private readonly cacheMeasurement = { promptTokens: 0, cachedTokens: 0 };
  private readonly perf = { llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0 };
  private contextSnapshot: ContextSnapshot = { systemTokens: 0, toolsTokens: 0, messageTokens: 0 };
  lastModel: string | undefined;

  constructor(
    private readonly params: RunExecutionParams,
    private readonly activeProfile: LlmProfile | null,
    private readonly tokenPricing: TokenPricing | undefined,
  ) {}

  /** 记录本轮实际发送的上下文构成，估算口径与 DSH token-meter 对齐。 */
  setContextSnapshot(snapshot: ContextSnapshot): void {
    this.contextSnapshot = snapshot;
  }

  /** 累加模型轮次耗时与首 token 延迟；解码吞吐只按首 token 之后的时间计算。 */
  addModelRound(input: { startedAt: number; firstTokenAt: number | undefined; endedAt: number; completionTokens: number }): void {
    this.perf.llmMs += input.endedAt - input.startedAt;
    if (input.firstTokenAt === undefined) return;
    this.perf.ttftMs += input.firstTokenAt - input.startedAt;
    this.perf.ttftSteps += 1;
    this.perf.decodeMs += input.endedAt - input.firstTokenAt;
    this.perf.decodeTokens += input.completionTokens;
  }

  addToolMs(ms: number): void {
    this.perf.toolMs += ms;
  }

  /** 汇总每轮供应商返回的用量，运行结束后随消息持久化，供界面与成本核算使用。 */
  addUsage({ usage: roundUsage, model }: LlmGenerateOutput): void {
    this.lastModel = model;
    this.latestPromptTokens = roundUsage?.promptTokens;
    if (!roundUsage) return;
    this.hasUsage = true;
    const total = roundUsage.totalTokens ?? (roundUsage.promptTokens !== undefined && roundUsage.completionTokens !== undefined
      ? roundUsage.promptTokens + roundUsage.completionTokens : undefined);
    for (const key of ["promptTokens", "completionTokens", "totalTokens", "cachedPromptTokens"] as const) {
      const value = key === "totalTokens" ? total : roundUsage[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) this.usage[key] = (this.usage[key] ?? 0) + value;
    }
    if (roundUsage.promptTokens !== undefined && roundUsage.cachedPromptTokens !== undefined
      && Number.isSafeInteger(roundUsage.promptTokens) && Number.isSafeInteger(roundUsage.cachedPromptTokens)
      && roundUsage.cachedPromptTokens >= 0 && roundUsage.cachedPromptTokens <= roundUsage.promptTokens) {
      this.cacheMeasurement.promptTokens += roundUsage.promptTokens;
      this.cacheMeasurement.cachedTokens += roundUsage.cachedPromptTokens;
    }
  }

  buildMetrics(): AgentRunMetrics {
    const window = this.activeProfile && this.lastModel ? resolveReportedContextWindow(this.activeProfile, this.lastModel) : undefined;
    return {
      ...this.perf,
      context: this.contextSnapshot,
      ...(this.lastModel ? { contextModel: this.lastModel } : {}),
      ...(this.latestPromptTokens !== undefined ? { contextPromptTokens: this.latestPromptTokens } : {}),
      ...(window ? { contextWindowTokens: window.tokens, contextWindowSource: window.source } : {}),
      ...(this.cacheMeasurement.promptTokens > 0 ? { cacheMeasurement: { ...this.cacheMeasurement } } : {}),
    };
  }

  cost(): AgentRunCost | undefined {
    return computeTokenCost(this.usage, this.tokenPricing);
  }

  get hasAnyUsage(): boolean {
    return this.hasUsage;
  }

  get usageSnapshot(): LlmUsage | undefined {
    return this.hasUsage ? this.usage : undefined;
  }

  /** 每轮模型/工具结束后推送累计用量，浏览器统计栏随之实时变化。 */
  emitUsage(): void {
    if (!this.hasUsage) return;
    const cost = this.cost();
    this.params.emit({
      type: "run_usage",
      runId: this.params.runId,
      tokenUsage: { ...this.usage },
      metrics: this.buildMetrics(),
      ...(cost ? { cost } : {}),
    });
  }
}