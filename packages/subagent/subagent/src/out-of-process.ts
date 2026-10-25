/**
 * 功能：外部进程子代理的协议层——统一进程驱动的传输信封与结果分帧。
 * 作用：让 claude-code/codex 等 child_process 驱动共用一套"请求信封/结果分帧/错误归一"约定。
 * 关联文件：subagent-claude-code、subagent-codex、run-settlement.ts。
 * 移植自 DeepSeek Harness subagent/out-of-process（MIT License，commit 639ed01），按 LFAA child_process 适配。
 */
import { SubagentError } from "./error.js";
import type { SubagentRunResult, SubagentStopReason } from "./types.js";
import type { KillTreeResult } from "lfaa-win32-process";

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

export interface ExternalChildProcess {
  readonly pid?: number | undefined;
  readonly exitCode: number | null;
  kill(): boolean;
}

/** 将外部 CLI 取消交给唯一进程树 Owner；Owner 失败时才退回停止直接子进程。 */
export async function terminateExternalChildTree(
  child: ExternalChildProcess,
  terminateProcessTree?: (pid: number) => Promise<KillTreeResult>
): Promise<KillTreeResult> {
  if (child.exitCode !== null) return { stopped: true, detail: "外部子进程已经退出。" };
  if (!child.pid || !terminateProcessTree) {
    child.kill();
    return { stopped: false, detail: "进程树 Owner 或有效 PID 不可用；已尝试停止直接子进程。" };
  }
  try {
    const result = await terminateProcessTree(child.pid);
    if (!result.stopped && child.exitCode === null) child.kill();
    return result;
  } catch {
    if (child.exitCode === null) child.kill();
    return { stopped: false, detail: "进程树 Owner 失败；已尝试停止直接子进程。" };
  }
}

/** 绑定取消并等待树终止完成；同时处理信号先于监听器注册到达的竞态。 */
export function bindExternalChildCancellation(
  child: ExternalChildProcess,
  signal: AbortSignal,
  terminateProcessTree?: (pid: number) => Promise<KillTreeResult>
): { wait(): Promise<KillTreeResult | null>; dispose(): void } {
  let termination: Promise<KillTreeResult> | null = null;
  const terminate = (): void => {
    termination ??= terminateExternalChildTree(child, terminateProcessTree);
  };
  if (signal.aborted) terminate();
  else signal.addEventListener("abort", terminate, { once: true });
  return {
    wait: async () => termination,
    dispose: () => signal.removeEventListener("abort", terminate)
  };
}
