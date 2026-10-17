/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction-basic。
 *
 * 文件：index.ts
 * 功能：基础压缩引擎装配——把 config / region / summarizer 三个模块粘起来，
 *       对 agent-loop 暴露 createBasicCompactionEngine（保持第一轮导出兼容）。
 *
 * 作用：这是 agent-loop 上下文管理钩子的默认实现；保持 tool_calls/tool_result 成对，
 *       不切断调用对；压缩失败/取消时返回 null，不打断主循环。
 * 不负责：图像卸载或工具结果裁剪（那两个是独立策略包）；也不负责决定何时调用
 *       （由 runtime-context 按压力阈值触发，本引擎只在被调用时干活——不是写死流程）。
 */
import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import type { AiCompletionService } from "lfaa-llm/src/completion.js";
import { estimateMessagesTokens } from "lfaa-agent-loop/src/runtime-context.js";
import { FALLBACK_CONTEXT_WINDOW_TOKENS } from "lfaa-agent-loop/src/constants.js";
import {
  assertCompactableRange,
  assertSummaryIsSmaller,
  compactCheckpointSource,
  createCheckpointUserMessage,
  type CompactionEngine,
  type CompactionResult,
} from "lfaa-compaction/src/index.js";
import { resolveBasicCompactionConfig } from "./config.js";
import { replaceRangeWithSummary, selectCompactableRange } from "./region.js";
import {
  COMPACTION_SUMMARY_INSTRUCTION,
  frameSummary,
  rangeToText,
  summarizeRange,
  type SummarizerDeps,
} from "./summarizer.js";
import type { BasicCompactionConfig } from "./types.js";

// 对外再导出子模块类型与工具，方便下游按需从子路径 import。
export type {
  BasicCompactionConfig,
  ResolvedBasicCompactionConfig,
  SelectedRange,
} from "./types.js";
export {
  resolveBasicCompactionConfig,
  DEFAULT_THRESHOLD_RATIO,
  DEFAULT_PRESERVE_RECENT_TURNS,
} from "./config.js";
export { selectCompactableRange, replaceRangeWithSummary } from "./region.js";
export {
  COMPACTION_SUMMARY_INSTRUCTION,
  CHECKPOINT_PREAMBLE,
  frameSummary,
  rangeToText,
  summarizeRange,
} from "./summarizer.js";
export type { SummarizerDeps } from "./summarizer.js";

/**
 * 创建引擎所需依赖。账户/设置由 agent-loop 在每个 turn 注入（不同会话可能切账号），
 * config 是可选的插件级覆盖。
 */
export interface BasicCompactionDeps extends Partial<SummarizerDeps> {
  config?: BasicCompactionConfig;
  /** Protocol is injected by the LLM Owner so replacement adapters also serve summaries. */
  streamCompletion?: AiCompletionService["streamCompletion"];
  /** 正式 Agent Run 注入唯一请求器，摘要也计预算、用量和取消。 */
  summarize?: (text: string, instruction: string) => Promise<string>;
}

/**
 * 创建基础压缩引擎。引擎本身无状态；每次 compactIfNeeded 用当前消息数组现算。
 *
 * 流程（模型驱动，不是写死流水线）：
 *   1. 按当前消息数组估算 token；pressure 触发才看阈值，manual/spill 强制尝试；
 *   2. 选区间（保留尾部最近 N 轮），对齐 tool 对边界；
 *   3. 区间不变量校验（lfaa-compaction/invariant），不合法直接放弃；
 *   4. 把区间文本喂给摘要模型（streamAiCompletion）；
 *   5. 摘要替换语义校验（摘要必须比原段短），不满足则放弃；
 *   6. 用检查点 user 消息替换原区间，返回新数组与统计。
 * 任何一步失败/取消都返回 null，不抛错打断主循环。
 */
export function createBasicCompactionEngine(deps: BasicCompactionDeps): CompactionEngine {
  const config = resolveBasicCompactionConfig(deps.config);
  return {
    async compactIfNeeded(input): Promise<CompactionResult | null> {
      const window = input.contextWindow > 0 ? input.contextWindow : FALLBACK_CONTEXT_WINDOW_TOKENS;
      const used = estimateMessagesTokens(input.messages);
      const ratio = used / window;
      // 自动压力触发才看阈值；manual/spill-threshold 强制尝试。
      if (input.trigger.reason === "pressure" && ratio < config.thresholdRatio) return null;

      const range = selectCompactableRange(input.messages, config.preserveRecentTurns);
      if (range === null) return null;
      if (input.signal?.aborted) return null;

      // 区间不变量校验：越界/切 tool 对/区间内残留未闭合调用——任一不满足就放弃本次压缩。
      try {
        assertCompactableRange({ messages: input.messages, start: range.start, end: range.end });
      } catch {
        return null;
      }

      const rangeText = rangeToText(input.messages, range.start, range.end);
      if (!rangeText.trim()) return null;

      let summary: string;
      try {
        if (deps.summarize) summary = (await deps.summarize(rangeText, COMPACTION_SUMMARY_INSTRUCTION)).trim();
        else {
        if (!deps.account || !deps.applicationId || !deps.permissionMode || !deps.settings) throw new Error("摘要器未接入当前模型请求上下文。");
        if (!deps.streamCompletion) throw new Error("摘要器未注入当前 LLM Provider 服务。");
        summary = await summarizeRange(
          { account: deps.account, applicationId: deps.applicationId, permissionMode: deps.permissionMode, settings: deps.settings, streamCompletion: deps.streamCompletion },
          rangeText,
          input.signal,
          config.summaryMaxChars,
          config.summaryMaxTokens,
        );
        }
        if (summary.length > config.summaryMaxChars) return null;
      } catch {
        return null;
      }
      if (summary.length === 0 || input.signal?.aborted) return null;

      // 摘要替换语义校验：负收益压缩宁可不动。
      try {
        assertSummaryIsSmaller({ originalCharCount: rangeText.length, summaryText: summary });
      } catch {
        return null;
      }

      // 构造带事务 id 的检查点 user 消息，替换原区间。
      const source = compactCheckpointSource(randomUUID());
      const summaryMessage = createCheckpointUserMessage(frameSummary(summary), source);
      const messages = replaceRangeWithSummary(input.messages, range, summaryMessage);
      return {
        messages,
        compactedCount: range.end - range.start,
        estimatedTokensAfter: estimateMessagesTokens(messages),
        summary,
      };
    },
  };
}

/** Cordis 服务：提供基础压缩引擎工厂。真正的引擎按 turn 的 account/settings 现建。 */
export const name = "lfaaCompaction";
declare module "@deepseek-ai/cordis" {
  interface Context { lfaaCompaction: { createBasicCompactionEngine: typeof createBasicCompactionEngine } }
}
export const inject = [] as const;
export function apply(ctx: Context): void {
  ctx.provide(name, { createBasicCompactionEngine });
}
