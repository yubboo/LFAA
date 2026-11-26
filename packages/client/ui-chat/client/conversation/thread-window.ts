// 消息列窗口化的常量与纯计算：阈值、行高估算、开关判定。与 DOM 无关，便于单测。
// 窗口化只决定「渲染哪一段、每行多高、占位多高」，滚动跟随仍由 useChatScroll 独占。

/** 消息条数超过该阈值才启用窗口化：短会话一次性渲染更简单，也避开窗口边缘的取整误差。 */
export const THREAD_WINDOW_THRESHOLD = 60;

/** 可视区上下各多渲染几行，保证快速滚动时不出现空白。 */
export const THREAD_WINDOW_OVERSCAN = 4;

/** 尚无测量值时的行高兜底；消息行普遍较高，估得太小会让滚动条严重失真。 */
export const THREAD_ESTIMATE_FALLBACK_PX = 320;

/** 是否启用窗口化：条数超过阈值，且没有通过偏好把它关掉。 */
export function shouldVirtualizeThread(messageCount: number, enabled: boolean): boolean {
  return enabled && messageCount > THREAD_WINDOW_THRESHOLD;
}

/** 行高估算：用本会话已测高度的均值；没有任何测量值时回落到固定值。 */
export function resolveRowEstimate(measured: readonly number[], fallback = THREAD_ESTIMATE_FALLBACK_PX): number {
  if (measured.length === 0) return fallback;
  let sum = 0;
  for (const value of measured) sum += value;
  const average = sum / measured.length;
  return average > 0 ? Math.round(average) : fallback;
}

/** 从虚拟化器的尺寸缓存里挑出属于当前会话的高度，用来算估算值。 */
export function pickSessionSizes(
  sizes: ReadonlyMap<string, number>,
  messageIds: ReadonlySet<string>,
): number[] {
  const picked: number[] = [];
  for (const [key, value] of sizes) {
    if (messageIds.has(key) && Number.isFinite(value) && value > 0) picked.push(value);
  }
  return picked;
}