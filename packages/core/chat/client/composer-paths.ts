// 输入区绝对路径识别：把粘贴或输入的本机绝对路径（Windows 盘符 / UNC / POSIX）识别成文件上下文。
// 纯函数，浏览器与测试共用。

/** 单行绝对路径：Windows 盘符、UNC 共享路径、POSIX 路径（排除 http(s) 等协议）。 */
const WINDOWS_PATH_RE = /^(?:[A-Za-z]:[\\/]|\\\\)[^\n\r\t]{1,480}$/u;
const POSIX_PATH_RE = /^\/(?!\/)[^\n\r\t]{1,480}$/u;

/** 去掉包裹路径的引号与首尾空白。 */
export function normalizePathCandidate(raw: string): string {
  const value = raw.trim().replace(/^["'`“”‘’]+|["'`“”‘’]+$/gu, "").trim();
  return value;
}

/** 判断整段文本是否就是一个绝对路径。 */
export function matchAbsolutePath(raw: string): string | undefined {
  const value = normalizePathCandidate(raw);
  if (!value) return undefined;
  if (/^(?:https?|mailto|data|file):/iu.test(value)) return undefined;
  return WINDOWS_PATH_RE.test(value) || POSIX_PATH_RE.test(value) ? value : undefined;
}

/** 从一段文字里提取所有绝对路径（用于发送时补充文件上下文）。 */
export function extractAbsolutePaths(raw: string): string[] {
  const found = new Set<string>();
  const re = /(?:[A-Za-z]:[\\/]|\\\\)[^\s"'`<>|*?\n\r\t]{1,480}|\/(?:[^\s"'`<>|*?\n\r\t]+\/)*[^\s"'`<>|*?\n\r\t]{1,480}/gu;
  for (const match of raw.matchAll(re)) {
    const path = matchAbsolutePath(match[0]);
    if (path && path.length > 2) found.add(path);
  }
  return [...found].slice(0, 8);
}