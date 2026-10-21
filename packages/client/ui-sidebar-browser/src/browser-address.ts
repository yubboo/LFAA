/**
 * 功能：统一浏览器工作区的地址栏识别与搜索地址生成。
 * 作用：桌面原生页面和 Web 截图预览使用同一套 URL、凭据与搜索引擎规则。
 * 关联文件：NativeBrowserPanel.tsx、BrowserPanel.tsx、SettingsPage.tsx。
 */
import type { UserSettings } from "lfaa-client-connection/src/api.js";

type SearchEngine = UserSettings["browserUse"]["searchEngine"];

export function resolveBrowserAddress(input: string, engine: SearchEngine): string {
  const value = input.trim();
  if (!value) throw new Error("输入网址或搜索内容。");
  if (value.length > 1_800) throw new Error("地址或搜索内容过长。");

  if (/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/iu.test(value)) {
    return validateUrl(`http://${value}`);
  }
  if (/\s/u.test(value)) return searchUrl(value, engine);
  if (/^[a-z][a-z\d+.-]*:/iu.test(value)) return validateUrl(value);
  if (value.includes(".") || value.startsWith("www")) return validateUrl(`https://${value}`);
  return searchUrl(value, engine);
}

function validateUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("浏览器地址无效。"); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.href.length > 2_048) {
    throw new Error("浏览器只支持不含账号密码的 HTTP(S) 地址。");
  }
  return parsed.href;
}

function searchUrl(query: string, engine: SearchEngine): string {
  const encoded = encodeURIComponent(query);
  const base = engine === "google" ? "https://www.google.com/search?q="
    : engine === "duckduckgo" ? "https://duckduckgo.com/?q="
      : "https://www.bing.com/search?q=";
  return validateUrl(`${base}${encoded}`);
}
