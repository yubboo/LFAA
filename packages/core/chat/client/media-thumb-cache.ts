// 生成素材缩略图缓存：优先用宿主磁盘缓存，其次浏览器缓存；缺失时只取一次原图并缩成 480/960px WebP，回传宿主供所有客户端复用。
import type { MediaLibraryItem } from "./media-library";

const CACHE_NAME = "lfaa-media-thumbs-v2";
const LEGACY_CACHE_NAME = "lfaa-media-thumbs-v1";
/** 网格缩略图宽度。 */
export const THUMB_WIDTH = 480;
/** 右栏预览宽度：足够面板显示，又不读整份原图。 */
export const PREVIEW_WIDTH = 960;
const MAX_ENTRIES = 240;
const CONCURRENCY = 3;

const memory = new Map<string, string>();
const pending = new Map<string, Promise<void>>();
const hostMisses = new Set<string>();
const queue: Array<() => void> = [];
let active = 0;
let storedSincePrune = 0;
let hostState: "unknown" | "ready" | "unsupported" = "unknown";

/** 缩略图缓存键：文件变化（大小/时间）时自动失效。 */
export function buildThumbnailKey(item: MediaLibraryItem, width = THUMB_WIDTH): string {
  return `${item.path}|${item.bytes}|${item.createdAt}|${width}`;
}

function sourceKeyOf(item: MediaLibraryItem): string {
  return `${item.path}|${item.bytes}|${item.createdAt}`;
}

// v1 曾把 204/HTML 响应当成缩略图缓存；升级时直接丢弃旧缓存，避免坏图继续命中。
if (typeof caches !== "undefined") {
  void caches.delete(LEGACY_CACHE_NAME).catch(() => {});
}

/** 校验缓存里的内容确实是 WebP，坏条目会被删除并重新生成。 */
async function isWebpBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 12) return false;
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number): string => String.fromCharCode(...head.slice(start, end));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

/** Cache Storage 的键必须是合法 URL：把包含盘符的路径编码成同源路径。 */
function cacheUrl(key: string): string {
  return `${location.origin}/__lfaa_media_thumb__/${encodeURIComponent(key)}`;
}

function hostThumbUrl(item: MediaLibraryItem, width: number): string {
  return `/api/media/thumb?path=${encodeURIComponent(item.path)}&w=${width}`;
}

/** 限制同时进行的解码/下载，避免一次打开资料库就发起几十个原图请求。 */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          const next = queue.shift();
          if (next) next();
        });
    };
    if (active < CONCURRENCY) run();
    else queue.push(run);
  });
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** 命中浏览器缓存时返回 object URL，并写入内存索引。 */
async function readBrowserCache(cache: Cache | null, key: string): Promise<string | null> {
  if (!cache) return null;
  try {
    const hit = await cache.match(cacheUrl(key));
    if (!hit) return null;
    const blob = await hit.blob();
    if (!(await isWebpBlob(blob))) {
      // 旧版本可能缓存了空 blob 或 HTML；删掉后走重新生成。
      await cache.delete(cacheUrl(key)).catch(() => {});
      return null;
    }
    const url = URL.createObjectURL(blob);
    memory.set(key, url);
    return url;
  } catch {
    return null;
  }
}

/** 宿主缩略图接口：200 为命中，204 为尚未生成，404/网络错误视为不可用（本次会话不再尝试）。 */
async function readHostThumb(item: MediaLibraryItem, width: number, cache: Cache | null): Promise<string | null> {
  if (hostState === "unsupported") return null;
  const key = buildThumbnailKey(item, width);
  if (hostMisses.has(key)) return null;
  try {
    const res = await fetch(hostThumbUrl(item, width), { cache: "no-store" });
    // 204 表示宿主还没有该缩略图（Response.ok 对 204 也是 true，必须先判 204）。
    if (res.status === 204) {
      hostState = "ready";
      hostMisses.add(key);
      return null;
    }
    if (res.status === 200) {
      // 旧宿主没有该路由时，未知 /api 路径会落到 SPA，返回 200 HTML；必须校验内容类型，否则会把 HTML 当图片。
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/webp")) {
        hostState = "unsupported";
        return null;
      }
      hostState = "ready";
      hostMisses.delete(key);
      const blob = await res.blob();
      if (!(await isWebpBlob(blob))) {
        // 宿主返回了非 WebP（例如旧版本 SPA 回退或损坏文件），不要缓存。
        hostState = "unsupported";
        return null;
      }
      const url = URL.createObjectURL(blob);
      memory.set(key, url);
      if (cache) {
        try {
          await cache.put(cacheUrl(key), new Response(blob, { headers: { "Content-Type": "image/webp" } }));
        } catch {
          // 写浏览器缓存失败不影响展示。
        }
      }
      return url;
    }
    if (res.status === 404) hostState = "unsupported";
    return null;
  } catch {
    return null;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** 回传成功后清掉“宿主缺失”标记，后续同宽度直接命中。 */
async function uploadHostThumb(item: MediaLibraryItem, width: number, blob: Blob): Promise<void> {
  if (hostState === "unsupported") return;
  try {
    const res = await fetch(hostThumbUrl(item, width), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: await blobToBase64(blob) }),
    });
    if (res.status === 204) {
      hostState = "ready";
      hostMisses.delete(buildThumbnailKey(item, width));
    }
  } catch {
    // 回传失败时保留浏览器缓存，下次再试。
  }
}

