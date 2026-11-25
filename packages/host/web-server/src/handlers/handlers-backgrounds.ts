// @lfaa/web-server：个人背景图接口：列表、上传、读取与删除；文件保存在本机 ~/.lfaa/backgrounds。
// 直接放进目录的图片也会被列出（按文件名生成 id），因此 Agent 或用户都可以不经过上传接口加图。
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiHandler } from "@lfaa/api-gateway";

/** 个人背景元数据；客户端据此渲染「我的图片」并拼读取地址。 */
export interface CustomBackgroundMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

export interface BackgroundHandlerOptions {
  /** 覆盖存储目录，供测试使用；缺省 ~/.lfaa/backgrounds。 */
  backgroundsDir?: string;
}

interface BackgroundFileEntry extends CustomBackgroundMeta {
  file: string;
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const ID_PATTERN = /^[a-z0-9-]{1,64}$/u;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const EXTENSION_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error("图片文件过大，请选择 12MB 以内的图片。");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function resolveBackgroundsDir(options: BackgroundHandlerOptions): string {
  return options.backgroundsDir ? resolve(options.backgroundsDir) : join(homedir(), ".lfaa", "backgrounds");
}

/** 文件名转 id：小写、非法字符折成连字符；中文等无法转换的名字会被跳过（上传走 UUID）。 */
function normalizeId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 64);
}

/** 扫描目录：图片文件与同名 `.meta.json` 合并，直接放进来的文件也会出现在列表里。 */
async function listBackgrounds(dir: string): Promise<BackgroundFileEntry[]> {
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const metas = new Map<string, Partial<CustomBackgroundMeta> & { file?: string }>();
  for (const name of names) {
    if (!name.endsWith(".meta.json")) continue;
    try {
      const parsed = JSON.parse(await readFile(join(dir, name), "utf8")) as Partial<CustomBackgroundMeta>;
      if (typeof parsed.id === "string") metas.set(parsed.id, parsed);
    } catch {
      // 损坏的元数据不影响其它图片。
    }
  }

  const seen = new Set<string>();
  const backgrounds: BackgroundFileEntry[] = [];
  for (const name of names.sort()) {
    const extension = extname(name).toLowerCase();
    const mime = EXTENSION_MIME[extension];
    if (!mime || name.endsWith(".meta.json")) continue;
    const id = normalizeId(name.slice(0, -extension.length));
    if (!id || !ID_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    try {
      const info = await stat(join(dir, name));
      const meta = metas.get(id);
      backgrounds.push({
        id,
        name: typeof meta?.name === "string" && meta.name.trim() ? meta.name : name.slice(0, -extension.length),
        mime: typeof meta?.mime === "string" ? meta.mime : mime,
        size: info.size,
        createdAt: typeof meta?.createdAt === "number" ? meta.createdAt : Math.round(info.mtimeMs),
        file: name,
      });
    } catch {
      // 文件在扫描过程中被删除时跳过。
    }
  }
  return backgrounds.sort((left, right) => right.createdAt - left.createdAt);
}

function toMeta(entry: BackgroundFileEntry): CustomBackgroundMeta {
  return {
    id: entry.id,
    name: entry.name,
    mime: entry.mime,
    size: entry.size,
    createdAt: entry.createdAt,
  };
}

/** 处理 /api/backgrounds 系列接口；未命中返回 false 交给后续处理器。 */
export function createBackgroundsHttpHandler(options: BackgroundHandlerOptions = {}): ApiHandler {
  const dir = resolveBackgroundsDir(options);
  return async (req, res) => {
    const url = new URL(req.url ?? "", "http://127.0.0.1");
    const pathname = url.pathname;
    if (!pathname.startsWith("/api/backgrounds")) return false;
    const method = (req.method ?? "GET").toUpperCase();
    const suffix = pathname.slice("/api/backgrounds".length);

    try {
      const entries = await listBackgrounds(dir);

      if (method === "GET" && suffix === "") {
        sendJson(res, 200, { backgrounds: entries.map(toMeta) });
        return true;
      }

      if (method === "POST" && suffix === "") {
        const body = await readJsonBody(req);
        const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 80) || "自定义背景";
        const mime = typeof body.mime === "string" ? body.mime.trim().toLowerCase() : "";
        const extension = MIME_EXTENSIONS[mime];
        if (!extension) {
          sendJson(res, 415, { error: "仅支持 PNG、JPG 或 WebP 图片。" });
          return true;
        }
        const base64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
        const buffer = Buffer.from(base64, "base64");
        if (buffer.length === 0) {
          sendJson(res, 400, { error: "图片内容为空。" });
          return true;
        }
        if (buffer.length > MAX_IMAGE_BYTES) {
          sendJson(res, 413, { error: "图片文件过大，请选择 12MB 以内的图片。" });
          return true;
        }
        const id = randomUUID();
        const file = `${id}${extension}`;
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, file), buffer);
        const meta: BackgroundFileEntry = {
          id,
          name,
          mime,
          size: buffer.length,
          createdAt: Date.now(),
          file,
        };
        await writeFile(join(dir, `${id}.meta.json`), JSON.stringify(meta, null, 2), "utf8");
        sendJson(res, 201, { background: toMeta(meta) });
        return true;
      }

      const fileRoute = /^\/([^/]+)\/file$/u.exec(suffix);
      if (method === "GET" && fileRoute?.[1]) {
        const id = decodeURIComponent(fileRoute[1]);
        if (!ID_PATTERN.test(id)) {
          sendJson(res, 400, { error: "无效的背景 ID。" });
          return true;
        }
        const entry = entries.find((item) => item.id === id);
        if (!entry) {
          sendJson(res, 404, { error: "背景图不存在。" });
          return true;
        }
        const buffer = await readFile(join(dir, entry.file)).catch(() => null);
        if (!buffer) {
          sendJson(res, 404, { error: "背景图文件不存在。" });
          return true;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", entry.mime);
        res.setHeader("Content-Length", String(buffer.length));
        res.setHeader("Cache-Control", "private, max-age=86400");
        res.end(buffer);
        return true;
      }

      const deleteRoute = /^\/([^/]+)$/u.exec(suffix);
      if (method === "DELETE" && deleteRoute?.[1]) {
        const id = decodeURIComponent(deleteRoute[1]);
        if (!ID_PATTERN.test(id)) {
          sendJson(res, 400, { error: "无效的背景 ID。" });
          return true;
        }
        const entry = entries.find((item) => item.id === id);
        if (!entry) {
          sendJson(res, 404, { error: "背景图不存在。" });
          return true;
        }
        await rm(join(dir, entry.file), { force: true });
        await rm(join(dir, `${id}.meta.json`), { force: true });
        sendJson(res, 200, { ok: true });
        return true;
      }

      return false;
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}