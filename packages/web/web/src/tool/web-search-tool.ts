// 轻量全网搜索工具（web_search）：免密钥直接抓取公开搜索结果，支持 DuckDuckGo 与 Bing 双源回退，返回精简标题、链接与摘要。
export interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOutcome {
  ok: boolean;
  provider?: "bing" | "duckduckgo";
  items: WebSearchItem[];
  error?: string | undefined;
}

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;
const SEARCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** 反转常见 HTML 实体并压缩多余空白。 */
export function decodeHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/gu, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/\s+/gu, " ")
    .trim();
}

/** 解开 DuckDuckGo 跳转链接里的 uddg 目标地址。 */
export function unwrapDuckDuckGoUrl(rawHref: string): string {
  const decoded = decodeHtmlText(rawHref);
  if (!decoded) return "";
  try {
    const url = decoded.startsWith("//")
      ? new URL(`https:${decoded}`)
      : decoded.startsWith("/")
        ? new URL(`https://duckduckgo.com${decoded}`)
        : new URL(decoded);
    const uddg = url.searchParams.get("uddg");
    if (uddg && /^https?:\/\//iu.test(uddg)) return uddg;
    return /^https?:\/\//iu.test(url.href) ? url.href : "";
  } catch {
    return "";
  }
}

/** 解析 DuckDuckGo HTML 版搜索结果。 */
export function parseDuckDuckGoHtml(html: string, limit = DEFAULT_LIMIT): WebSearchItem[] {
  const items: WebSearchItem[] = [];
  const blockRe = /<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/giu;
  for (const match of html.matchAll(blockRe)) {
    if (items.length >= limit) break;
    const block = match[1] ?? "";
    const linkMatch = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/iu.exec(block);
    if (!linkMatch) continue;
    const url = unwrapDuckDuckGoUrl(linkMatch[1] ?? "");
    const title = decodeHtmlText(linkMatch[2] ?? "");
    if (!url || !title) continue;
    const snippetMatch = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/iu.exec(block);
    const snippet = decodeHtmlText(snippetMatch?.[1] ?? "");
    if (!items.some((item) => item.url === url)) {
      items.push({ title, url, snippet });
    }
  }
  return items;
}

/** 解析 Bing HTML 搜索结果（国内直连环境更稳定，作为主源或回退源）。 */
export function parseBingHtml(html: string, limit = DEFAULT_LIMIT): WebSearchItem[] {
  const items: WebSearchItem[] = [];
  const blockRe = /<li[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/giu;
  for (const match of html.matchAll(blockRe)) {
    if (items.length >= limit) break;
    const block = match[1] ?? "";
    const linkMatch = /<h2[^>]*>\s*<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/iu.exec(block);
    if (!linkMatch) continue;
    const url = decodeHtmlText(linkMatch[1] ?? "");
    const title = decodeHtmlText(linkMatch[2] ?? "");
    if (!url || !title) continue;
    const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/iu.exec(block);
    const snippet = decodeHtmlText(snippetMatch?.[1] ?? "");
    if (!items.some((item) => item.url === url)) {
      items.push({ title, url, snippet });
    }
  }
  return items;
}

async function fetchSearchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const timeout = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(url, {
    signal: composed,
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/**
 * 执行免密钥全网搜索：先尝试 Bing（国内网络直连更稳定），无结果或失败时自动回退 DuckDuckGo。
 */
export async function searchWeb(
  rawQuery: string,
  options: { limit?: number; site?: string; signal?: AbortSignal } = {},
): Promise<WebSearchOutcome> {
  const baseQuery = rawQuery.trim();
  if (!baseQuery) return { ok: false, items: [], error: "搜索关键词不能为空。" };
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT)));
  const site = options.site?.trim().replace(/^https?:\/\//iu, "").replace(/\/.*$/u, "");
  const effectiveQuery = site ? `site:${site} ${baseQuery}` : baseQuery;
  const encoded = encodeURIComponent(effectiveQuery);

  const errors: string[] = [];
  // 1. 优先尝试 Bing HTML（对国内网络与中文技术资料友好）。
  try {
    const html = await fetchSearchHtml(`https://www.bing.com/search?q=${encoded}&count=${limit}`, options.signal);
    const items = parseBingHtml(html, limit);
    if (items.length > 0) return { ok: true, provider: "bing", items };
  } catch (error) {
    errors.push(`Bing: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. 回退 DuckDuckGo HTML。
  try {
    const html = await fetchSearchHtml(`https://html.duckduckgo.com/html/?q=${encoded}`, options.signal);
    const items = parseDuckDuckGoHtml(html, limit);
    if (items.length > 0) return { ok: true, provider: "duckduckgo", items };
  } catch (error) {
    errors.push(`DuckDuckGo: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    ok: errors.length === 0,
    items: [],
    ...(errors.length > 0 ? { error: `搜索请求失败（${errors.join("；")}）` } : {}),
  };
}

/** 将搜索结果格式化为紧凑易读的 Markdown 列表，供模型快速筛选并用 fetch_url 精读。 */
export function formatSearchResults(query: string, outcome: WebSearchOutcome): string {
  if (outcome.items.length === 0) {
    return outcome.error ?? `未找到与「${query}」相关的公开网页结果。`;
  }
  const lines = outcome.items.map((item, idx) => {
    const snippet = item.snippet ? `\n   ${item.snippet}` : "";
    return `${idx + 1}. **${item.title}**\n   ${item.url}${snippet}`;
  });
  return `搜索「${query}」共返回 ${outcome.items.length} 条结果（来源：${outcome.provider ?? "web"}）：\n\n${lines.join("\n\n")}\n\n提示：如需阅读某条结果的完整正文，可直接调用 fetch_url 传入对应 URL。`;
}
