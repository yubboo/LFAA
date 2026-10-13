/**
 * 功能：为 AI Work Shell 活动生成有界的用户可读命令预览。
 * 作用：只显示本机/目标节点命令文本，不暴露 Shell 输出，并遮蔽常见凭据格式。
 * 关联文件：execute-turn.ts 写入现有活动说明；apps/cli/tests/agent-runtime.test.mjs 覆盖脱敏和长度上限。
 */
const MAX_SHELL_COMMAND_PREVIEW_LENGTH = 4_000;
const TRUNCATION_SUFFIX = "\n…（命令已截断）";

export function sanitizeShellCommandActivityPreview(command: string): string {
  const safeCommand = command.replace(/\r\n?/gu, "\n")
    .replace(/(https?:\/\/[^/\s:@]+:)[^@/\s]+@/giu, "$1[已隐藏]@")
    .replace(/(^|\s)(-u|--user)(?:\s+|=)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, "$1$2 [已隐藏]")
    .replace(/(\b[A-Za-z0-9_./-]*(?:password|passwd|passphrase|pwd|token|secret|credential|client[_-]?secret|refresh[_-]?token|private[_-]?key|signing[_-]?key|api[_-]?key|access[_-]?key|authorization|cookie)[A-Za-z0-9_./-]*\b\s*(?:[:=]\s*|\s+))(?:(?:bearer|basic)\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, "$1[已隐藏]")
    .replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/-]+=*/giu, "$1 [已隐藏]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}|(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16}))\b/giu, "[已隐藏凭据]");
  if (safeCommand.length <= MAX_SHELL_COMMAND_PREVIEW_LENGTH) return safeCommand;
  const clippedLength = MAX_SHELL_COMMAND_PREVIEW_LENGTH - TRUNCATION_SUFFIX.length;
  let clipped = safeCommand.slice(0, clippedLength);
  if (/[\uD800-\uDBFF]$/u.test(clipped)) clipped = clipped.slice(0, -1);
  return `${clipped}${TRUNCATION_SUFFIX}`;
}

export function appendShellCommandActivityPreview(toolId: string, command: string, detail: string): string {
  const label = toolId === "local.execute-command"
    ? "本机 PowerShell 命令预览"
    : toolId === "host.execute-command" ? "目标节点 Shell 命令预览" : "";
  if (!label) return detail;
  return `${detail}\n${label}：\n${sanitizeShellCommandActivityPreview(command)}`;
}
