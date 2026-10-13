/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 会话修复：崩溃或 fork 在开放工具调用之后结束时，合成 fail-closed 的结果闭合记录，
 * 避免下次请求引用悬空的 tool_call_id。实现权威在 kernel.ts（repairOpenTail）；本模块按 DSH 形态重导出。
 *
 * 文件：repair.ts
 * 功能：repairOpenTail 包装。
 */
import type { SessionKernel } from "./kernel.js";

/**
 * 修复内核尾部开放的回合/工具调用。返回新增的闭合事件。
 * @param session 目标内核。
 * @param cause 中断原因：interrupted（进程中断）或 forked（分支边界）。
 */
export function repairOpenTail(session: SessionKernel, cause: "interrupted" | "forked") {
  return session.repairOpenTail(cause);
}
