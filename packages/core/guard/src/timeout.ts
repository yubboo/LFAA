// 命令超时策略：把工具参数里的 timeoutMs 收敛到安全区间，避免过短误杀或过长拖死单轮任务。
import { MAX_COMMAND_TIMEOUT_MS } from "@lfaa/shell";

/** 前台命令允许覆盖的最小时限。 */
export const MIN_COMMAND_TIMEOUT_MS = 5_000;

/** 归一化命令时限；非数字返回 undefined，交给执行器使用默认值。 */
export function normalizeCommandTimeout(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(MAX_COMMAND_TIMEOUT_MS, Math.max(MIN_COMMAND_TIMEOUT_MS, Math.floor(value)));
}
