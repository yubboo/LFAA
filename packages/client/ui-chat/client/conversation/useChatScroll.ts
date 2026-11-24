// 管理聊天视口的底部跟随：在 ResizeObserver 绘制前同步贴底消除一帧跳动与闪白，用户主动上滚时立即暂停跟随。
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD = 28;

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
    const targetTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (Math.abs(viewport.scrollTop - targetTop) >= 1) {
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
      if (followBottom.current) {
        pinToBottomSync();
      } else {
        const awayFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > BOTTOM_THRESHOLD;
        setShowScrollBottom((prev) => (prev === awayFromBottom ? prev : awayFromBottom));
      }
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
