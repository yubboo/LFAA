/**
 * 功能：退出状态标记解析。
 * 作用：从终端输出文本中剥离 [exit code: N] / [shell killed by signal: X] 标记，交给界面退出药丸渲染。
 * 关联文件：tool-shell（结果渲染）。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-shell/render。
 */
import type { ShellRunResult } from "./types.js";

/** 带可选退出码或信号的终端结果头部。 */
export interface TerminalExitStatus {
  exitCode?: number;
  signal?: string;
}

/** 剥离退出标记后的终端渲染片段。 */
export interface TerminalExitRender extends TerminalExitStatus {
  output: string;
}

const EXIT_MARKER = /\[exit code: (-?\d+)\]$/;
const SIGNAL_MARKER = /\[shell killed by signal: ([A-Z0-9]+)\]$/;

/** 命令完成时把退出码追加为输出尾部标记。 */
export function exitStatusForRender(result: ShellRunResult): string {
  if (result.signal !== null) return `[shell killed by signal: ${result.signal}]`;
  if (result.exitCode === null) return "";
  return `[exit code: ${result.exitCode}]`;
}

/**
 * 在渲染输入文本末尾查找退出标记。解析成功则把它从输出体剥离并返回退出药丸字段；
 * 未匹配则原样返回输出且不附退出字段。仅作用于末尾标记，以免误匹配命令回显。
 */
export function parseExitStatus(text: string): TerminalExitRender {
  const signal = SIGNAL_MARKER.exec(text);
  if (signal !== null) return { output: text.slice(0, signal.index).trimEnd(), signal: signal[1] };
  const exit = EXIT_MARKER.exec(text);
  if (exit !== null) return { output: text.slice(0, exit.index).trimEnd(), exitCode: Number(exit[1]) };
  return { output: text };
}
