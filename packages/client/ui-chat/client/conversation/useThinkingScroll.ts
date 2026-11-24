// 管理思维链思考正文视口的滚动与边缘渐隐：流式思考时同步贴底，用户上滚阅读时立即暂停跟随，滚回底部自动恢复。
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent, type WheelEvent } from "react";

const SCROLL_EDGE_EPSILON = 2;
const FOLLOW_BOTTOM_THRESHOLD = 16;
const PROGRAMMATIC_SCROLL_WINDOW_MS = 80;
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** 思考正文滚动视口的溢出与边缘渐隐状态。 */
export interface ThinkingScrollEdges {
  fadeTop: boolean;
  fadeBottom: boolean;
  scrollable: boolean;
}

const EMPTY_EDGES: ThinkingScrollEdges = { fadeTop: false, fadeBottom: false, scrollable: false };

/** 计算思考正文滚动视口是否超出限高以及上下边缘渐隐标记。 */
export function measureThinkingScrollEdges(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): ThinkingScrollEdges {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  if (maxScrollTop <= SCROLL_EDGE_EPSILON) return EMPTY_EDGES;
  return {
    fadeTop: scrollTop > SCROLL_EDGE_EPSILON,
    fadeBottom: maxScrollTop - scrollTop > SCROLL_EDGE_EPSILON,
    scrollable: true,
  };
}

/** 按用户滚动方向与距底距离判定流式思考是否继续自动贴底跟随。 */
export function resolveThinkingFollowBottom(
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

/** 维护单个思维链块的内部滚动视口、流式自动贴底与边缘渐隐状态。 */
export function useThinkingScroll(open: boolean, hasBody: boolean, contentKey: string, live: boolean) {
  const [edges, setEdges] = useState<ThinkingScrollEdges>(EMPTY_EDGES);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const followBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const programmaticUntilRef = useRef(0);
  const prevLiveRef = useRef(live);

  const syncEdges = useCallback((viewport: HTMLDivElement) => {
    const next = measureThinkingScrollEdges(viewport.scrollTop, viewport.scrollHeight, viewport.clientHeight);
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

  // 进入新一轮实时思考或正文流式追加时同步贴底；思考结束与历史消息保持当前位置不跳动。
  useIsomorphicLayoutEffect(() => {
    if (live && !prevLiveRef.current) followBottomRef.current = true;
    prevLiveRef.current = live;

    if (!open || !hasBody) {
      setEdges(EMPTY_EDGES);
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (live && followBottomRef.current) pinToBottomSync(viewport);
    else syncEdges(viewport);
  }, [open, hasBody, contentKey, live, pinToBottomSync, syncEdges]);

  // 监听视口与内容尺寸变化（窗口缩放、侧栏切换等），及时更新渐隐提示与流式贴底。
  useIsomorphicLayoutEffect(() => {
    if (!open || !hasBody || typeof ResizeObserver === "undefined") return;
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
  }, [open, hasBody, live, pinToBottomSync, syncEdges]);

  // 流式高频更新期间用户向上滚轮时立即解除贴底，避免与用户抢滚动条。
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
    followBottomRef.current = resolveThinkingFollowBottom(followBottomRef.current, previousTop, top, maxScrollTop);
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
