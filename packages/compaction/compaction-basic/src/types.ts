/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction-basic。
 *
 * 文件：types.ts
 * 功能：基础压缩后端的配置、区间选择结果等公共类型。
 *
 * LFAA 适配说明：DSH 的配置模型围绕"每个 provider/model 一份策略 + token-meter 预算"展开，
 * 依赖 dsh-llm 的 LlmCallConfig 与 dsh-token-meter。LFAA 没有 per-model token-meter，
 * 配置退化为包内扁平形状（触发比例、保留轮数、摘要输出上限），接入点说明见 config.ts。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

/**
 * 基础压缩插件配置（cordis 插件 config 形状）。
 * 所有字段可选；缺省值见 config.ts 的 resolveBasicCompactionConfig。
 */
export interface BasicCompactionConfig {
  /**
   * 压力触发比例：已用 token / contextWindow 达到该比例时自动压缩。
   * 取值 (0, 1]，默认 0.8。
   */
  thresholdRatio?: number;
  /**
   * 保留尾部最近多少个 user 回合（及其之后全部消息）不参与压缩。
   * 非负整数，默认 8。
   */
  preserveRecentTurns?: number;
  /**
   * 摘要模型一次允许输出的最大 token（传给 streamAiCompletion 的 maxOutputTokens）。
   * 正整数，默认 1024。
   */
  summaryMaxTokens?: number;
  /**
   * 摘要正文硬截断字符数（防模型失控刷长文）。正整数，默认 4096。
   */
  summaryMaxChars?: number;
  /**
   * 是否注册自动压力压缩（pressure 触发）。默认 true。
   * 设为 false 时只响应用户手动 /compact。
   */
  auto?: boolean;
}

/** 解析并冻结后的不可变配置。 */
export interface ResolvedBasicCompactionConfig {
  readonly thresholdRatio: number;
  readonly preserveRecentTurns: number;
  readonly summaryMaxTokens: number;
  readonly summaryMaxChars: number;
  readonly auto: boolean;
}

/** 一次区间选择结果（半开 [start, end) 下标区间）。 */
export interface SelectedRange {
  readonly start: number;
  readonly end: number;
}

/**
 * 一次压缩请求（与 lfaa-compaction 的 CompactionEngine.compactIfNeeded 入参对齐）。
 * 这里只做类型导出，真正的契约在 lfaa-compaction/types.ts。
 */
export interface CompactionRequest {
  messages: AiCompletionMessage[];
  contextWindow: number;
  signal?: AbortSignal;
}
