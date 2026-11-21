// @lfaa/web-server：生产静态托管的文件层实现：MIME、路径边界、Range、缓存头与响应工具。
// 与服务器生命周期分开，便于单测直接验证穿越防护、Range 与缓存语义。
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import type { ApiGateway } from "@lfaa/api-gateway";

/** 静态资源 MIME 表；未命中回退二进制流。 */
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/** 一次静态请求需要的只读上下文。 */
export interface StaticRequestContext {
  webRoot: string;
  assetsRoot: string;
  indexHtml: string;
  token: string;
  gateway: Pick<ApiGateway, "handle">;
}

interface ByteRange {
  start: number;
  end: number;
}

/** 在 `</head>` 前注入令牌；模板缺少 head 时前置，保证客户端一定能读到。 */
export function injectToken(html: string, token: string): string {
  const meta = `    <meta name="lfaa-api-token" content="${token}" />\n`;
  if (html.includes("</head>")) return html.replace("</head>", `${meta}  </head>`);
  return meta + html;
}

/** 把路径解析为磁盘绝对路径；解码失败、空字节或越界一律返回 null。 */
export function resolveStaticPath(webRoot: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const target = resolve(webRoot, `.${decoded}`);
  if (target !== webRoot && !target.startsWith(`${webRoot}${sep}`)) return null;
  return target;
}

/** 输出单个文件；assets 目录带内容哈希，可长缓存，其余用 no-cache。 */
export async function serveFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  assetsRoot: string,
): Promise<void> {
  const info = await stat(filePath);
  const size = info.size;
  const immutable = filePath === assetsRoot || filePath.startsWith(`${assetsRoot}${sep}`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream");
  res.setHeader("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache");

  const range = parseRange(firstHeader(req.headers.range), size);
  if (range === "unsatisfiable") {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${size}`);
    res.end();
    return;
  }
  if (range) {
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader("Content-Length", String(range.end - range.start + 1));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    streamFile(res, filePath, range);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Length", String(size));
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  streamFile(res, filePath);
}

/** 页面入口：每次都由内存模板返回，禁用缓存以配合「重启即换令牌」。 */
export function serveIndex(req: IncomingMessage, res: ServerResponse, indexHtml: string): void {
  const body = Buffer.from(indexHtml, "utf8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", String(body.byteLength));
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}

/** 统一 JSON 响应（含 no-store），错误响应不带缓存。 */
export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

/** 取单值请求头；重复头在 Node 中会变成数组，这里只认同名首个值。 */
export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 解析单区间 Range；语法不支持时按整文件返回，起点越界时返回 unsatisfiable。 */
function parseRange(header: string | undefined, size: number): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (!match) return null;
  const rawStart = match[1] ?? "";
  const rawEnd = match[2] ?? "";
  if (!rawStart && !rawEnd) return null;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isFinite(start) || start >= size || end < start) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}

/** 流式输出文件；读取失败时尽早断开连接，避免挂死。 */
function streamFile(res: ServerResponse, filePath: string, range?: ByteRange): void {
  const stream = range
    ? createReadStream(filePath, { start: range.start, end: range.end })
    : createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.statusCode = 500;
    res.destroy();
  });
  stream.pipe(res);
}