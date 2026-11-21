// 生成素材的 HTTP 接口：文件读取/删除、素材库列表与元数据 sidecar 读写。
import { readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

/** 媒体元数据文件名：与媒体文件同级的 <文件名>.json。 */
export function mediaMetadataPath(filePath: string): string {
  return `${filePath}.json`;
}

/** 读回可重放的生成参数。历史素材仅在原提示词和模型已知、无遗失参考图时可重放。 */
export async function readImageRecipe(filePath: string): Promise<Record<string, unknown> | undefined> {
  const raw = await readFile(mediaMetadataPath(filePath), "utf8").catch(() => "");
  let metadata: Record<string, unknown>;
  try { metadata = JSON.parse(raw) as Record<string, unknown>; }
  catch { return undefined; }
  if (metadata?.kind !== "image" || typeof metadata.prompt !== "string" || !metadata.prompt.trim()
    || typeof metadata.model !== "string" || !metadata.model.trim()) return undefined;
  const replay = metadata.replay;
  if (!replay && Number(metadata.referenceImages) > 0) return undefined;
  const params = replay && typeof replay === "object" ? replay as Record<string, unknown> : {};
  return { ...params, prompt: metadata.prompt, modelId: metadata.model, style: metadata.style, size: metadata.size };
}

/** 写入媒体元数据（提示词/模型/类型），供生成素材库展示与复用。 */
export async function writeMediaMetadata(
  filePath: string,
  metadata: { kind: "image" | "video" | "audio"; prompt?: string; model?: string; extra?: Record<string, unknown> },
): Promise<void> {
  const payload = {
    kind: metadata.kind,
    ...(metadata.prompt ? { prompt: metadata.prompt } : {}),
    ...(metadata.model ? { model: metadata.model } : {}),
    createdAt: Date.now(),
    ...(metadata.extra ?? {}),
  };
  await writeFile(mediaMetadataPath(filePath), JSON.stringify(payload, null, 2), "utf8").catch(() => {});
}

/** 生成可在聊天中直接引用的媒体文件 URL。 */
export function buildMediaFileUrl(filePath: string): string {
  return `/api/media/file?path=${encodeURIComponent(filePath)}`;
}

/** 媒体文件 HTTP 处理器配置：允许访问的根目录由 Host 提供。 */
export interface MediaHttpOptions {
  resolveAllowedRoots: () => Promise<string[]>;
}

// Windows 文件系统大小写不敏感：项目登记路径（如 D:\…\lfaa）与磁盘真实目录名（如 D:\…\LFAA）
// 只有大小写差异时仍是同一个目录，比较必须按同一规则归一化，否则引用图会被误判越界。
function comparablePath(value: string): string {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/** 判断目标路径是否位于允许根内；Windows 上按大小写不敏感比较。 */
export function isWithinRoot(target: string, root: string): boolean {
  const base = comparablePath(root);
  const full = comparablePath(target);
  return full === base || full.startsWith(`${base}${sep}`);
}

/** 从真实会话产物链接定位图片，并校验素材目录及实际磁盘路径。 */
export async function findSessionImagePath(content: string, roots: readonly string[], expectedPath?: string): Promise<string | undefined> {
  for (const match of content.matchAll(/!\[[^\]\n]*\]\(\/api\/media\/file\?path=([^\s)]+)\)/gu)) {
    const listed = new URLSearchParams(`path=${match[1]}`).get("path");
    if (!listed || (expectedPath !== undefined && listed !== expectedPath) || !/\.(?:png|jpe?g|webp|gif)$/iu.test(listed)) continue;
    const target = await realpath(listed).catch(() => undefined);
    if (!target) continue;
    for (const root of [...roots.map((item) => join(item, ".lfaa-media", "images")), join(homedir(), ".lfaa", "media", "images")]) {
      const actualRoot = await realpath(root).catch(() => undefined);
      if (actualRoot && isWithinRoot(target, actualRoot) && (await stat(target).catch(() => null))?.isFile()) return target;
    }
  }
  return undefined;
}

function mimeOf(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".mp3":
      return "audio/mpeg";
    default:
      return "image/png";
  }
}

/** 一条生成素材的公开信息。 */
export interface MediaLibraryItem {
  path: string;
  name: string;
  kind: "image" | "video" | "audio";
  bytes: number;
  createdAt: number;
  prompt?: string;
  model?: string;
}