/** 浏览器端缩图：解码原图后画进 canvas，输出 WebP；不支持时退回原图。 */
async function downscale(blob: Blob, width: number): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return blob;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, width / bitmap.width);
    if (scale >= 1) return blob;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((next) => resolve(next ?? blob), "image/webp", 0.82));
  } catch {
    return blob;
  } finally {
    bitmap?.close();
  }
}

/** 视频只取首帧做封面，避免把整段视频留在缩略图里。 */
async function videoPoster(blob: Blob, width: number): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
      video.load();
    });
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.onseeked = done;
      try {
        video.currentTime = Math.min(0.2, (video.duration || 1) / 10);
      } catch {
        resolve();
      }
      setTimeout(done, 500);
    });
    const sourceWidth = video.videoWidth || width;
    const sourceHeight = video.videoHeight || width;
    const scale = Math.min(1, width / sourceWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((next) => resolve(next), "image/webp", 0.82));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pruneCache(cache: Cache): Promise<void> {
  storedSincePrune += 1;
  if (storedSincePrune < 20) return;
  storedSincePrune = 0;
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  for (const request of keys.slice(0, keys.length - MAX_ENTRIES)) {
    await cache.delete(request);
  }
}

/** 只生成当前需要的尺寸：网格要 480，右栏点开时才生成 960，避免首次加载多算一遍。 */
async function buildVariants(item: MediaLibraryItem, requestedWidth: number): Promise<void> {
  const widths = [requestedWidth];
  const cache = await openCache();
  const missing: number[] = [];
  for (const width of widths) {
    const key = buildThumbnailKey(item, width);
    if (memory.has(key)) continue;
    if (await readBrowserCache(cache, key)) continue;
    if (await readHostThumb(item, width, cache)) continue;
    missing.push(width);
  }
  if (missing.length === 0) return;

  await schedule(async () => {
    try {
      const res = await fetch(`/api/media/file?path=${encodeURIComponent(item.path)}`);
      if (!res.ok) return;
      const source = await res.blob();
      for (const width of missing) {
        const thumb = item.kind === "video" ? await videoPoster(source, width) : await downscale(source, width);
        if (!thumb) continue;
        // 缩图失败时会退回原图；原图不是 WebP 时只用于当前展示，不写入缓存、不回传宿主。
        const cacheable = thumb.type === "image/webp";
        const key = buildThumbnailKey(item, width);
        memory.set(key, URL.createObjectURL(thumb));
        if (cache && cacheable) {
          try {
            await cache.put(cacheUrl(key), new Response(thumb, { headers: { "Content-Type": "image/webp" } }));
            await pruneCache(cache);
          } catch {
            // 写缓存失败不影响当前展示。
          }
        }
        if (cacheable) void uploadHostThumb(item, width, thumb);
      }
    } catch {
      // 读取原图失败时保持占位，界面显示通用图标。
    }
  });
}

/** 生成或读取一张缩略图，返回可直接给 <img> 的 object URL。 */
export async function getMediaThumbnail(item: MediaLibraryItem, width = THUMB_WIDTH): Promise<string | null> {
  if (item.kind === "audio") return null;
  const key = buildThumbnailKey(item, width);
  const cached = memory.get(key);
  if (cached) return cached;

  const cache = await openCache();
  const browserHit = await readBrowserCache(cache, key);
  if (browserHit) return browserHit;

  const sourceKey = sourceKeyOf(item);
  let task = pending.get(sourceKey);
  if (!task) {
    task = buildVariants(item, width).finally(() => pending.delete(sourceKey));
    pending.set(sourceKey, task);
  }
  await task;
  const ready = memory.get(key);
  if (ready) return ready;

  // 同一张图刚为别的宽度跑过任务时，再补一次当前宽度（例如网格先要 480、右栏随后要 960）。
  task = buildVariants(item, width).finally(() => pending.delete(sourceKey));
  pending.set(sourceKey, task);
  await task;
  return memory.get(key) ?? null;
}