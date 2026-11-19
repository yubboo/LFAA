// 裁剪终端输出快照：步骤轨迹只保留尾部有限行数与字符，避免长日志把会话文件撑到兆字节级。

/** 单个命令步骤保留的尾部行数。 */
export const COMMAND_TRACE_MAX_LINES = 200;
/** 单个命令步骤保留的最大字符数（按 Unicode 码元计）。 */
export const COMMAND_TRACE_MAX_CHARS = 8_000;

/** 取命令输出的尾部快照；发生裁剪时以省略号标明前文已丢弃。 */
export function tailCommandOutput(output: string): string {
  if (!output) return output;
  const lines = output.split(/\r?\n/u);
  const truncatedLines = lines.length > COMMAND_TRACE_MAX_LINES;
  const lineTail = truncatedLines ? lines.slice(-COMMAND_TRACE_MAX_LINES).join("\n") : output;
  const truncatedChars = lineTail.length > COMMAND_TRACE_MAX_CHARS;
  const text = truncatedChars ? lineTail.slice(lineTail.length - COMMAND_TRACE_MAX_CHARS) : lineTail;
  return truncatedLines || truncatedChars ? `…${text}` : text;
}
