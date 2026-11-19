// 管理聊天视口的底部跟随，监听流式正文、工具和输入栏引起的高度变化。
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD = 24;

/** 新会话或发送新一轮时定位到最新消息，主动阅读历史时保留用户位置。 */
export function useChatScroll(sessionId: string | null, latestTurnId: string | undefined, streaming: boolean) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const lastScrollTop = useRef(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToLatest = useCallback(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    followBottom.current = true;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" });
    lastScrollTop.current = viewport.scrollTop;
    setShowScrollBottom(false);
  }, []);

  useLayoutEffect(() => {
    scrollToLatest();
  }, [sessionId, latestTurnId, scrollToLatest]);

  useLayoutEffect(() => {
    const viewport = scrollAreaRef.current;
    const thread = threadRef.current;
    if (!viewport || !thread) return;

    // 流结束时也定位一次，接住与最终正文一起出现的交付卡片。
    if (followBottom.current) scrollToLatest();
    const observer = new ResizeObserver(() => {
      if (streaming && followBottom.current) {
        scrollToLatest();
      } else {
        setShowScrollBottom(viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > BOTTOM_THRESHOLD);
      }
    });
    observer.observe(thread);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [sessionId, latestTurnId, streaming, scrollToLatest]);

  const trackScroll = (viewport: HTMLDivElement) => {
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const top = viewport.scrollTop;
    // 忽略程序定位后延迟到达的事件和内容缩短时浏览器对滚动位置的修正。
    const previousTop = Math.min(lastScrollTop.current, maxScrollTop);
    lastScrollTop.current = top;
    if (Math.abs(top - previousTop) < 1) return;

    const nearBottom = maxScrollTop - top <= BOTTOM_THRESHOLD;
    if (top < previousTop && !nearBottom) followBottom.current = false;
    if (top > previousTop && nearBottom) followBottom.current = true;
    setShowScrollBottom((!streaming || !followBottom.current) && !nearBottom);
  };

  const pauseFollowing = () => {
    followBottom.current = false;
  };

  return { scrollAreaRef, threadRef, showScrollBottom, scrollToLatest, pauseFollowing, trackScroll };
}
