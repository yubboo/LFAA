/**
 * 功能：生成网页操作的有界公开摘要。
 * 作用：只显示校验后的查询或去凭据/查询串的 URL，复用命令预览的凭据遮蔽；不保存网页正文。
 * 关联文件：execute-turn.ts 写入现有活动；agent-runtime.test.mjs 验证隐私及长度边界。
 */
import { sanitizeShellCommandActivityPreview } from "./shell-command-activity.js";

export function buildWebActivityPreview(toolId: string, parameters: Record<string, unknown>): string | null {
  let value: string;
  if (toolId === "web.search" && Array.isArray(parameters.queries)) {
    value = parameters.queries.filter((query): query is string => typeof query === "string").join("\n");
  } else if (toolId === "web.fetch" && typeof parameters.url === "string") {
    try {
      const url = new URL(parameters.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      value = `${url.origin}${url.pathname}`;
    } catch { return null; }
  } else return null;
  const safe = sanitizeShellCommandActivityPreview(value);
  let clipped = safe.slice(0, 1800);
  if (/[\uD800-\uDBFF]$/u.test(clipped)) clipped = clipped.slice(0, -1);
  return `${toolId === "web.search" ? "搜索查询" : "读取网页"}：\n${clipped}${safe.length > 1800 ? "\n…（预览已截断）" : ""}`;
}
