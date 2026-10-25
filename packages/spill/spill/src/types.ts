/**
 * 移植自 deepseek-harness packages/spill/spill/src/types.ts（MIT, commit 639ed01）。
 * 溢出协议：当单条工具结果大到不应整段塞进上下文时，把它写到外部存储（临时文件），
 * 在原位只留一个引用（SpillRef）。模型需要时可再通过读文件取回。
 *
 * 文件：types.ts
 * 功能：SpillRef、SpillStore 抽象接口、溢出结果类型。
 * 作用：spill-local（磁盘实现）与 spill-policy（何时溢出）共享。
 */

/** 一条被外置内容的引用。 */
export interface SpillRef {
  /** 存储后端标识（local-file / ...）。 */
  backend: string;
  /** 后端内的定位（文件路径 / key）。 */
  location: string;
  /** 原始内容字节数。 */
  sizeBytes: number;
  /** 写入时间。 */
  storedAt: string;
}

/** 溢出存储抽象。spill-local 提供本地文件实现。 */
export interface SpillStore {
  /** 把一段内容写出去，返回引用。 */
  spill(input: { sessionId: string; content: string }): Promise<SpillRef>;
  /** 按引用读回内容（模型需要时）。 */
  load(ref: SpillRef): Promise<string>;
  /** 有界按字符读取；本机 Store 通过稀疏 UTF-8 偏移索引流式回读，不把整份大结果载入内存。 */
  readRange?(ref: SpillRef, input: { offset: number; limit: number }): Promise<{ text: string; totalCharacters: number }>;
  /** 清理某会话的全部溢出内容。 */
  dropSession(sessionId: string): Promise<void>;
}

/** 任何单次模型回读最多 16,384 个 Unicode 字符，避免大上下文下单次回读失控。 */
export const MAX_SPILL_READ_CHARACTERS = 16_384;

/** 把 SpillRef 渲染成发给模型的占位文本。 */
export function formatSpillReference(ref: SpillRef): string {
  return JSON.stringify({
    spilled: true,
    note: "这一大段工具结果已被移出上下文并外置存储；如需原文，请调用 agent_context_read_spill 并使用 location ID 分段读取。",
    backend: ref.backend,
    location: ref.location,
    sizeBytes: ref.sizeBytes
  });
}
