/**
 * 移植自 deepseek-harness packages/spill/spill/src/index.ts（MIT, commit 639ed01）。
 * 溢出协议包：只定义 SpillStore 抽象与引用类型，不含具体存储实现。
 *
 * 文件：index.ts
 * 功能：重导出协议类型。
 * 作用：spill-local 实现它，spill-policy 与 agent-loop 依赖它。
 */
export type { SpillRef, SpillStore } from "./types.js";
export { formatSpillReference, MAX_SPILL_READ_CHARACTERS } from "./types.js";
