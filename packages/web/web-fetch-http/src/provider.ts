/**
 * 文件：provider.ts
 * 功能：实现匿名公网 HTTP(S) 抓取 Provider——校验并拒绝非公网目标、仅跟随同源重定向、
 *      强制超时与字节/字符上限、按 Content-Type 分类解码文本。
 * 作用：把 policy.ts 的网络前校验、network.ts 的公网地址校验与全局 fetch 传输组合成
 *      ctx.lfaaWeb 的抓取能力；请求不携带浏览器 Cookie 或环境凭据。
 * 不负责：Provider 注册（index.ts）、模型工具渲染（tool-web）。
 * 关联文件：policy.ts、network.ts、packages/web/tool-web。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web-fetch-http。
 * 安全说明：响应正文只在服务端解码后裁剪返回给模型，不写入浏览器日志；二进制类型直接拒绝读取。
 */
import { WebError } from "lfaa-web/src/types.js";
import type { WebFetchBody, WebFetchProvider, WebFetchRequest, WebFetchResult } from "lfaa-web/src/types.js";
import { resolvePublicAddresses } from "./network.js";
import { classifyContentType, decoderForCharset, isSameOrigin, parseCharset, validateFetchUrl } from "./policy.js";

/** Provider 解析后的传输与大小上限。 */
export interface HttpFetchLimits {
  /** 响应体最大字节数（超出即截断读取）。 */
  maxResponseBytes: number;
  /** 解码后正文最大字符数（超出即截断）。 */
  maxBodyChars: number;
  /** 默认抓取超时（毫秒）。 */
  timeoutMs: number;
  /** 最多跟随的同源重定向次数。 */
  maxRedirects: number;
  /** 每个请求发送的 User-Agent。 */
  userAgent: string;
}

/** Provider 注册使用的稳定 ID。 */
export const LOCAL_FETCH_PROVIDER_ID = "http";

/** 默认上限：响应体 5MB、解码后 10 万字符、超时 30s、同源重定向最多 5 次。 */
export const DEFAULT_LIMITS: HttpFetchLimits = {
  maxResponseBytes: 5_000_000,
  maxBodyChars: 100_000,
  timeoutMs: 30_000,
  maxRedirects: 5,
  userAgent: "lfaa-harness/0.1 (+https://github.com)",
};

/** 匿名公网 HTTP(S) 抓取 Provider。 */
export class HttpFetchProvider implements WebFetchProvider {
  readonly id = LOCAL_FETCH_PROVIDER_ID;

  constructor(private readonly limits: HttpFetchLimits = DEFAULT_LIMITS) {}

  /** 匿名公网抓取无需密钥，永远可用。 */
  available(): boolean {
    return true;
  }

