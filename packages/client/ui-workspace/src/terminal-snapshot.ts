/**
 * 功能：比较终端展示快照。
 * 作用：相同任务/输出保留状态身份，真实输出与取消变化仍立即呈现。
 * 关联文件：TaskTerminal.tsx、client-performance.test.mjs。
 */
import type { AiHostTask } from "lfaa-client-connection/src/api.js";

/** 同值读取保留对象身份，避免两秒一次重新装配选择器和大段终端正文。 */
export function sameTerminalTask(left: AiHostTask | null, right: AiHostTask | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.id === right.id && left.nodeId === right.nodeId && left.shell === right.shell
    && left.workingDirectory === right.workingDirectory && left.status === right.status
    && left.message === right.message && left.createdAt === right.createdAt && left.cancelRequested === right.cancelRequested
    && left.result?.stdout === right.result?.stdout && left.result?.stderr === right.result?.stderr
    && left.result?.exitCode === right.result?.exitCode && left.result?.timedOut === right.result?.timedOut
    && left.result?.outputTruncated === right.result?.outputTruncated && Boolean(left.result) === Boolean(right.result);
}

