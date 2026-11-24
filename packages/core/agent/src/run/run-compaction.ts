// 运行期压缩入口：优先使用挂载的压缩服务，未挂载时回落到 @lfaa/context 的内置实现。
import { compactConversation } from "@lfaa/context";
import type { LlmMessage } from "@lfaa/llm";
import type { CompactionHook } from "./run-types";

type Compacted = { messages: LlmMessage[]; compacted: boolean; truncatedResults: number; droppedMessages: number };

/** 按依赖选择压缩实现；两处调用（常规压缩与超限强制压缩）共用同一入口。 */
export function compactForRun(
  compaction: CompactionHook | undefined,
  messages: ReadonlyArray<LlmMessage>,
  options: { budgetChars: number; toolCapChars?: number; keepRecentRounds?: number; sessionId?: string },
): Compacted {
  return compaction?.compact(messages, options) ?? compactConversation(messages, options);
}