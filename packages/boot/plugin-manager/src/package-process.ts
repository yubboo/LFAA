/** 功能：在插件 Owner 内调用 Git/pnpm。作用：参数分离、收紧环境、限制时间与输出，不经 Shell 执行。 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";

export async function runPackageProcess(command: "git" | "pnpm", args: string[], cwd: string, maxBuffer = 4 * 1024 * 1024, signal?: AbortSignal): Promise<Buffer> {
  signal?.throwIfAborted();
  let executable: string = command;
  let arguments_ = args;
  if (command === "pnpm" && process.platform === "win32") {
    // Windows 的 .cmd 不经 Shell 不能启动；查找同一 PATH 安装的 JavaScript 入口，避免把输入拼入命令行。
    const roots = [dirname(process.execPath), ...(process.env.PATH ?? "").split(delimiter)];
    const entry = roots.flatMap(root => [resolve(root, "node_modules/pnpm/bin/pnpm.cjs"), resolve(root, "node_modules/corepack/dist/pnpm.js")]).find(existsSync);
    if (!entry) throw new Error("找不到 pnpm 的可执行入口，请在 Host 安装 pnpm。");
    executable = process.execPath;
    arguments_ = [entry, ...args];
  }
  const allowed = /^(?:path|systemroot|windir|comspec|home|userprofile|appdata|localappdata|temp|tmp|https?_proxy|no_proxy|lang|lc_all)$/iu;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.test(key)));
  env.GIT_TERMINAL_PROMPT = "0";
  return await new Promise<Buffer>((resolveResult, reject) => {
    execFile(executable, arguments_, { cwd, env, encoding: "buffer", windowsHide: true, timeout: 180_000, maxBuffer, signal }, (error, stdout, stderr) => {
      if (error) reject(signal?.aborted ? signal.reason : new Error(`${command} 执行失败：${stderr.toString("utf8").slice(-2000) || error.message}`));
      else resolveResult(stdout);
    });
  });
}
