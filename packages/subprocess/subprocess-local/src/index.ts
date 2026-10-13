/**
 * 功能：本机受管子进程运行时插件入口。
 * 作用：创建 LocalSubprocessRuntime 并通过协议包 registerSubprocessProvider 登记为 lfaaSubprocess 服务。
 * 关联文件：src/spawn.ts（spawn 实现）、packages/subprocess/subprocess/src/index.ts（接口与登记函数）。
 */
import type { Context } from "@deepseek-ai/cordis";
import { registerSubprocessProvider } from "lfaa-subprocess";
import { LocalSubprocessRuntime } from "./spawn.js";

export const name = "lfaaSubprocessLocal";
export const inject = ["lfaaWin32Process"] as const;

/** 登记本机子进程服务；卸载时由 Cordis 回收。 */
export function apply(ctx: Context): void {
  registerSubprocessProvider(ctx, new LocalSubprocessRuntime());
}
