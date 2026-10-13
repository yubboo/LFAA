/**
 * 移植参考：DeepSeek Harness dsh-token-meter（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：usage.ts
 * 功能：跨轮次的 token 用量累计与完整性判定。
 * 作用：把每次 AiCompletionUsage（promptTokens/completionTokens，可空）累加为会话/任务总用量，
 *   并标记最后一次是否拿到了完整 provider 用量。
 * 适配说明：LFAA usage 仅 prompt/completion 两桶（可空），不区分缓存读写。
 */
import type { AiCompletionUsage } from "lfaa-llm/src/completion.js";

/** 累计用量快照。 */
export interface UsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** 累计了多少次完整用量记录。 */
  completedCalls: number;
  /** 最后一次是否两个桶都非空。 */
  lastUsageComplete: boolean;
}

/** 跨多次调用累计用量的累加器。 */
export class UsageAccumulator {
  private prompt = 0;
  private completion = 0;
  private completedCalls = 0;
  private lastComplete = false;

  /**
   * 记录一次调用的用量（空值跳过，不计入完整性）。
   * @param usage provider 上报的用量。
   */
  record(usage: AiCompletionUsage | null | undefined): void {
    if (!usage) return;
    const prompt = usage.promptTokens;
    const completion = usage.completionTokens;
    const complete = typeof prompt === "number" && typeof completion === "number";
    this.lastComplete = complete;
    if (typeof prompt === "number") this.prompt += prompt;
    if (typeof completion === "number") this.completion += completion;
    if (complete) this.completedCalls += 1;
  }

  /** 当前累计快照（新建对象，外部可安全持有）。 */
  summary(): UsageSummary {
    return {
      promptTokens: this.prompt,
      completionTokens: this.completion,
      totalTokens: this.prompt + this.completion,
      completedCalls: this.completedCalls,
      lastUsageComplete: this.lastComplete
    };
  }
}
