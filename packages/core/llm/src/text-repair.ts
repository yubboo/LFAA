// 修复被错误按 GBK 解码后保存的 UTF-8 文本（典型「千问」→「鍗冮棶」双重编码乱码）。
// 只处理能完整往返的字符串：GBK 编码回字节后必须是合法 UTF-8，否则原样返回。
import { TextDecoder } from "node:util";

/** GBK 反查表：字符 → 两个字节；懒构建一次。 */
let gbkReverse: Map<string, [number, number]> | null = null;

function encodeGbk(text: string): number[] | null {
  if (!gbkReverse) {
    gbkReverse = new Map();
    const decoder = new TextDecoder("gbk");
    for (let hi = 0x81; hi <= 0xfe; hi += 1) {
      for (let lo = 0x40; lo <= 0xfe; lo += 1) {
        const ch = decoder.decode(Uint8Array.from([hi, lo]));
        if (ch.length === 1 && !ch.includes("\uFFFD")) gbkReverse.set(ch, [hi, lo]);
      }
    }
  }
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
      continue;
    }
    const pair = gbkReverse.get(ch);
    if (!pair) return null;
    bytes.push(pair[0], pair[1]);
  }
  return bytes;
}

/**
 * 典型乱码字符范围：UTF-8 中文被按 GBK 解码后通常落在 U+9000–U+9FFF 生僻区。
 * 正常中文名极少使用该区字符，命中才尝试还原，降低误改风险。
 */
const MOJIBAKE_HINT = /[\u9000-\u9FFF]/u;

/** 尝试把 GBK 乱码还原成 UTF-8 原文；无法安全还原时返回原字符串。 */
export function repairMojibakeText(input: string): string {
  const value = input.trim();
  if (!value || !MOJIBAKE_HINT.test(value)) return input;
  const bytes = encodeGbk(value);
  if (!bytes) return input;
  try {
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    // 还原结果不能含替换字符，且必须比原文更像正常文本（CJK/ASCII）。
    if (repaired.includes("\uFFFD") || repaired === input) return input;
    return /^[\x20-\x7E\u3000-\u9FFF\uFF00-\uFFEF]*$/u.test(repaired) ? repaired : input;
  } catch {
    return input;
  }
}