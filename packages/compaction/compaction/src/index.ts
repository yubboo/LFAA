/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction。
 *
 * 文件：index.ts
 * 功能：压缩协议包的根入口——导出压缩契约类型、事务标识、检查点、工具对配对工具、
 *       区间不变量校验。本包只定义契约与纯函数，不含具体摘要策略，也不直接发模型请求。
 *
 * 作用：compaction-basic / image-offload / tool-result-pruner / command-compact
 *       以及 agent-loop 的 ContextManagerHooks 共用这些类型与工具。
 *
 * LFAA 适配：DSH 协议基于事件 surface（SessionSeq + SurfaceManager）；LFAA 直接在
 * AiCompletionMessage[] 上操作，因此把 DSH 的 Surface/事件日志概念退化为"消息下标区间"。
 * 各子模块保留 DSH 同构划分：brand / checkpoint / tool-pairing / invariant。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";

// ---- 协议契约（保留第一轮导出，agent-loop 的 ContextManagerHooks 与 command-compact 依赖） ----
export type { CompactionTrigger, CompactionResult, CompactionEngine } from "./types.js";

// ---- 事务标识（brand.ts，DSH Branded -> LFAA string；同名类型+函数合并导出） ----
export { CompactionId } from "./brand.js";

// ---- 检查点（checkpoint.ts，消息内容信封版） ----
export type { CompactionCheckpointSource } from "./checkpoint.js";
export {
  compactCheckpointSource,
  createCheckpointUserMessage,
  detectCheckpointSource,
  isCompactCheckpointSource,
} from "./checkpoint.js";

// ---- 工具对配对边界（tool-pairing.ts，含第一轮已有的 align 工具） ----
export {
  hasOpenToolCalls,
  alignCompactionEnd,
  alignCompactionStart,
  openToolCallsBefore,
  openToolCallsAfter,
  toolPairingBalancedBefore,
  toolPairingBalancedAfter,
} from "./tool-pairing.js";

// ---- 区间不变量（invariant.ts，纯函数版 precommit 断言） ----
export type { CompactionRangeCheck, CompactionInvariantCode } from "./invariant.js";
export { CompactionInvariantError, assertCompactableRange, assertSummaryIsSmaller } from "./invariant.js";

// 重新导出 AiCompletionMessage 类型，方便下游从一个入口拿全压缩相关类型。
export type { AiCompletionMessage };
