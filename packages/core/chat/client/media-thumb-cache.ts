// 生成素材缩略图缓存：按需取原图后缩到 480px 的 WebP，存进 Cache Storage 供后续加载直接复用，避免整页 30+ 张原图同时解码。
import type { MediaLibraryItem } from "./media-library";

const CACHE_NAME = "lfaa-media-thumbs-v1";
const THUMB_WIDTH = 480;
const MAX_ENTRIES = 240;
const CONCURRENCY = 3;

/** 内存中的 object URL，避免同一页面反复从 Cache Storage 读盘；条目随缓存淘汰释放。 */
const memory = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
const queue: Array<() => void> = [];
let active = 0;
let storedSincePrune = 0;

/** 缩略图缓存键：文件变化（大小/时间）时自动失效。 */
export function buildThumbnailKey(item: MediaLibraryItem, width = THUMB_WIDTH): string {
  return `${item.path}|${item.bytes}|${item.createdAt}|${width}`;
}

/** Cache Storage 的键必须是合法 URL：把包含盘符的路径编码成同源路径，避免 put 时抛错。 */
function cacheUrl(key: string): string {
  return `${location.origin}/__lfaa_media_thumb__/${encodeURIComponent(key)}`;
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

/** Cache Storage 写入后按条目数淘汰最旧记录，避免缩略图无限增长。 */
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

/** 打开缩略图缓存；隐私模式或接口不可用时返回 null，调用方退回内存方案。 */
async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** 生成或读取一张缩略图，返回可直接给 <img> 的 object URL。 */
export async function getMediaThumbnail(item: MediaLibraryItem, width = THUMB_WIDTH): Promise<string | null> {
  if (item.kind === "audio") return null;
  const key = buildThumbnailKey(item, width);
  const cached = memory.get(key);
  if (cached) return cached;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const task = (async () => {
    const cache = await openCache();
    if (cache) {
      try {
        const hit = await cache.match(cacheUrl(key));
        if (hit) {
          const blob = await hit.blob();
          const url = URL.createObjectURL(blob);
          memory.set(key, url);
          return url;
        }
      } catch {
        // 缓存读取失败时继续走网络。
      }
    }

    return schedule(async () => {
      try {
        const res = await fetch(`/api/media/file?path=${encodeURIComponent(item.path)}`);
        if (!res.ok) return null;
        const source = await res.blob();
        let thumb: Blob | null;
        if (item.kind === "video") {
          thumb = await videoPoster(source, width);
        } else {
          thumb = await downscale(source, width);
        }
        if (!thumb) return null;
        const url = URL.createObjectURL(thumb);
        memory.set(key, url);
        if (cache) {
          try {
            await cache.put(cacheUrl(key), new Response(thumb, { headers: { "Content-Type": "image/webp" } }));
            await pruneCache(cache);
          } catch {
            // 写缓存失败不影响当前展示。
          }
        }
        return url;
      } catch {
        return null;
      }
    });
  })();

  pending.set(key, task);
  const url = await task.finally(() => {
    pending.delete(key);
  });
  return url;
}