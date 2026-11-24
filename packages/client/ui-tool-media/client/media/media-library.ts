// 生成素材（图片/视频/语音）的公开数据契约、列表读取与筛选；资料库「图像」分类与输入框素材库弹窗共用，不持有 React 状态。
/** 一条生成素材的展示类型。 */
export type MediaKind = "image" | "video" | "audio";

/** 素材库接口返回的单条记录（与宿主 /api/media/library 对齐）。 */
export interface MediaLibraryItem {
  path: string;
  name: string;
  kind: MediaKind;
  bytes: number;
  createdAt: number;
  prompt?: string;
  model?: string;
}

/** 素材类型筛选值。 */
export type MediaFilterKind = "all" | MediaKind;

/** 类型筛选标签：两处入口共用同一份中英文，避免文案漂移。 */
export const MEDIA_FILTER_OPTIONS: ReadonlyArray<{ id: MediaFilterKind; zh: string; en: string }> = [
  { id: "all", zh: "全部", en: "All" },
  { id: "image", zh: "图片", en: "Images" },
  { id: "video", zh: "视频", en: "Videos" },
  { id: "audio", zh: "语音", en: "Audio" },
];

/** 按类型取徽章文案，供卡片角标与筛选按钮共用。 */
export function mediaKindLabel(kind: MediaKind, isZh: boolean): string {
  return MEDIA_FILTER_OPTIONS.find((entry) => entry.id === kind)?.[isZh ? "zh" : "en"] ?? kind;
}

/** 把字节数格式化为 B / KB / MB，供素材卡片与资产卡片共用。 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 媒体文件接口地址：读取与删除都走这里，鉴权头由全局 fetch 包装注入。 */
export function mediaLibraryFileUrl(path: string): string {
  return `/api/media/file?path=${encodeURIComponent(path)}`;
}

/** 读取生成素材列表；只取最近 limit 条，失败时抛出由调用方展示。 */
export async function fetchMediaLibrary(limit = 120): Promise<MediaLibraryItem[]> {
  const res = await fetch(`/api/media/library?limit=${limit}`);
  if (!res.ok) throw new Error(`media library ${res.status}`);
  const data = (await res.json()) as { items?: MediaLibraryItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

/** 按类型与关键字过滤素材：关键字匹配文件名、提示词与模型。 */
export function filterMediaItems(
  items: readonly MediaLibraryItem[],
  filter: MediaFilterKind,
  query: string,
): MediaLibraryItem[] {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter !== "all" && item.kind !== filter) return false;
    if (!normalized) return true;
    return item.name.toLowerCase().includes(normalized)
      || Boolean(item.prompt && item.prompt.toLowerCase().includes(normalized))
      || Boolean(item.model && item.model.toLowerCase().includes(normalized));
  });
}