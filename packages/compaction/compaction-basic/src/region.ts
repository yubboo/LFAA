/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction-basic。
 *
 * 文件：region.ts
 * 功能：压缩区间选择 + 区间替换。按"保留尾部最近 N 轮 user 对话"从当前消息数组里
 *       切出 [start, end)，并对齐 tool_calls/tool_result 边界；再提供把选定区间
 *       整体替换为一条摘要消息的纯函数。
 *
 * LFAA 适配说明：DSH 的 region.ts 还负责 compaction/start/summary/end 事件事务、
 * 表面代际稳定性检查、token-meter 定价——这些依赖 LFAA 没有的事件流与 token-meter。
 * 这里只保留"选区间 + 替换"两个纯函数；事务性与不变量由 lfaa-compaction 的
 * invariant.ts / checkpoint.ts 提供，引擎在 index.ts 里串起来。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";
import {
  alignCompactionEnd,
  alignCompactionStart,
} from "lfaa-compaction/src/tool-pairing.js";
import type { SelectedRange } from "./types.js";

/**
 * 在消息数组中选出可压缩区间。
 *
 * 规则（对齐 DSH selectCompactableRange）：
 *   - 消息总数太少（<6）不压；
 *   - 跳过开头 system 消息（系统提示不参与压缩）；
 *   - 从尾部往前数 preserveRecentTurns 个 user 消息，它们及其之后全部保留；
 *   - 起点对齐 tool 对闭合（落在 tool 消息上则回退到配对 assistant 之前）；
 *   - 终点对齐 tool 对闭合（悬空 tool_call 随 assistant 一起移出压缩段）；
 *   - 切出来的区间至少 2 条消息才有意义。
 *
 * @returns 半开 [start, end) 区间；无可压缩内容时返回 null。
 */
export function selectCompactableRange(
  messages: readonly AiCompletionMessage[],
  preserveRecentTurns: number,
): SelectedRange | null {
  const total = messages.length;
  if (total < 6) return null;

  // 找到尾部保留边界：从末尾往前数 preserveRecentTurns 个 user 消息，它们及之后全保留。
  let userSeen = 0;
  let retainFrom = total;
  for (let i = total - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      userSeen += 1;
      if (userSeen > preserveRecentTurns) {
        retainFrom = i + 1;
        break;
      }
    }
  }
  if (userSeen <= preserveRecentTurns) {
    // 单个长任务也可能产生大量工具往返；保留最近工具批次及当前用户目标。
    let lastUser = -1;
    for (let i = total - 1; i >= 0; i--) if (messages[i]!.role === "user") { lastUser = i; break; }
    if (lastUser < 0 || total - lastUser < 10) return null;
    const boundary = alignCompactionEnd(messages, total - 4);
    const begin = alignCompactionStart(messages, lastUser + 1);
    return boundary - begin >= 4 ? { start: begin, end: boundary } : null;
  }

  // 压缩段从第一条非 system 消息开始（system 是系统提示，不能压掉）。
  let start = 0;
  while (start < retainFrom && messages[start]!.role === "system") start += 1;
  if (start >= retainFrom) return null;

  start = alignCompactionStart(messages, start);
  const end = alignCompactionEnd(messages, retainFrom);
  if (end - start < 2) return null;
  return { start, end };
}

/**
 * 把选定区间整体替换为一条摘要 user 消息，返回新数组。不修改入参。
 *
 * @param messages - 当前完整消息数组。
 * @param range - 选定的半开区间。
 * @param summaryMessage - 替换用的摘要 user 消息（由 checkpoint.createCheckpointUserMessage 构造）。
 */
export function replaceRangeWithSummary(
  messages: readonly AiCompletionMessage[],
  range: SelectedRange,
  summaryMessage: AiCompletionMessage,
): AiCompletionMessage[] {
  return [
    ...messages.slice(0, range.start),
    summaryMessage,
    ...messages.slice(range.end),
  ];
}