const MEDIA_KINDS: Array<{ kind: MediaLibraryItem["kind"]; dir: string; exts: string[] }> = [
  { kind: "image", dir: "images", exts: [".png", ".jpg", ".jpeg", ".webp", ".gif"] },
  { kind: "video", dir: "videos", exts: [".mp4", ".webm"] },
  { kind: "audio", dir: "audio", exts: [".mp3", ".wav", ".m4a", ".ogg"] },
];

/** 扫描一个根目录下的 .lfaa-media，读取文件与 sidecar 元数据。 */
async function scanMediaRoot(root: string, limit: number): Promise<MediaLibraryItem[]> {
  const items: MediaLibraryItem[] = [];
  const base = join(root, ".lfaa-media");
  for (const { kind, dir, exts } of MEDIA_KINDS) {
    const folder = join(base, dir);
    const entries = await readdir(folder).catch(() => [] as string[]);
    for (const entry of entries) {
      if (!exts.includes(extname(entry).toLowerCase())) continue;
      const path = join(folder, entry);
      const fileStat = await stat(path).catch(() => null);
      if (!fileStat?.isFile()) continue;
      const rawMeta = await readFile(mediaMetadataPath(path), "utf8").catch(() => "");
      let meta: { prompt?: string; model?: string; createdAt?: number } = {};
      if (rawMeta) {
        try {
          meta = JSON.parse(rawMeta) as { prompt?: string; model?: string; createdAt?: number };
        } catch {
          meta = {};
        }
      }
      items.push({
        path,
        name: entry,
        kind,
        bytes: fileStat.size,
        createdAt: typeof meta.createdAt === "number" ? meta.createdAt : fileStat.mtimeMs,
        ...(meta.prompt ? { prompt: meta.prompt } : {}),
        ...(meta.model ? { model: meta.model } : {}),
      });
    }
  }
  return items;
}

/** 处理 /api/media/library：列出工作区与媒体目录下的生成素材（带提示词元数据）。 */
export function createMediaLibraryHttpHandler(options: MediaHttpOptions) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (urlObj.pathname !== "/api/media/library") return false;
    if ((req.method ?? "GET").toUpperCase() !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET");
      res.end();
      return true;
    }
    const limit = Math.max(1, Math.min(Number(urlObj.searchParams.get("limit") ?? 60) || 60, 200));
    // 同一根目录可能同时出现在项目列表与检测结果里：去重后再扫描，并按路径去重素材。
    const roots = [...new Set([...(await options.resolveAllowedRoots().catch(() => [])), join(homedir(), ".lfaa", "media")])];
    const all = (await Promise.all(roots.map((root) => scanMediaRoot(root, limit)))).flat();
    const unique = [...new Map(all.map((item) => [item.path, item])).values()];
    const items = unique.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ items }));
    return true;
  };
}

/** 处理 /api/media/file：仅允许读取工作区或媒体目录下的文件，供聊天内预览生成图片。 */
export function createMediaHttpHandler(options: MediaHttpOptions) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (urlObj.pathname !== "/api/media/file") return false;
    const method = (req.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "DELETE") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, DELETE");
      res.end();
      return true;
    }
    const raw = urlObj.searchParams.get("path")?.trim() ?? "";
    if (!raw) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "缺少文件路径。" }));
      return true;
    }
    const target = resolve(raw);
    const roots = [...(await options.resolveAllowedRoots().catch(() => [])), join(homedir(), ".lfaa", "media")];
    if (!roots.some((root) => isWithinRoot(target, root))) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "只允许读取工作区或媒体目录下的文件。" }));
      return true;
    }
    if (method === "DELETE") {
      // 删除素材时连带删除 sidecar 元数据；文件不存在按 404 返回。
      try {
        await rm(target, { force: true });
        await rm(mediaMetadataPath(target), { force: true });
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ deleted: true }));
      } catch {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "删除素材失败。" }));
      }
      return true;
    }
    try {
      // 缩略图会重复请求同一张原图：按大小与修改时间发 ETag，浏览器可用 304 复用缓存，避免整份重读。
      const info = await stat(target);
      const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
      const requestTag = req.headers["if-none-match"];
      if (typeof requestTag === "string" && requestTag.split(",").some((tag) => tag.trim() === etag)) {
        res.statusCode = 304;
        res.end();
        return true;
      }
      const bytes = await readFile(target);
      res.statusCode = 200;
      res.setHeader("Content-Type", mimeOf(target));
      res.end(bytes);
    } catch {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "文件不存在。" }));
    }
    return true;
  };
}
