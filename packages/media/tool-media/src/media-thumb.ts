// 媒体缩略图磁盘缓存：浏览器生成一次 WebP 后回传给 Host 落盘，之后任何客户端只读小图，不再反复读取整份原图。
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { isWithinRoot } from "./media-http";

/** 缩略图接口配置：允许根与存放目录可覆盖，便于测试隔离。 */
export interface MediaThumbHttpOptions {
  resolveAllowedRoots: () => Promise<string[]>;
  thumbsRoot?: string;
}

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;
const MIN_WIDTH = 160;
const MAX_WIDTH = 1600;

/** 读取带大小上限的请求体；超过上限抛错，由调用方返回 413。 */
async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("body too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/** WebP 文件头校验：RIFF....WEBP。 */
function isWebp(bytes: Buffer): boolean {
  return bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

/** 缩略图缓存文件名：只由原图路径、大小、修改时间与宽度决定，原图变化时自然换名。 */
export function mediaThumbCacheName(input: { path: string; size: number; mtimeMs: number; width: number }): string {
  const normalized = process.platform === "win32" ? resolve(input.path).toLowerCase() : resolve(input.path);
  return `${createHash("sha1").update(`${normalized}|${input.size}|${Math.floor(input.mtimeMs)}|${input.width}`).digest("hex")}.webp`;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

/**
 * 处理 `/api/media/thumb`：
 * - GET 命中返回 WebP，未生成返回 204（不刷 404 控制台错误）；
 * - POST 接收 JSON `{ data: base64 }`（写接口统一要求 application/json），校验后落盘。
 */
export function createMediaThumbHttpHandler(options: MediaThumbHttpOptions) {
  const thumbsRoot = (): string => options.thumbsRoot ?? join(homedir(), ".lfaa", "media", "thumbs");

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (urlObj.pathname !== "/api/media/thumb") return false;
    const method = (req.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, POST");
      res.end();
      return true;
    }

    const raw = urlObj.searchParams.get("path")?.trim() ?? "";
    const width = Math.max(MIN_WIDTH, Math.min(Number(urlObj.searchParams.get("w") ?? 480) || 480, MAX_WIDTH));
    if (!raw) {
      sendJson(res, 400, { error: "缺少文件路径。" });
      return true;
    }

    const target = resolve(raw);
    const roots = [...(await options.resolveAllowedRoots().catch(() => [])), join(homedir(), ".lfaa", "media")];
    if (!roots.some((root) => isWithinRoot(target, root))) {
      sendJson(res, 403, { error: "只允许缓存工作区或媒体目录下的素材。" });
      return true;
    }

    let info;
    try {
      info = await stat(target);
    } catch {
      sendJson(res, 404, { error: "源文件不存在。" });
      return true;
    }
    if (!info.isFile()) {
      sendJson(res, 404, { error: "源文件不存在。" });
      return true;
    }

    const name = mediaThumbCacheName({ path: target, size: info.size, mtimeMs: info.mtimeMs, width });
    const file = join(thumbsRoot(), name);

    if (method === "GET") {
      try {
        const bytes = await readFile(file);
        res.statusCode = 200;
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("ETag", `"${name}"`);
        res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
        res.setHeader("Content-Length", String(bytes.length));
        res.end(bytes);
      } catch {
        // 204 = 尚未生成，由浏览器生成后回传；避免每次首访都在控制台刷 404。
        res.statusCode = 204;
        res.end();
      }
      return true;
    }

    try {
      const body = await readBody(req, MAX_REQUEST_BYTES);
      const parsed = JSON.parse(body.toString("utf8")) as { data?: unknown };
      if (typeof parsed.data !== "string" || !parsed.data) {
        sendJson(res, 400, { error: "缺少缩略图数据。" });
        return true;
      }
      const bytes = Buffer.from(parsed.data, "base64");
      if (bytes.length === 0) {
        sendJson(res, 400, { error: "缺少缩略图数据。" });
        return true;
      }
      if (bytes.length > MAX_THUMB_BYTES) {
        sendJson(res, 413, { error: "缩略图过大。" });
        return true;
      }
      if (!isWebp(bytes)) {
        sendJson(res, 400, { error: "缩略图必须是 WebP。" });
        return true;
      }
      await mkdir(thumbsRoot(), { recursive: true });
      await writeFile(file, bytes);
      res.statusCode = 204;
      res.end();
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "body too large";
      sendJson(res, tooLarge ? 413 : 400, { error: tooLarge ? "缩略图请求过大。" : "无法解析缩略图请求。" });
    }
    return true;
  };
}