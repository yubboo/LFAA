// 统一限制单个工具结果进入模型上下文的字符数，避免一次读取或检索把运行上下文撑爆。
import { tailCommandOutput } from "../run/command-trace";

/** 只读类工具保留头部的字符上限；命令类工具保留尾部以便看到错误。 */
const HEAD_CAPS: Record<string, number> = {
  read_file: 16_000,
  grep: 12_000,
  glob: 12_000,
  search_files: 12_000,
  list_dir: 12_000,
  list_library_assets: 8_000,
  read_library_asset: 16_000,
  get_background_task: 8_000,
  list_background_tasks: 8_000,
  list_subagents: 8_000,
};
const COMMAND_CAP_CHARS = 8_000;
const DEFAULT_CAP_CHARS = 8_000;

/** 按工具类型截断结果，并明确告知模型内容被裁剪、如何续读。 */
export function limitToolResult(toolName: string, text: string): string {
  if (!text) return text;
  if (toolName === "run_command") {
    return text.length <= COMMAND_CAP_CHARS
      ? text
      : `…[前 ${text.length - COMMAND_CAP_CHARS} 字符已省略，仅保留末尾输出]\n${tailCommandOutput(text)}`;
  }
  const cap = HEAD_CAPS[toolName] ?? DEFAULT_CAP_CHARS;
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}\n…[已截断：共 ${text.length} 字符，仅显示前 ${cap} 字符。需要后续内容时请缩小范围或按行号续读]`;
}
