/** 给客户端错误边界提供可显示的摘要；不读取堆栈或任意对象内容。 */
export function getClientRenderErrorSummary(error: unknown): string {
  const name = error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,39}$/u.test(error.name)
    ? error.name
    : "Error";
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === "string" ? error : "未知客户端异常";
  const message = rawMessage
    .replace(/\b(token|password|passwd|secret|authorization|cookie|api[_-]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, "$1$2[已隐藏]")
    .replace(/https?:\/\/[^\s<>"']+/giu, "[链接]")
    .replace(/\b[A-Za-z]:\\[^\s<>"']+/gu, "[本机路径]")
    .replace(/\\\\[^\s<>"']+/gu, "[本机路径]")
    .replace(/[\r\n\t]+/gu, " ")
    .trim();
  const boundedMessage = message.length > 240 ? `${message.slice(0, 237)}...` : message || "未知客户端异常";
  return `${name}: ${boundedMessage}`;
}
