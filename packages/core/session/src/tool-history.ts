/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 工具历史：记录一次会话中工具 schema 的基表与逐次 messageId 增量声明，用于按历史重放工具定义。
 * 实现权威在 kernel.ts（resolvedToolHistory/toolHistory）；本模块按 DSH 形态重导出类型与便捷读取。
 *
 * 文件：tool-history.ts
 * 功能：SessionToolHistory 类型与从内核读取已解析工具历史。
 */
import type { SessionKernel } from "./kernel.js";
export type { SessionToolHistory, SessionToolSchema } from "./kernel.js";

/** 读取某内核当前已解析的工具历史。 */
export function resolvedToolHistoryOf(session: SessionKernel): import("./kernel.js").SessionToolHistory {
  return session.resolvedToolHistory;
}
