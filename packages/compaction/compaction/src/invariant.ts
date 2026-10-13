/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction。
 *
 * 文件：invariant.ts
 * 功能：压缩区间合法性 + 摘要替换语义的不变量校验。
 *
 * LFAA 适配说明：DSH 的 invariant 是一个 Cordis 伴生插件，挂在 session/event 流上做
 * precommit 断言（依赖 dsh-invariants 注册器、SurfaceManager、事件流回放）。LFAA
 * 没有 invariants 服务，也没有事件 surface 流——压缩直接在 AiCompletionMessage[] 上
 * 同步进行。这里把同一组规则做成纯函数，由 compaction-basic 在"准备提交"前主动调用：
 * 先校验再替换，等价于 DSH 的 precommit staging。校验失败时抛 CompactionInvariantError，
 * 引擎捕获后放弃本次压缩（不打断主循环）。
 *
 * 两条核心不变量（对齐 DSH invariant.ts 与 region.ts）：
 *   1. 区间合法性：[start, end) 不越界、非空、起点切分闭合、终点切分闭合、区间内自闭合；
 *   2. 摘要替换语义：新摘要必须真的比它替换掉的原段短（负收益压缩宁可不动）。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";
import {
  openToolCallsBefore,
  toolPairingBalancedAfter,
  toolPairingBalancedBefore,
} from "./tool-pairing.js";

/** 一次"准备提交"的压缩区间描述。 */
export interface CompactionRangeCheck {
  messages: readonly AiCompletionMessage[];
  /** 区间起点（inclusive，消息下标）。 */
  start: number;
  /** 区间终点（exclusive，即 [start, end) 半开）。 */
  end: number;
}

/** 不变量失败的错误码（调用方可据此区分日志类别）。 */
export type CompactionInvariantCode =
  | "range-out-of-bounds"
  | "range-empty"
  | "start-splits-tool-pair"
  | "end-splits-tool-pair"
  | "range-has-open-tool-call"
  | "summary-empty"
  | "summary-not-smaller";

/** 不变量校验失败：带结构化错误码的 Error。 */
export class CompactionInvariantError extends Error {
  override readonly name = "CompactionInvariantError";

  constructor(
    message: string,
    public readonly code: CompactionInvariantCode,
  ) {
    super(message);
  }
}

/**
 * 校验一个待压缩区间是否合法。任何一条不满足都抛 CompactionInvariantError。
 *
 * 规则对应 DSH invariant.ts 的 validateShadowedSeqs + region.ts 的 validateSurfaceRegion：
 * - 边界是合法整数下标；
 * - 区间非空（end > start）；
 * - 起点切分 tool-pairing 闭合（不切开"调用-结果"对）；
 * - 终点切分 tool-pairing 闭合（段尾不留未闭合 tool_call）；
 * - 区间内部 tool 对自闭合（从 start 到 end，未闭合计数净变化为 0）。
 */
export function assertCompactableRange(check: CompactionRangeCheck): void {
  const { messages, start, end } = check;
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new CompactionInvariantError(
      `压缩区间边界必须是整数下标，收到 start=${start} end=${end}`,
      "range-out-of-bounds",
    );
  }
  if (start < 0 || end > messages.length) {
    throw new CompactionInvariantError(
      `压缩区间 [${start}, ${end}) 越界（消息总数 ${messages.length}）`,
      "range-out-of-bounds",
    );
  }
  if (end <= start) {
    throw new CompactionInvariantError(
      `压缩区间为空：end=${end} 不大于 start=${start}`,
      "range-empty",
    );
  }
  if (!toolPairingBalancedBefore(messages, start)) {
    throw new CompactionInvariantError(
      `压缩起点 ${start} 切开了一个未闭合的 tool_call/tool 结果对`,
      "start-splits-tool-pair",
    );
  }
  if (!toolPairingBalancedAfter(messages, end - 1)) {
    throw new CompactionInvariantError(
      `压缩终点 ${end} 切开了一个未闭合的 tool_call/tool 结果对`,
      "end-splits-tool-pair",
    );
  }
  // 区间内部净变化：从 start 走到 end，未闭合计数必须回到 0（不能摘半对）。
  const openInside = openToolCallsBefore(messages, end) - openToolCallsBefore(messages, start);
  if (openInside !== 0) {
    throw new CompactionInvariantError(
      `压缩区间 [${start}, ${end}) 内部残留 ${openInside} 个未闭合 tool_call（不能摘半对）`,
      "range-has-open-tool-call",
    );
  }
}

/**
 * 校验"摘要替换语义"：新摘要必须比它替换掉的原段短，否则压缩是负收益，应当拒绝提交。
 *
 * 对应 DSH region.ts 里 `framedSummaryTokenCount >= shadowedRouteTokenCount` 检查。
 * LFAA 没有 token-meter，这里用字符数粗估（与 estimateMessagesTokens 同一把尺子），
 * 目的一致：保证压缩后下一次请求真的更短。
 */
export function assertSummaryIsSmaller(input: {
  /** 原区间消息拼接后的总字符数（喂给摘要器的 rangeText 长度即可）。 */
  originalCharCount: number;
  /** 新产出的摘要正文。 */
  summaryText: string;
}): void {
  const trimmed = input.summaryText.trim();
  if (trimmed.length === 0) {
    throw new CompactionInvariantError("摘要为空，拒绝替换原段", "summary-empty");
  }
  if (trimmed.length >= input.originalCharCount) {
    throw new CompactionInvariantError(
      `摘要（${trimmed.length} 字符）不短于原段（${input.originalCharCount} 字符），压缩无收益`,
      "summary-not-smaller",
    );
  }
}
