/**
 * 文件：policy.ts
 * 功能：本地 HTTP(S) 抓取 Provider 的纯网络无关策略——URL 校验、同源判定、Content-Type 分类、字符集解析。
 * 作用：在发起任何网络请求前拒绝非 http(s)、带内嵌凭据、超长或跨源重定向的 URL；
 *      只放行 text/html、text/* 与结构化文本类型，二进制内容一律不读入模型上下文。
 * 不负责：DNS 解析、实际请求、字节流读取。
 * 关联文件：provider.ts（组合本策略与传输）、network.ts（公网地址校验）。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web-fetch-http。
 */
import { WebError } from "lfaa-web/src/types.js";

/** 抓取 Provider 接受的请求 URL 最大长度。 */
export const WEB_FETCH_MAX_URL_LENGTH = 2048;

/** 本 Provider 能解码的响应体种类。 */
export type FetchableKind = "html" | "text";

/**
 * 解析请求 URL 并强制网络无关的传输限制：仅 http/https，不允许内嵌凭据。
 */
export function parseFetchUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch (error) {
    throw new WebError(`无效 URL：${input}`, "WEB_INVALID_URL", { cause: error });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebError(`不支持的 URL 协议 "${url.protocol}"（仅允许 http 与 https）`, "WEB_INVALID_URL");
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new WebError("URL 中不允许携带凭据", "WEB_BLOCKED_URL");
  }
  return url;
}

/** 完整的网络前校验：长度上限 + parseFetchUrl 的全部限制。 */
export function validateFetchUrl(input: string): URL {
  if (input.length > WEB_FETCH_MAX_URL_LENGTH) {
    throw new WebError(`URL 超过最大长度 ${WEB_FETCH_MAX_URL_LENGTH}`, "WEB_INVALID_URL");
  }
  return parseFetchUrl(input);
}

/** 两个 URL 同源 = 协议、主机名、端口完全一致；跨源重定向一律不自动跟随。 */
export function isSameOrigin(a: URL, b: URL): boolean {
  return a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;
}

/**
 * 把响应 Content-Type 分类为可解码种类；不支持的类型（二进制等）返回 undefined。
 */
export function classifyContentType(contentType: string | null): FetchableKind | undefined {
  const mime = (contentType ?? "").replace(/;.*$/su, "").trim().toLowerCase();
  if (mime === "text/html" || mime === "application/xhtml+xml") return "html";
  if (mime.startsWith("text/")) return "text";
  if (mime === "application/json" || mime === "application/xml" || mime.endsWith("+json") || mime.endsWith("+xml")) return "text";
  return undefined;
}

/** 从 Content-Type 提取 charset（小写）；缺失返回 undefined。 */
export function parseCharset(contentType: string | null): string | undefined {
  const match = /;\s*charset\s*=\s*"?([^";]+)"?/iu.exec(contentType ?? "");
  return match?.[1]?.trim().toLowerCase();
}

/** 按声明字符集构造 TextDecoder；未声明默认 UTF-8；不认识的字符集直接抛错，避免静默乱码。 */
export function decoderForCharset(charset: string | undefined): InstanceType<typeof TextDecoder> {
  if (charset === undefined) return new TextDecoder("utf-8");
  try {
    return new TextDecoder(charset);
  } catch (error) {
    throw new WebError(`不支持的字符集 "${charset}"`, "WEB_UNSUPPORTED_CONTENT_TYPE", { cause: error });
  }
}
