// @lfaa/web-fetch-http：用本机 HTTP 客户端实现网页抓取 seam，限制超时与单页体积。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import type { WebFetchRequest, WebFetchResult, WebProvider } from "../seam";
import "@lfaa/web";

/** 抓取实现的默认参数，集中在包内便于测试与后续配置化。 */
export const HTTP_FETCH_DEFAULTS = {
  timeoutMs: 20_000,
  maxBytes: 2_000_000,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LFAA-WebFetch/0.1",
} as const;

/** 抓取实现的可调参数。 */
export interface HttpFetchConfig {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

const ACCEPTED = "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5";

/** 按字节上限读取响应体：超出即截断并标记，避免整页大文件拖垮会话。 */
export async function readCappedText(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error("maxBytes 必须为正数。");
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const encoded = new TextEncoder().encode(text);
    return encoded.byteLength > maxBytes
      ? { text: new TextDecoder().decode(encoded.slice(0, maxBytes)), truncated: true }
      : { text, truncated: false };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    const remaining = maxBytes - total;
    if (value.byteLength >= remaining) {
      chunks.push(value.slice(0, remaining));
      total += remaining;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(merged), truncated };
}

/** 只允许 http/https，避免 file:// 或自定义协议被模型用来读本机文件。 */
export function assertHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`网页抓取只支持 http/https：${url.protocol}`);
  }
  return url;
}

/** 构造 HTTP 抓取实现；插件只是把它注册进 seam，便于单独测试。 */
export function createHttpWebProvider(config: HttpFetchConfig = {}): WebProvider {
  const timeoutMs = config.timeoutMs ?? HTTP_FETCH_DEFAULTS.timeoutMs;
  const maxBytes = config.maxBytes ?? HTTP_FETCH_DEFAULTS.maxBytes;
  const userAgent = config.userAgent ?? HTTP_FETCH_DEFAULTS.userAgent;
  return {
    id: "http",
    priority: 0,
    async fetchText({ url, signal }: WebFetchRequest): Promise<WebFetchResult> {
      const target = assertHttpUrl(url);
      const timeout = AbortSignal.timeout(timeoutMs);
      const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;
      const response = await fetch(target, {
        signal: composed,
        redirect: "follow",
        headers: { accept: ACCEPTED, "user-agent": userAgent },
      });
      const { text, truncated } = await readCappedText(response, maxBytes);
      return {
        url,
        finalUrl: response.url || target.href,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        text,
        truncated,
      };
    },
  };
}

/** HTTP 抓取插件：把实现注册进 ctx.web，卸载时注销。 */
const httpFetchPlugin: Plugin.Object<HttpFetchConfig> = {
  name: "lfaa-web-fetch-http",
  inject: ["web"],
  apply(ctx: Context, config?: HttpFetchConfig) {
    ctx.effect(() => ctx.web.registerProvider(createHttpWebProvider(config ?? {})));
  },
};

export function webFetchHttpPlugin(ctx: Context, config: HttpFetchConfig = {}): void {
  ctx.effect(() => ctx.web.registerProvider(createHttpWebProvider(config)));
}
webFetchHttpPlugin.inject = ["web"] as const;

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default httpFetchPlugin;
export { httpFetchPlugin };