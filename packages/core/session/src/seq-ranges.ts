/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 序列区间压缩：把一批严格递增的序号编码成“单值或闭区间”的紧凑 JSON，便于持久化/传输。
 * 实现权威在 kernel.ts；本模块按 DSH 形态重导出。
 *
 * 文件：seq-ranges.ts
 * 功能：encodeSessionSeqRanges / decodeSessionSeqRanges。
 */
export { encodeSessionSeqRanges, decodeSessionSeqRanges } from "./kernel.js";
export type { EncodedSessionSeq } from "./kernel.js";
