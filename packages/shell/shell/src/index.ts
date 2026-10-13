/**
 * 功能：shell 执行协议包（中立接缝 + 本地 child_process 引擎）。
 * 作用：导出 ShellExecutor 接口、执行句柄类型、退出状态渲染、本地进程引擎，以及把方言 executor 注册到 ctx.shell 的助手。
 * 说明：本包本身不提供 Cordis 运行服务——它与 lfaa-subprocess 同为「接缝库」；真正的 ctx.shell 由 pwsh-local 等方言包提供。
 * 关联文件：types.ts、local-process.ts、render.ts；调用方 tool-shell；方言 pwsh-local/bash-local。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { ShellExecutor } from "./types.js";

export * from "./types.js";
export * from "./render.js";
export { spawnLocalProcess, type LocalProcessLaunch } from "./local-process.js";

/** 前台命令默认墙钟上限（毫秒）。 */
export const DEFAULT_TIMEOUT_MS = 120_000;
/** 前台命令超时上限（毫秒），超出即截断到该值。 */
export const MAX_TIMEOUT_MS = 600_000;
/** stdout 尾部默认保留字节数。 */
export const DEFAULT_STDOUT_MAX_BYTES = 128 * 1024;

/**
 * 把一个方言 executor 注册到上下文。默认提供为 ctx.shell；bash 等平行 executor 可传入独立服务名（如 "shellBash"）以避免互踩。
 * @param ctx        插件上下文（结构化为 provide 形状即可）。
 * @param executor   方言执行器实例。
 * @param serviceName 目标 Cordis 服务名，默认 "shell"。
 */
export function registerShellExecutor(
  ctx: { provide(name: string, service: ShellExecutor): unknown },
  executor: ShellExecutor,
  serviceName = "shell",
): void {
  ctx.provide(serviceName, executor);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 主本地 shell（Windows 上即 pwsh-local）。 */
    shell: ShellExecutor;
    /** 平行 bash executor（Windows 上可能为降级实现）。 */
    shellBash: ShellExecutor;
    /** 沙箱化 shell（受限执行）。 */
    sandboxedShell: ShellExecutor;
  }
}

export const name = "lfaa-shell";

/** 接缝库插件：无运行时副作用；方言包通过 registerShellExecutor 注册真正的执行器。 */
export function apply(_ctx: Context): void {
  // 类型与引擎导出；服务由方言包提供。
}
