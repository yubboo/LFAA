/**
 * 移植自 deepseek-harness packages/core/agent-loop/src/constants.ts（MIT，commit 639ed01）。
 * LFAA 适配：保持与 LFAA execute-turn 现有语义一致，不引入 zod / session-projection 依赖。
 *
 * 文件：constants.ts
 * 功能：agent 调度器与上下文管理（compaction / spill）的可调默认值。
 * 作用：集中存放并行工具调用上限、每轮模型请求上限、上下文压力阈值，供 runtime-context 与 execute-turn 引用。
 * 不负责：真正触发压缩或溢出；阈值只是默认值，可由 settings / 配置覆盖。
 */

/** 单步内最多并行派发的工具调用数（对齐 DSH 8）。 */
export const MAX_PARALLEL_TOOL_CALLS = 8;

/** 单条 user/assistant/tool 消息内容字符数超过该值时，视为“重型消息”，参与 compaction/spill 候选。 */
export const HEAVY_MESSAGE_CHARS = 8_000;

/**
 * 上下文压力阈值：当已用 token 估算达到 contextWindow 的该比例时，触发自动 compaction。
 * 0.80 = 窗口用满 80% 即开始压缩（对齐 DSH basic 引擎默认）。
 */
export const COMPACTION_PRESSURE_RATIO = 0.8;

/** 触发 spill 的更高压比例：达到窗口该比例时，除压缩外还应考虑把超大工具结果卸载到外部存储。 */
export const SPILL_PRESSURE_RATIO = 0.9;

/** 压缩后保留的尾部消息数（对齐 DSH preserveRecentTurns 默认）。 */
export const COMPACTION_PRESERVE_RECENT_TURNS = 8;

/** 估算 contextWindow 缺失时的兜底窗口（token）。 */
export const FALLBACK_CONTEXT_WINDOW_TOKENS = 128_000;
