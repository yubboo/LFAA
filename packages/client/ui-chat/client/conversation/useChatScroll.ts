// 管理聊天视口的底部跟随：在 ResizeObserver 绘制前同步贴底消除一帧跳动与闪白，用户主动上滚时立即暂停跟随。
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD = 28;

/** 贴底判定的容差：滚动高度与可视高度都是取整值，两者相减可能比真实可滚终点少半像素。 */
const BOTTOM_EPSILON = 0.5;

/**
 * 判断视口是否还需要补写 scrollTop 才是「真实底边」。
 * 取整尺寸算出的底边可能比真实底边高 0.3–0.9px，这点缝隙会让用户以为已经到底，
 * 却还能用滚轮把正文再推开 1–2px；所以只允许半个像素以内的误差。
 */
export function isOffBottom(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
  const targetTop = Math.max(0, scrollHeight - clientHeight);
  return Math.abs(scrollTop - targetTop) > BOTTOM_EPSILON;
}

/** 晚到内容（追问建议、改动卡片）让位时的平滑滚动窗口，供 trackScroll 忽略这次程序化滚动。 */
const REVEAL_WINDOW_MS = 420;

/** 新会话或发送新一轮时定位到最新消息，流式输出在同一绘制帧内无闪烁贴底，主动上滚阅读历史时保留位置。 */
export function useChatScroll(sessionId: string | null, latestTurnId: string | undefined, streaming: boolean) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const lastScrollTop = useRef(0);
  const programmaticUntilRef = useRef(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  /** 直接同步贴底（用于 ResizeObserver 绘制前与初始定位），避免推迟到下一帧 RAF 造成一帧抖动和闪白。 */
  const pinToBottomSync = useCallback(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    followBottom.current = true;
    // scrollHeight / clientHeight 都是取整结果，二者相减可能比真实可滚终点少 0.3–0.9px；
    // 只补「差满 1px」会把这半像素留在最底部，用户悬停后拿滚轮还能把正文推开一点点。
    // 因此按半个像素判定，并把 scrollTop 写到 scrollHeight，由浏览器夹到真实底边。
    if (isOffBottom(viewport.scrollTop, viewport.scrollHeight, viewport.clientHeight)) {
      programmaticUntilRef.current = performance.now() + 120;
      viewport.scrollTop = viewport.scrollHeight;
    }
    lastScrollTop.current = viewport.scrollTop;
    setShowScrollBottom((prev) => (prev ? false : prev));
  }, []);

  /** 点击「回到底部」时平滑回底，并重新开启自动跟随。 */
  const scrollToLatest = useCallback(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    followBottom.current = true;
    programmaticUntilRef.current = performance.now() + 350;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    lastScrollTop.current = viewport.scrollTop;
    setShowScrollBottom((prev) => (prev ? false : prev));
  }, []);

  useLayoutEffect(() => {
    pinToBottomSync();
  }, [sessionId, latestTurnId, pinToBottomSync]);

  useLayoutEffect(() => {
    const viewport = scrollAreaRef.current;
    const thread = threadRef.current;
    if (!viewport || !thread) return;

    if (followBottom.current) pinToBottomSync();
    // ResizeObserver 本身在每帧 Paint 前触发一次；在此同步赋值 scrollTop 可让新增行在同一帧到位，彻底消除一帧闪跳。
    const observer = new ResizeObserver(() => {
      if (!followBottom.current) {
        const awayFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > BOTTOM_THRESHOLD;
        setShowScrollBottom((prev) => (prev === awayFromBottom ? prev : awayFromBottom));
        return;
      }
      // 回合结束后才挂载的内容（追问建议、已编辑文件、用时行）会单独触发一次尺寸变化。
      // 用户此时正停在底部，所以要让新内容可见；但绝不能在 ResizeObserver 里同步写 scrollTop
      // 或改 React 状态——那会形成「重排 → 回调 → 再重排」的抖动（实测会整屏抖）。
      // 做法：下一帧再发起一次平滑滚动到底，期间不触发任何重渲染。
      const gap = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (gap <= BOTTOM_EPSILON) {
        lastScrollTop.current = viewport.scrollTop;
        return;
      }
      if (!streaming && gap > BOTTOM_THRESHOLD) {
        lastScrollTop.current = viewport.scrollTop;
        followBottom.current = true;
        window.requestAnimationFrame(() => {
          if (!followBottom.current) return;
          programmaticUntilRef.current = performance.now() + REVEAL_WINDOW_MS;
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        });
        return;
      }
      if (!streaming) {
        // ≤28px 的小增量（行高/取整微差）直接精确贴底，避免留下「还能再推一下」的缝隙。
        pinToBottomSync();
        return;
      }
      pinToBottomSync();
    });
    observer.observe(thread);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [sessionId, latestTurnId, streaming, pinToBottomSync]);

  /** 判定当前 scroll 事件是否由自动贴底触发，供外层跳过昂贵的锚点布局测量。 */
  const isProgrammaticScroll = useCallback(() => performance.now() < programmaticUntilRef.current, []);

  const trackScroll = useCallback((viewport: HTMLDivElement) => {
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const top = viewport.scrollTop;
    // 程序贴底窗口内直接同步基线，避免流式增高瞬间误判「离开底部」而把回底浮钮闪现又撤回。
    if (performance.now() < programmaticUntilRef.current) {
      lastScrollTop.current = top;
      if (followBottom.current) setShowScrollBottom((prev) => (prev ? false : prev));
      return;
    }

    const previousTop = Math.min(lastScrollTop.current, maxScrollTop);
    lastScrollTop.current = top;
    if (Math.abs(top - previousTop) < 1) return;

    const nearBottom = maxScrollTop - top <= BOTTOM_THRESHOLD;
    if (top < previousTop && !nearBottom) followBottom.current = false;
    else if (top > previousTop && nearBottom) followBottom.current = true;
    // 仍处于自动跟随时绝不闪出回底按钮，只有用户明确上滚暂停跟随时才显示。
    const shouldShow = !followBottom.current && !nearBottom;
    setShowScrollBottom((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const pauseFollowing = useCallback(() => {
    followBottom.current = false;
  }, []);

  return {
    scrollAreaRef,
    threadRef,
    showScrollBottom,
    scrollToLatest,
    pauseFollowing,
    trackScroll,
    isProgrammaticScroll,
  };
}
