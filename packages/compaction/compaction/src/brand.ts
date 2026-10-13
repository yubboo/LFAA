/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction。
 *
 * 文件：brand.ts
 * 功能：压缩事务标识（CompactionId）的名义类型与铸造函数。
 *
 * LFAA 适配说明：DSH 用 @deepseek-ai/dsh-brand 的 Branded<'CompactionId'> 名义类型，
 * 在编译期把"压缩事务 id"和普通字符串区分开。LFAA 没有 dsh-brand 包，这里退化为
 * 普通 string——名义类型只起编译期提示作用，运行时完全一致；调用方仍应保证 id 唯一
 * （推荐 node:crypto 的 randomUUID()）。
 */

/** 一次压缩 start/summary/checkpoint/end 事务共享的稳定标识。 */
export type CompactionId = string;

/**
 * 铸造一个压缩事务标识。不做格式校验，调用方自己保证全局唯一。
 * （DSH 同名函数返回 Branded<'CompactionId'>；此处直接返回 string。）
 *
 * @param id - 调用方生成的不透明事务 id（建议 uuid）。
 * @returns 同一字符串，类型标记为 CompactionId。
 */
export function CompactionId(id: string): CompactionId {
  return id;
}
