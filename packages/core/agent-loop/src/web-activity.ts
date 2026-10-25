/**
 * 功能：生成网页操作的有界公开摘要。
 * 作用：只显示校验后的查询、去凭据/查询串的 URL 或工作区相对 HTML 路径；不保存网页正文。
 * 关联文件：execute-turn.ts 写入现有活动；agent-runtime.test.mjs 验证隐私及长度边界。
 */
import { sanitizeShellCommandActivityPreview } from "./shell-command-activity.js";

export function buildWebActivityPreview(toolId: string, parameters: Record<string, unknown>): string | null {
  let value: string;
  let label: string;
  if (toolId === "web.search" && Array.isArray(parameters.queries)) {
    value = parameters.queries.filter((query): query is string => typeof query === "string").join("\n");
    label = "搜索查询";
  } else if (toolId === "web.fetch" && typeof parameters.url === "string") {
    try {
      const url = new URL(parameters.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      value = `${url.origin}${url.pathname}`;
    } catch { return null; }
    label = "读取网页";
  } else if (toolId === "browser-use.navigate" && typeof parameters.url === "string") {
    try {
      const url = new URL(parameters.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      value = `${url.origin}${url.pathname}`;
    } catch { return null; }
    label = "打开网页";
  } else if (toolId === "browser-use.open-workspace-file" && typeof parameters.path === "string") {
    value = parameters.path.replaceAll("\\", "/");
    if (!value || value.startsWith("/") || /^[a-z]:/iu.test(value) || value.split("/").some(part => part === ".." || part === "")) return null;
    label = "工作区网页";
  } else return null;
  const safe = sanitizeShellCommandActivityPreview(value);
  let clipped = safe.slice(0, 1800);
  if (/[\uD800-\uDBFF]$/u.test(clipped)) clipped = clipped.slice(0, -1);
  return `${label}：\n${clipped}${safe.length > 1800 ? "\n…（预览已截断）" : ""}`;
}
