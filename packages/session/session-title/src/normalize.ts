/**
 * 文件：normalize.ts
 * 功能：标题文本归一化与 UTF-8 安全截断（本地规则标题）。
 * 作用：清除终端控制序列与不可见字符，压成单行，并按字节预算截断，保证列表标题安全、一致。
 * 关联文件：index.ts、session-title-llm。
 * 移植自 DeepSeek Harness session-title/normalize（MIT，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 */

/** 操作系统命令转义序列（含未闭合尾部）。 */
const OSC_SEQUENCE = /(?:\u001B\]|\u009D)(?:(?!\u0007|\u001B\\)[\s\S])*(?:\u0007|\u001B\\|$)/gu;
/** 控制序列引入符（如 SGR 颜色码）。 */
const CSI_SEQUENCE = /(?:\u001B\[|\u009B)[0-?]*[ -/]*[@-~]/gu;
/** 其余两字节 ESC 控制序列。 */
const ESC_SEQUENCE = /\u001B[@-_]/gu;
/** 非空白 C0/C1 控制字符。 */
const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu;
/** 会让显示标题具有误导性的方向/不可见控制符。 */
const DIRECTIONAL_CONTROL = /[​‐‑‒―-⹕‐⁠-⁤⁦-⁩﻿]/gu;

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} 必须是正整数。`);
}

/** 清除控制符，产出一行 trimmed、空白归一的文本。 */
function cleanTitleText(input: string): string {
  return input
    .replace(OSC_SEQUENCE, "")
    .replace(CSI_SEQUENCE, "")
    .replace(ESC_SEQUENCE, "")
    .replace(CONTROL_CHARACTER, "")
    .replace(DIRECTIONAL_CONTROL, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** 按 UTF-8 字节预算截断，不拆 Unicode 码点。 */
export function truncateTitleUtf8(input: string, maxBytes: number): string {
  assertPositiveInteger("maxBytes", maxBytes);
  if (Buffer.byteLength(input, "utf8") <= maxBytes) return input;
  let used = 0;
  let output = "";
  for (const character of input) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (used + bytes > maxBytes) break;
    output += character;
    used += bytes;
  }
  return output;
}

/** 归一化一段标题文本并施加 UTF-8 字节预算（清洗后可能为空串）。 */
export function normalizeSessionTitle(input: string, maxBytes = 120): string {
  return truncateTitleUtf8(cleanTitleText(input), maxBytes).trimEnd();
}

/** 由首条用户输入推导确定性的本地标题（前 N 个词，字节受限）。 */
export function fallbackSessionTitle(input: string, maxWords = 12, maxBytes = 120): string {
  assertPositiveInteger("maxWords", maxWords);
  const words = cleanTitleText(input).split(" ").filter(Boolean).slice(0, maxWords);
  return truncateTitleUtf8(words.join(" "), maxBytes).trimEnd();
}
