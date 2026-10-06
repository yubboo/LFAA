/**
 * 功能：跟踪真实会话锚点与可见提问。
 * 作用：内容变化时按帧测量、判定最新消息提示，并让普通滚动使用缓存二分查找，避免遍历历史消息布局。
 * 关联文件：AiWorkChat.tsx；client-performance.test.mjs 验证合并、定位与卸载。
 */
export function shouldFollowLatestMessage(
  currentlyFollowing: boolean,
  userScrollDirection: "up" | "down" | null,
  distanceFromBottom: number
): boolean {
  if (userScrollDirection === "up") return false;
  if (userScrollDirection === "down" && distanceFromBottom <= 64) return true;
  return currentlyFollowing;
}

/** 只有保持跟随且内容布局变化时才调整位置，避免滚动帧覆盖自然/平滑滚动。 */
export function shouldAutoScrollToLatest(following: boolean, layoutChanged: boolean): boolean {
  return following && layoutChanged;
}

/** 刷新恢复或滚动后，仅在确有历史消息且离最新位置超过跟随缓冲区时显示提示。 */
export function shouldShowScrollToLatest(distanceFromBottom: number, messageCount: number): boolean {
  return messageCount > 0 && distanceFromBottom > 64;
}

/** 按提问数生成等距整数像素锚点；会话变长时轨道同步增长，达到视口上限后等距压缩。 */
export function buildConversationAnchorLayout(anchorCount: number, viewportHeight: number): { height: number; markHeight: number; hitAreaHeight: number; markOffset: number; positions: number[] } {
  const count = Math.max(0, Math.floor(anchorCount));
  if (count === 0) return { height: 0, markHeight: 2, hitAreaHeight: 0, markOffset: 0, positions: [] };

  const safeViewportHeight = Math.max(0, Math.round(viewportHeight));
  const minimumHeight = 64;
  const maximumHeight = Math.max(minimumHeight, Math.round(safeViewportHeight * .42));
  const step = Math.max(12, Math.min(16, Math.round(safeViewportHeight * .0125)));
  const padding = Math.ceil(step / 2);
  const naturalHeight = Math.max(minimumHeight, padding * 2 + step * (count - 1));
  // 容量极限下保留每个锚点至少 1px 的独立坐标；只在此极端情况下略超视口上限。
  const minimumDistinctHeight = padding * 2 + Math.max(0, count - 1);
  const height = Math.max(Math.min(naturalHeight, maximumHeight), minimumDistinctHeight);
  if (count === 1) return { height, markHeight: 2, hitAreaHeight: 12, markOffset: 5, positions: [Math.round(height / 2)] };

  const spacing = Math.max(1, Math.min(step, Math.floor((height - padding * 2) / (count - 1))));
  const occupiedHeight = spacing * (count - 1);
  const start = Math.floor((height - occupiedHeight) / 2);
  const markHeight = Math.min(2, spacing);
  const hitAreaHeight = Math.min(12, spacing);
  const markOffset = Math.floor(hitAreaHeight / 2) - Math.floor(markHeight / 2);
  return { height, markHeight, hitAreaHeight, markOffset, positions: Array.from({ length: count }, (_, index) => start + index * spacing) };
}

/** 在升序轨道坐标中查找最近锚点；相同距离时稳定选择较早一项。 */
export function findNearestConversationAnchorIndex(positions: number[], localY: number): number | null {
  if (!positions.length || !Number.isFinite(localY)) return null;

  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (positions[middle]! < localY) low = middle + 1;
    else high = middle;
  }

  const before = low - 1;
  const after = low;
  if (before < 0) return 0;
  if (after >= positions.length) return positions.length - 1;
  return localY - positions[before]! <= positions[after]! - localY ? before : after;
}

/** 将高频指针位置合并为一个待执行帧，并仅把该帧中的最新值交给读取逻辑。 */
export function createFrameCoalescer<T>(onFrame: (latestValue: T) => void) {
  let frame: number | null = null;
  let latestValue: T;
  let hasLatestValue = false;

  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    hasLatestValue = false;
  }

  return {
    schedule(value: T) {
      latestValue = value;
      hasLatestValue = true;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!hasLatestValue) return;
        hasLatestValue = false;
        onFrame(latestValue);
      });
    },
    cancel
  };
}

/** 只切换上一根与当前刻度的瞬时指针标记，不触发 React 消息树状态更新。 */
export function updateConversationAnchorPointerTarget(previous: HTMLElement | null, next: HTMLElement | null): HTMLElement | null {
  if (previous === next) return next;
  previous?.removeAttribute("data-pointer-active");
  next?.setAttribute("data-pointer-active", "true");
  return next;
}

export function createConversationScrollTracker(container: HTMLElement, onChange: (snapshot: {
  viewportHeight: number; activeId: string | null; lastId: string | null; layoutChanged: boolean;
}) => void) {
  let anchors: Array<{ id: string; top: number }> = [];
  let height = 0;
  let dirty = true;
  let pendingLayoutChange = false;
  let frame: number | null = null;
  let stopped = false;
  function update() {
    frame = null;
    if (stopped) return;
    const layoutChanged = pendingLayoutChange;
    pendingLayoutChange = false;
    if (dirty) {
      dirty = false;
      height = container.clientHeight;
      const containerTop = container.getBoundingClientRect().top;
      const scrollTop = container.scrollTop;
      anchors = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-anchor-id]"))
        .filter(element => element.dataset.aiAnchorId)
        .map(element => ({ id: element.dataset.aiAnchorId!, top: element.getBoundingClientRect().top - containerTop + scrollTop }));
    }
    const threshold = container.scrollTop + Math.min(128, height * .28);
    // 锚点按 DOM 正文顺序排列；普通滚动只访问数字索引，不再读取每个节点的外框。
    let start = 0, end = anchors.length;
    while (start < end) { const middle = (start + end) >>> 1; if (anchors[middle]!.top <= threshold) start = middle + 1; else end = middle; }
    onChange({ viewportHeight: height, activeId: anchors[Math.max(0, start - 1)]?.id ?? null, lastId: anchors.at(-1)?.id ?? null, layoutChanged });
  }
  function refresh(remeasureAnchors = false, layoutChanged = false) {
    if (stopped) return;
    dirty ||= remeasureAnchors;
    pendingLayoutChange ||= layoutChanged;
    if (frame === null) frame = requestAnimationFrame(update);
  }
  const observer = new ResizeObserver(() => refresh(true, true));
  // 后续消息中的图片异步加载也会改变锚点位置；捕获 load，不为每条消息另建观察器。
  const onContentLoad = () => refresh(true, true);
  container.addEventListener("load", onContentLoad, true);
  observer.observe(container);
  if (container.firstElementChild) observer.observe(container.firstElementChild);
  refresh(true);
  return { refresh, stop() { if (stopped) return; stopped = true; observer.disconnect(); container.removeEventListener("load", onContentLoad, true); if (frame !== null) cancelAnimationFrame(frame); frame = null; } };
}
