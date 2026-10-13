/**
 * 功能：归档准入——判断一个已结束子任务是否应进入归档。
 * 作用：完整成功的一次性运行归档留痕；被取消/失败的也保留诊断，但区分归档级别。
 * 关联文件：run-settlement.ts、projection.ts。
 */
import type { SubagentRunResult } from "./types.js";

/** 归档决定。 */
export interface ArchiveAdmission {
  readonly admit: boolean;
  readonly level: "full" | "diagnostic-only" | "drop";
}

/** 根据终态结果决定归档准入。 */
export function admitToArchive(result: SubagentRunResult): ArchiveAdmission {
  if (result.stopReason === "completed") return { admit: true, level: "full" };
  // 失败/超时保留诊断但不归档完整正文；主动取消的一次性运行可直接丢弃。
  if (result.stopReason === "aborted" && result.diagnostic === undefined) return { admit: false, level: "drop" };
  return { admit: true, level: "diagnostic-only" };
}
