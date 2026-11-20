// 命令级写入与危险操作分析：解析重定向与常见写入命令，并识别与模式无关的灾难性操作。
import { isAbsolute, relative, resolve } from "node:path";

/** 判定结果：允许，或给出拒绝原因与分类。 */
export type CommandVerdict =
  | { allowed: true }
  | { allowed: false; code: "dangerous-command" | "outside-workspace" | "unparsable"; reason: string };

/** 无论何种模式都拒绝的灾难性操作；宁可误报也不放过。 */
const DANGEROUS_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bformat\s+[a-z]:/iu, label: "格式化磁盘" },
  { pattern: /\bdiskpart\b/iu, label: "磁盘分区工具" },
  { pattern: /\bbcdedit\b/iu, label: "修改启动配置" },
  { pattern: /\bvssadmin\s+delete\b/iu, label: "删除卷影副本" },
  { pattern: /\bwbadmin\b/iu, label: "备份删除工具" },
  { pattern: /\bcipher\s+\/w/iu, label: "擦除空闲空间" },
  { pattern: /\bmkfs(\.\w+)?\b/iu, label: "创建文件系统" },
  { pattern: /\bdd\s+if=/iu, label: "裸设备写入" },
  { pattern: /\breg(\.exe)?\s+(add|delete)\b/iu, label: "修改注册表" },
  { pattern: /\btakeown\b/iu, label: "夺取文件所有权" },
  { pattern: /\bicacls\b[^\n]*\/(grant|deny|reset)/iu, label: "修改文件 ACL" },
  { pattern: /\b(net\s+user|net\s+localgroup)\b/iu, label: "修改系统账户" },
  { pattern: /\b(shutdown|Stop-Computer|Restart-Computer)\b/iu, label: "关机或重启" },
  { pattern: /\b(rm|Remove-Item)\b[^\n]*\s(-rf?|-Recurse)\b[^\n]*\s([a-z]:\\?|\/(\s|$))/iu, label: "递归删除磁盘根" },
  { pattern: /\b(rd|rmdir)\s+\/s\s+\/q\s+[a-z]:\\?\s*$/iu, label: "递归删除磁盘根" },
];

/** 把命令拆成可分析的片段：按管道与命令分隔符切开，保留重定向目标。 */
function splitSegments(command: string): string[] {
  return command
    .split(/&&|\|\||[;|\r\n]/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** 取命令中第一个像路径的参数（用于写入类命令的目标判定）。 */
function lastPathLikeToken(segment: string): string | null {
  const tokens = segment.split(/\s+/u).filter((token) => token.length > 0 && !token.startsWith("-"));
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (!token) continue;
    const cleaned = token.replace(/^["']|["']$/gu, "");
    if (/^[A-Za-z]:[\\/]/u.test(cleaned) || cleaned.startsWith("/") || cleaned.startsWith(".") || /[\\/]/u.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

/** 判断路径是否位于允许根之内。 */
function insideRoots(target: string, roots: readonly string[]): boolean {
  const resolved = isAbsolute(target) ? resolve(target) : null;
  if (!resolved) return false;
  return roots.some((root) => {
    const rel = relative(resolve(root), resolved);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
}

/**
 * 分析一条命令。
 * - 灾难性操作在任何模式下都拒绝（`danger-full-access` 也不例外）；
 * - 写入类命令的目标若在工作区之外，在非全权模式下拒绝；
 * - 解析不出目标时不猜测放行：只在出现写入特征且无法判定目标时拒绝。
 */
export function analyzeCommand(
  command: string,
  options: { mode: "read-only" | "workspace-write" | "danger-full-access"; workspaceRoots: readonly string[] },
): CommandVerdict {
  const trimmed = command.trim();
  if (trimmed.length === 0) return { allowed: false, code: "unparsable", reason: "命令为空。" };

  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, code: "dangerous-command", reason: `拒绝执行${label}类命令：${trimmed.slice(0, 60)}` };
    }
  }

  if (options.mode === "danger-full-access") return { allowed: true };

  const roots = options.workspaceRoots;
  for (const segment of splitSegments(trimmed)) {
    // 重定向写入：> / >> / 2> / *> 后面跟目标路径
    const redirect = /(?:^|\s)(?:\d?>|>>|\*?>)\s*("[^"]+"|'[^']+'|\S+)/u.exec(segment);
    if (redirect) {
      const target = (redirect[1] ?? "").replace(/^["']|["']$/gu, "");
      if (!target.startsWith("&")) {
        const absolute = isAbsolute(target) ? target : null;
        if (!absolute) {
          return { allowed: false, code: "unparsable", reason: `无法确定重定向目标的绝对路径：${target}` };
        }
        if (!insideRoots(absolute, roots)) {
          return { allowed: false, code: "outside-workspace", reason: `重定向写入超出工作区：${target}` };
        }
      }
      continue;
    }

    // 常见写入命令：目标参数必须在工作区内
    const writes = /(^|\s)(tee|touch|mkdir|md|cp|copy|mv|move|rm|del|Remove-Item|Set-Content|Add-Content|Out-File|New-Item)\b/iu;
    if (!writes.test(segment)) continue;
    const target = lastPathLikeToken(segment);
    if (!target) {
      // 写入命令但找不到路径参数（如 rm -rf 无目标）时保守拒绝。
      return { allowed: false, code: "unparsable", reason: `无法确定写入目标：${segment.slice(0, 60)}` };
    }
    const absolute = isAbsolute(target) ? target : null;
    if (!absolute) {
      return { allowed: false, code: "unparsable", reason: `无法确定写入目标的绝对路径：${target}` };
    }
    if (!insideRoots(absolute, roots)) {
      return { allowed: false, code: "outside-workspace", reason: `写入超出工作区：${target}` };
    }
  }

  return { allowed: true };
}
