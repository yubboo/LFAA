// @lfaa/tool-web 插件入口：提供 web_search 全网搜索与 fetch_url 网页正文抓取两个轻量只读工具。
import type { Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import { formatSearchResults, searchWeb } from "./web-search-tool";

/** 单次抓取允许的最大字节数，避免把整站拉进上下文。 */
export const MAX_BYTES = 2_000_000;

/** 抓取结果。 */
export interface FetchOutcome {
  ok: boolean;
  status?: number;
  title?: string | undefined;
  text?: string;
  error?: string | undefined;
}

/** 只允许 http/https，且拒绝本机与内网地址，防止被诱导访问内网服务。 */
export function validateUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "URL 格式不正确。" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "只支持 http/https 协议。" };
  }
  const host = url.hostname.toLowerCase();
  const blocked = host === "localhost" || host === "0.0.0.0" || host === "::1"
    || /^127\./u.test(host) || /^10\./u.test(host) || /^192\.168\./u.test(host)
    || /^169\.254\./u.test(host) || /^172\.(1[6-9]|2\d|3[01])\./u.test(host);
  if (blocked) return { error: "不允许访问本机或内网地址。" };
  return { url };
}

/** 把 HTML 转成纯文本：去掉脚本样式与标签，压缩空白。 */
export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ");
  const text = withoutNoise
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article)>/giu, "\n")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"");
  return text.replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();
}

/** 从 HTML 里取标题。 */
export function extractTitle(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(html);
  return match?.[1]?.trim() || undefined;
}

/** 抓取网页并返回正文，失败时给出明确原因。 */
export async function fetchUrl(raw: string): Promise<FetchOutcome> {
  const checked = validateUrl(raw);
  if ("error" in checked) return { ok: false, error: checked.error };
  try {
    const response = await fetch(checked.url, {
      headers: { "user-agent": "LFAA-Agent/0.1 (+web fetch)" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const buffer = await response.arrayBuffer();
    const slice = buffer.byteLength > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
    const html = new TextDecoder("utf-8").decode(slice);
    const text = htmlToText(html);
    return {
      ok: response.ok,
      status: response.status,
      title: extractTitle(html),
      text: text.slice(0, 60_000),
      ...(response.ok ? {} : { error: `HTTP ${response.status}` }),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 网页插件：注册 web_search 与 fetch_url 两个轻量工具，卸载时自动注销。 */
const toolWebPlugin: Plugin.Object<void> = {
  name: "lfaa-tool-web",
  inject: ["tools"],
  apply(ctx) {
    ctx.effect(() => {
      const disposeSearch = ctx.tools.registerTool({
        moduleName: "@lfaa/web",
        name: "web_search",
        title: "全网搜索",
        description: "轻量免密钥全网搜索，返回标题、URL 与摘要；查文档、报错方案或最新信息时优先使用，再按需用 fetch_url 精读正文，无需启动完整浏览器。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "搜索关键词" },
            limit: { type: "number", description: "返回条数，默认 6，上限 10" },
            site: { type: "string", description: "可选域名限定，如 github.com 或 react.dev" },
          },
          required: ["query"],
        },
        execute: async (args, execCtx) => {
          const query = typeof args.query === "string" ? args.query.trim() : "";
          if (!query) return { ok: false, output: "搜索关键词不能为空。", summary: "参数无效" };
          const limit = typeof args.limit === "number" ? args.limit : undefined;
          const site = typeof args.site === "string" ? args.site : undefined;
          const outcome = await searchWeb(query, {
            ...(limit !== undefined ? { limit } : {}),
            ...(site ? { site } : {}),
            signal: execCtx.signal,
          });
          if (!outcome.ok && outcome.items.length === 0) {
            return { ok: false, output: outcome.error ?? "搜索失败。", summary: "搜索失败" };
          }
          return {
            ok: true,
            output: formatSearchResults(query, outcome),
            summary: `搜索「${query}」命中 ${outcome.items.length} 条`,
          };
        },
      });
      const disposeFetch = ctx.tools.registerTool({
        moduleName: "@lfaa/web",
        name: "fetch_url",
        title: "读取网页",
        description: "抓取公开网页并返回可读正文，用于查阅文档、博客与在线资料（配合 web_search 使用）。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "要抓取的 http/https 地址" },
          },
          required: ["url"],
        },
        execute: async (args) => {
          const url = typeof args.url === "string" ? args.url.trim() : "";
          if (!url) return { ok: false, output: "URL 不能为空。", summary: "参数无效" };
          const result = await fetchUrl(url);
          if (!result.ok) {
            return { ok: false, output: result.error ?? "抓取失败。", summary: "抓取失败" };
          }
          return {
            ok: true,
            output: result.text ?? "",
            summary: `已读取 ${result.title ?? url}`,
          };
        },
      });
      return () => {
        disposeSearch();
        disposeFetch();
      };
    });
  },
};

export default toolWebPlugin;
export { toolWebPlugin };
