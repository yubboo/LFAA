/**
 * 功能：外部进程子代理的协议层——统一进程驱动的传输信封与结果分帧。
 * 作用：让 claude-code/codex 等 child_process 驱动共用一套"请求信封/结果分帧/错误归一"约定。
 * 关联文件：subagent-claude-code、subagent-codex、run-settlement.ts。
 * 移植自 DeepSeek Harness subagent/out-of-process（MIT License，commit 639ed01），按 LFAA child_process 适配。
 */
import { SubagentError } from "./error.js";
import type { SubagentRunResult, SubagentStopReason } from "./types.js";

/** 一次外部进程请求的信封。 */
export interface OutOfProcessRequest {
  readonly driver: string;
  readonly prompt: string;
  readonly timeoutMs: number;
}

/** 把外部进程的退出状态归一为统一结果原因。 */
export function classifyExit(exitCode: number | null, aborted: boolean): SubagentStopReason {
  if (aborted) return "aborted";
  if (exitCode === 0) return "completed";
  return "error";
}

/** 构造一个外部进程失败结果。 */
export function outOfProcessFailure(message: string, runId = ""): SubagentRunResult {
  return { runId, stopReason: "error", answer: "", diagnostic: message.slice(0, 4096) };
}

/** 断言外部进程驱动名合法（供驱动入口使用）。 */
export function assertOutOfProcessDriver(name: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/u.test(name)) {
    throw new SubagentError(`外部进程驱动名非法：${name}`, "out-of-process-failed");
  }
}
