// 统一的安全 Git 调用：固定超时、禁用交互，并在检出类命令上禁用钩子、fsmonitor 与仓库自定义过滤器。
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BUFFER = 4 * 1024 * 1024;

export interface GitResult {
  stdout: string;
  stderr: string;
}

export interface GitOptions {
  timeoutMs?: number;
}

/** 组合加固参数：钩子指向空设备、关闭 fsmonitor、清空仓库声明的 filter 驱动。 */
export function hardenedGitArgs(args: string[], filterKeys: readonly string[] = []): string[] {
  return [
    "-c", "core.hooksPath=/dev/null",
    "-c", "core.fsmonitor=false",
    "-c", "advice.detachedHead=false",
    ...filterKeys.flatMap((key) => ["-c", `${key}=`]),
    ...args,
  ];
}

/** 在指定目录执行 git；非零退出交给调用方处理。 */
export async function runGit(cwd: string, args: string[], options: GitOptions = {}): Promise<GitResult> {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
  return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
}

/** 枚举仓库里配置过的 filter 驱动键，创建前逐个清空，避免检出时执行自定义命令。 */
export async function listFilterConfigKeys(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await runGit(cwd, [
      "config",
      "--get-regexp",
      "^filter\\..*\\.(smudge|clean|process)$",
    ]);
    return stdout
      .split(/\r?\n/u)
      .map((line) => line.split(" ")[0]?.trim() ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 把 Git 或系统错误压成一行可读文案，避免把整段堆栈塞给用户。 */
export function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().split(/\r?\n/u)[0]?.trim() || "未知错误";
}