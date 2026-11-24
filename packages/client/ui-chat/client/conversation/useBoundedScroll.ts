// 管理任意「限高滚动视口」的滚动与边缘渐隐：内容持续追加时同步贴底，用户上滚阅读时立即暂停跟随，滚回底部自动恢复。
// 思维链思考正文与浏览器子智能体步骤列表共用这一份实现，避免各自再写一套测量与跟随逻辑。
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent, type WheelEvent } from "react";

const SCROLL_EDGE_EPSILON = 2;
const FOLLOW_BOTTOM_THRESHOLD = 16;
const PROGRAMMATIC_SCROLL_WINDOW_MS = 80;
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** 限高滚动视口的溢出与边缘渐隐状态。 */
export interface BoundedScrollEdges {
  fadeTop: boolean;
  fadeBottom: boolean;
  scrollable: boolean;
}

const EMPTY_EDGES: BoundedScrollEdges = { fadeTop: false, fadeBottom: false, scrollable: false };

/** 计算内容是否超出限高，以及上下边缘是否需要渐隐。 */
export function measureBoundedScrollEdges(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): BoundedScrollEdges {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  if (maxScrollTop <= SCROLL_EDGE_EPSILON) return EMPTY_EDGES;
  return {
    fadeTop: scrollTop > SCROLL_EDGE_EPSILON,
    fadeBottom: maxScrollTop - scrollTop > SCROLL_EDGE_EPSILON,
    scrollable: true,
  };
}

/** 按用户滚动方向与距底距离判定是否继续自动贴底跟随。 */
export function resolveBoundedScrollFollow(
  currentFollow: boolean,
  previousScrollTop: number,
  scrollTop: number,
  maxScrollTop: number,
): boolean {
  const nearBottom = maxScrollTop - scrollTop <= FOLLOW_BOTTOM_THRESHOLD;
  if (scrollTop < previousScrollTop && !nearBottom) return false;
  if (nearBottom) return true;
  return currentFollow;
}

/** 维护单个限高滚动视口的内部滚动位置、实时贴底与边缘渐隐状态。 */
export function useBoundedScroll(open: boolean, hasContent: boolean, contentKey: string, live: boolean) {
  const [edges, setEdges] = useState<BoundedScrollEdges>(EMPTY_EDGES);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const followBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const programmaticUntilRef = useRef(0);
  const prevLiveRef = useRef(live);

  const syncEdges = useCallback((viewport: HTMLDivElement) => {
    const next = measureBoundedScrollEdges(viewport.scrollTop, viewport.scrollHeight, viewport.clientHeight);
    setEdges((prev) => (
      prev.fadeTop === next.fadeTop && prev.fadeBottom === next.fadeBottom && prev.scrollable === next.scrollable
        ? prev
        : next
    ));
  }, []);

  const pinToBottomSync = useCallback((viewport: HTMLDivElement) => {
    const targetTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (Math.abs(viewport.scrollTop - targetTop) >= 1) {
      programmaticUntilRef.current = performance.now() + PROGRAMMATIC_SCROLL_WINDOW_MS;
      viewport.scrollTop = viewport.scrollHeight;
    }
    lastScrollTopRef.current = viewport.scrollTop;
    syncEdges(viewport);
  }, [syncEdges]);

  const resumeFollowing = useCallback(() => {
    followBottomRef.current = true;
  }, []);

  // 进入新一轮实时输出或内容追加时同步贴底；结束与历史内容保持当前位置不跳动。
  useIsomorphicLayoutEffect(() => {
    if (live && !prevLiveRef.current) followBottomRef.current = true;
    prevLiveRef.current = live;

    if (!open || !hasContent) {
      setEdges(EMPTY_EDGES);
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (live && followBottomRef.current) pinToBottomSync(viewport);
    else syncEdges(viewport);
  }, [open, hasContent, contentKey, live, pinToBottomSync, syncEdges]);

  // 监听视口与内容尺寸变化（窗口缩放、侧栏切换等），及时更新渐隐提示与实时贴底。
  useIsomorphicLayoutEffect(() => {
    if (!open || !hasContent || typeof ResizeObserver === "undefined") return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const observer = new ResizeObserver(() => {
      if (live && followBottomRef.current) pinToBottomSync(viewport);
      else syncEdges(viewport);
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, hasContent, live, pinToBottomSync, syncEdges]);

  // 高频更新期间用户向上滚轮时立即解除贴底，避免与用户抢滚动条。
  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) followBottomRef.current = false;
  }, []);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const top = viewport.scrollTop;
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    syncEdges(viewport);

    if (performance.now() < programmaticUntilRef.current) {
      lastScrollTopRef.current = top;
      return;
    }
    const previousTop = Math.min(lastScrollTopRef.current, maxScrollTop);
    lastScrollTopRef.current = top;
    if (Math.abs(top - previousTop) < 1) return;
    followBottomRef.current = resolveBoundedScrollFollow(followBottomRef.current, previousTop, top, maxScrollTop);
  }, [syncEdges]);

  return {
    viewportRef,
    contentRef,
    edges,
    handleWheel,
    handleScroll,
    resumeFollowing,
  };
}