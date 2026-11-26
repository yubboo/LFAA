// 聊天模式的会话时间分桶：今天 / 昨天 / 最近 7 天内；7 天以外不进列表（不删除，搜索仍可找到）。
// 纯函数，供左二栏分组与「最近」过滤共用。

/** 一个分桶：更新于今天、昨天，或最近 7 天内的更早几天（不含今天与昨天）。 */
export type ChatTimeBucket = "today" | "yesterday" | "last7";

/** 本地时区当天 0 点。 */
function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 两个时间点相差的本地日历天数（夏令时按四舍五入吸收 23/25 小时的偏差）。 */
function localDayDiff(from: number, to: number): number {
  return Math.round((startOfLocalDay(from) - startOfLocalDay(to)) / 86_400_000);
}

/**
 * 会话归到哪个时间桶：未来时间或非法时间按今天处理；相差 2–6 天算最近 7 天内；
 * 相差 7 天及以上返回 null，表示不再在列表里展示。
 */
export function chatTimeBucket(updatedAt: number, now = Date.now()): ChatTimeBucket | null {
  if (!Number.isFinite(updatedAt)) return "today";
  const diff = localDayDiff(now, updatedAt);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff <= 6) return "last7";
  return null;
}

/** 会话是否还在聊天列表的可见窗口内（最近 7 个自然日，含今天）。 */
export function isWithinChatWindow(updatedAt: number, now = Date.now()): boolean {
  return chatTimeBucket(updatedAt, now) !== null;
}

/** 把会话按时间桶拆开，桶内按最后更新时间倒序；7 天外的会话留在 hidden 里供调用方决定用途。 */
export function bucketChatSessions<T extends { updatedAt: number }>(
  sessions: readonly T[],
  now = Date.now(),
): { today: T[]; yesterday: T[]; last7: T[]; hidden: T[] } {
  const buckets: { today: T[]; yesterday: T[]; last7: T[]; hidden: T[] } = {
    today: [],
    yesterday: [],
    last7: [],
    hidden: [],
  };
  const sorted = [...sessions].sort((left, right) => right.updatedAt - left.updatedAt);
  for (const session of sorted) {
    const bucket = chatTimeBucket(session.updatedAt, now);
    if (!bucket) buckets.hidden.push(session);
    else buckets[bucket].push(session);
  }
  return buckets;
}