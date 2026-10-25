/**
 * 功能：进程级“服务正在退出”标记。
 * 作用：让模型循环在退出流程中停止派发新的模型请求/工具，而不取消已在执行的工具。
 * 关联文件：runs.ts（退出协调）、execute-turn.ts（派发前检查）、app-boot（退出入口）。
 */
let requested = false;

/** 宿主开始退出时调用；幂等。 */
export function requestShutdown(): void {
  requested = true;
}

/** 当前是否处于服务退出流程。 */
export function isShutdownRequested(): boolean {
  return requested;
}