  async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    if (signal?.aborted) throw new WebError("抓取已被取消", "WEB_ABORTED");
    // 组合调用方取消与本 Provider 的超时预算；任一触发都会中止请求与正文读取。
    const timeoutSignal = AbortSignal.timeout(this.limits.timeoutMs);
    const combined = signal === undefined ? timeoutSignal : AbortSignal.any([signal, timeoutSignal]);
    return await this.followAndRead(request.url, combined, signal ?? null);
  }

  /** 仅跟随同源重定向到上限，然后读取最终响应体。 */
  private async followAndRead(initialUrl: string, fetchSignal: AbortSignal, callerSignal: AbortSignal | null): Promise<WebFetchResult> {
    let currentUrl = validateFetchUrl(initialUrl);
    let redirectsFollowed = 0;
    for (;;) {
      // 发起请求前先校验该跳主机名解析到的全部地址为公网，拒绝 SSRF。
      await resolvePublicAddresses(currentUrl.hostname, callerSignal ?? fetchSignal);
      const headers = {
        "user-agent": this.limits.userAgent,
        "accept": "text/html,application/xhtml+xml,text/*;q=0.9,application/json;q=0.8",
      };
      let response: Response;
      try {
        response = await fetch(currentUrl, { method: "GET", redirect: "manual", headers, signal: fetchSignal });
      } catch (error) {
        throw translateError(error, callerSignal, fetchSignal);
      }

      if (isRedirectStatus(response.status)) {
        if (redirectsFollowed >= this.limits.maxRedirects) {
          throw new WebError(`超过最大同源重定向次数 ${this.limits.maxRedirects}`, "WEB_REDIRECT_BLOCKED");
        }
        const location = response.headers.get("location");
        if (location === null) {
          throw new WebError(`重定向响应（HTTP ${response.status}）缺少 Location 头`, "WEB_PROVIDER_ERROR");
        }
        let target: URL;
        try {
          target = new URL(location, currentUrl);
        } catch (error) {
          throw new WebError(`无效的重定向 Location：${location}`, "WEB_PROVIDER_ERROR", { cause: error });
        }
        const validatedTarget = validateFetchUrl(target.toString());
        if (!isSameOrigin(validatedTarget, currentUrl)) {
          // 跨源重定向不自动跟随：要求模型对新 URL 重新发起一次抓取。
          throw new WebError(`跨源重定向到 ${validatedTarget.origin} 不会被自动跟随；请直接对该 URL 重新抓取`, "WEB_REDIRECT_BLOCKED");
        }
        currentUrl = validatedTarget;
        redirectsFollowed++;
        continue;
      }

      return await this.readBody(response, currentUrl, callerSignal);
    }
  }

  /** 按 Content-Type 分类、按字符集解码、字节/字符双重上限地读取最终响应体。 */
  private async readBody(response: Response, finalUrl: URL, callerSignal: AbortSignal | null): Promise<WebFetchResult> {
    const contentType = response.headers.get("content-type");
    const kind = classifyContentType(contentType);
    if (kind === undefined) {
      // 二进制类型不读入模型上下文，直接拒绝。
      throw new WebError(`不支持的内容类型 "${contentType ?? "未知"}"`, "WEB_UNSUPPORTED_CONTENT_TYPE");
    }
    let decoder: InstanceType<typeof TextDecoder>;
    try {
      decoder = decoderForCharset(parseCharset(contentType));
    } catch (error) {
      throw error;
    }

    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null) {
      const length = Number(declaredLength);
      if (Number.isFinite(length) && length > this.limits.maxResponseBytes) {
        throw new WebError(`响应超过最大 ${this.limits.maxResponseBytes} 字节`, "WEB_FETCH_TOO_LARGE");
      }
    }

    const { bytes, truncatedByBytes } = await readCappedStream(response, this.limits.maxResponseBytes, callerSignal);
    const decoded = decoder.decode(bytes);
    const truncatedByChars = decoded.length > this.limits.maxBodyChars;
    const content = truncatedByChars ? decoded.slice(0, this.limits.maxBodyChars) : decoded;
    const body: WebFetchBody = kind === "html" ? { kind: "html", content } : { kind: "text", content };
    return {
      url: finalUrl.toString(),
      statusCode: response.status,
      body,
      truncated: truncatedByBytes || truncatedByChars,
    };
  }
}

/** 读取响应流到 maxBytes；声明长度超限直接拒绝，流式超限截断而不是整包拒绝。 */
async function readCappedStream(response: Response, maxBytes: number, callerSignal: AbortSignal | null): Promise<{ bytes: Uint8Array; truncatedByBytes: boolean }> {
  if (response.body === null) return { bytes: new Uint8Array(0), truncatedByBytes: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncatedByBytes = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        truncatedByBytes = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    throw translateError(error, callerSignal, null);
  } finally {
    await reader.cancel().catch(() => { /* 尽力清理 */ });
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncatedByBytes };
}

/** 带 Location 的重定向状态码。 */
function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** 把 fetch/流错误翻译为带码的 WebError：调用方取消=WEB_ABORTED，其余=WEB_PROVIDER_ERROR。 */
function translateError(error: unknown, callerSignal: AbortSignal | null, fetchSignal: AbortSignal | null): WebError {
  if (callerSignal?.aborted || fetchSignal?.aborted) {
    return new WebError("抓取已被取消", "WEB_ABORTED", { cause: error });
  }
  if (error instanceof WebError) return error;
  return new WebError(`抓取失败：${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
}
