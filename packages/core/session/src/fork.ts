/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 会话派生：以某条事件序号为边界，复制其 inclusive 前缀构造一个独立分支。
 * 实现权威在 kernel.ts（SessionKernel.fork / SessionStore.fork）；本模块按 DSH 形态提供便捷包装。
 *
 * 文件：fork.ts
 * 功能：forkSession 在源会话上切出一个分支。
 */
import type { SessionKernel } from "./kernel.js";
export { SessionForkError } from "./kernel.js";

/**
 * 在源会话上切出一个新分支。源事件保持不变，分支序号从 1 重新连续编号。
 * @param source 源内核。
 * @param sourceSeq 继承的 inclusive 边界序号。
 * @param forkId 分支 id；缺省自动生成。
 */
export function forkSession(source: SessionKernel, sourceSeq: number, forkId?: string): SessionKernel {
  // kernel.fork 的 forkId 默认是随机 UUID（品牌类型）；调用方可省略或显式传合法 id。
  return source.fork(sourceSeq, forkId as Parameters<typeof source.fork>[1]);
}
