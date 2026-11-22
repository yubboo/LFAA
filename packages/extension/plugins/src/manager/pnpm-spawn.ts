// pnpm 子进程调用：参数层拒绝 shell 元字符、Windows 下统一引用，并优先用 node 直接跑 pnpm 入口。
// 目的：安装来源来自浏览器输入，绝不能拼成字符串交给 cmd.exe 解释。
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

/** 安装来源里不允许出现的字符：引号/展开符/命令串联符在来源里没有正当用途。 */
const UNSAFE_SPEC_CHARACTERS = /["'`$%&|<>;\r\n\0]/u;

/** 交给 cmd.exe 也无法用引号中和的字符：双引号破坏引用、% 会展开、换行会截断命令。 */
const UNSAFE_CMDLINE_CHARACTERS = /["%\r\n\0]/u;

/** 参数会把 shell 元字符带进命令行时抛出；调用方不得吞掉。 */
export class UnsafePnpmArgumentError extends Error {
  constructor(readonly argument: string) {
    super(`拒绝把含 shell 元字符的参数交给 pnpm：${argument.slice(0, 80)}`);
    this.name = "UnsafePnpmArgumentError";
  }
}

/** 找出安装来源里第一个 shell 元字符，供解析层给出「不支持该来源」的明确错误。 */
export function findUnsafeSpecCharacter(spec: string): string | null {
  const match = UNSAFE_SPEC_CHARACTERS.exec(spec);
  return match ? match[0] : null;
}

/** 校验全部参数；发现无法安全传递的字符时直接拒绝，而不是尝试转义。 */
export function assertSafePnpmArguments(args: readonly string[]): void {
  for (const argument of args) {
    if (UNSAFE_CMDLINE_CHARACTERS.test(argument)) throw new UnsafePnpmArgumentError(argument);
  }
}

/** 引用单个 cmd.exe 参数：始终加引号，末尾反斜杠按 Windows 命令行解析规则加倍。 */
export function quoteWindowsArgument(argument: string): string {
  assertSafePnpmArguments([argument]);
  // CommandLineToArgvW 把「2n 个反斜杠 + 引号」解析为「n 个反斜杠 + 引号定界」，
  // 因此参数以反斜杠结尾时必须加倍，否则会把结尾引号吞掉。
  const escaped = argument.replace(/\\+$/u, (match) => `${match}${match}`);
  return `"${escaped}"`;
}

/** 构造 Windows 命令行：pnpm 与每个参数都被引用，`&`、`|`、`>` 等不会被 cmd 解释。 */
export function buildWindowsPnpmCommandLine(args: readonly string[]): string {
  return ["pnpm", ...args].map((argument) => quoteWindowsArgument(argument)).join(" ");
}

/** 解析 pnpm 的实际执行方式；参数可注入，便于单测覆盖各平台分支。 */
export function resolvePnpmSpawn(
  args: readonly string[],
  options: {
    platform?: NodeJS.Platform;
    npmExecPath?: string | undefined;
    comSpec?: string | undefined;
    nodePath?: string;
  } = {},
): { command: string; argv: string[] } {
  assertSafePnpmArguments(args);
  const platform = options.platform ?? process.platform;
  // 显式传 undefined 表示「按无 pnpm 入口的平台」处理，便于测试与降级路径。
  const npmExecPath = "npmExecPath" in options ? options.npmExecPath : process.env.npm_execpath;
  const nodePath = options.nodePath ?? process.execPath;
  // 由 pnpm（或 corepack）启动时能拿到 pnpm 自身的 JS 入口，直接用 node 执行，完全不经过 shell。
  if (npmExecPath && /\.(?:c?js|mjs)$/iu.test(npmExecPath) && existsSync(npmExecPath)) {
    return { command: nodePath, argv: [npmExecPath, ...args] };
  }
  if (platform === "win32") {
    const comSpec = options.comSpec || process.env.ComSpec || "cmd.exe";
    return { command: comSpec, argv: ["/d", "/s", "/c", buildWindowsPnpmCommandLine(args)] };
  }
  return { command: "pnpm", argv: [...args] };
}

/** 启动 pnpm 子进程；调用方负责读取输出并等待退出码。 */
export function spawnPnpm(args: readonly string[], cwd: string): ChildProcess {
  const { command, argv } = resolvePnpmSpawn(args);
  return spawn(command, argv, { cwd, stdio: ["ignore", "pipe", "pipe"] });
}