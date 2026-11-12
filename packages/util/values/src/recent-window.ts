/**
 * 功能：按固定滚动时间窗筛选最近条目。
 * 作用：让会话、网站等列表复用同一组时间边界、无效时间处理与到期计算。
 * 关联文件：client/ui-workspace 的会话与 Browser 最近列表。
 */

export const RECENT_WINDOW_DEFAULT_DAYS = 3;
export const RECENT_WINDOW_DAY_MS = 24 * 60 * 60 * 1000;

export interface RecentWindowResult<T> {
  items: T[];
  nextExpiryAt: number | null;
}

/** 保留来源顺序；包含当前时刻，排除未来时间和超过 days 的记录，并返回下一条到期的时刻。 */
export function resolveRecentItems<T>(
  items: readonly T[],
  getTimestamp: (item: T) => string | number | null | undefined,
  now: number,
  windowDays = RECENT_WINDOW_DEFAULT_DAYS
): RecentWindowResult<T> {
  const windowMs = windowDays * RECENT_WINDOW_DAY_MS;
  if (!Number.isFinite(now) || !Number.isFinite(windowDays) || windowDays <= 0 || !Number.isFinite(windowMs)) {
    return { items: [], nextExpiryAt: null };
  }

  const visible: T[] = [];
  let nextExpiryAt: number | null = null;
  for (const item of items) {
    const timestamp = getTimestamp(item);
    const occurredAt = typeof timestamp === "number" ? timestamp : typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
    const age = now - occurredAt;
    if (!Number.isFinite(occurredAt) || age < 0 || age >= windowMs) continue;

    visible.push(item);
    const expiryAt = occurredAt + windowMs;
    if (nextExpiryAt === null || expiryAt < nextExpiryAt) nextExpiryAt = expiryAt;
  }

  return { items: visible, nextExpiryAt };
}
