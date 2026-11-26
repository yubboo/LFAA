// 管理聊天视口的贴底跟随与滚动记忆：跟随只在「跟底态」发生，用户一有上滚意图立即交出滚动所有权，
// 内容增长只在该状态下贴底；回合结束后晚到的一整块内容用一次平滑让位，避免与用户抢滚动条。
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  BOTTOM_THRESHOLD,
  SCROLL_MEMORY_DEBOUNCE_MS,
  classifyViewportScroll,
  isNestedScrollConsumingUp,
  isOffBottom,
  readScrollMemory,
  rememberScrollPosition,
  resolveScrollFollow,
  resolveScrollRestore,
  shouldSmoothReveal,
} from "./chat-scroll-model";

/** 滚轮事件里本 Hook 需要的最小形状：React 的 WheelEvent 可直接传入，单测里也能构造。 */
export interface ChatWheelLike {
  currentTarget: HTMLDivElement;
  target: EventTarget | null;
  deltaY: number;
}

/** 新会话或发送新一轮时定位到最新消息；主动上滚阅读历史时保留位置。 */
export function useChatScroll(sessionId: string | null, latestTurnId: string | undefined, streaming: boolean) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const lastScrollTop = useRef(0);
  /** 最后一次由程序写入的位置：scroll 事件与它相等就是自己造成的，不能当成用户上滚。 */
  const expectedTop = useRef(0);
  /** 正在进行的自动平滑滚动目标（回到底部、晚到内容让位）；有值时动画帧不算用户滚动。 */
  const smoothTarget = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;
  const saveTimerRef = useRef<number | null>(null);
  /** 会话切回时待落位的记忆位置：骨架期容器太矮，先记着，等真实历史挂载完再落位。 */
  const pendingRestore = useRef<number | null>(null);
  /** 上一次待落位时的内容高度，用来判断「内容已停止增长」。 */
  const pendingHeight = useRef(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  /**
   * 把待落位的记忆位置写下去；容器还装不下目标时继续等（`settle` 为真时才允许用「高度不再变化」收尾，
   * 避免同一次写入引发的 scroll 事件就把等待状态结束掉）。
   */
  const applyPendingRestore = useCallback((viewport: HTMLDivElement, settle: boolean) => {
    if (pendingRestore.current === null) return;
    const resolution = resolveScrollRestore(
      pendingRestore.current,
      Math.max(0, viewport.scrollHeight - viewport.clientHeight),
      settle ? pendingHeight.current : 0,
      viewport.scrollHeight,
    );
    if (Math.abs(viewport.scrollTop - resolution.top) > 0.5) viewport.scrollTop = resolution.top;
    expectedTop.current = viewport.scrollTop;
    lastScrollTop.current = viewport.scrollTop;
    if (settle) pendingHeight.current = resolution.pending ? viewport.scrollHeight : 0;
    pendingRestore.current = resolution.pending ? pendingRestore.current : null;
  }, []);

  /** 同步贴底（ResizeObserver 绘制前与初始定位）：只在跟底态调用，写完立即记录坐标供 trackScroll 识别。 */
  const pinToBottomSync = useCallback(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    followBottom.current = true;
    smoothTarget.current = null;
    // 按半个像素判定，并把 scrollTop 写到 scrollHeight，由浏览器夹到真实底边。
    if (isOffBottom(viewport.scrollTop, viewport.scrollHeight, viewport.clientHeight)) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    expectedTop.current = viewport.scrollTop;
    lastScrollTop.current = viewport.scrollTop;
    setShowScrollBottom((prev) => (prev ? false : prev));
  }, []);

  /** 点击「回到底部」时平滑回底，并重新开启自动跟随。 */
  const scrollToLatest = useCallback(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    pendingRestore.current = null;
    pendingHeight.current = 0;
    followBottom.current = true;
    smoothTarget.current = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    lastScrollTop.current = viewport.scrollTop;
    setShowScrollBottom((prev) => (prev ? false : prev));
  }, []);

  useLayoutEffect(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport || !sessionId) return;
    pendingRestore.current = null;
    pendingHeight.current = 0;
    const saved = readScrollMemory()[sessionId];
    if (!saved) {
      pinToBottomSync();
      return;
    }
    // 有记忆就复原：在底部就继续跟底，停在中间就回到中间，别再把用户拽走。
    followBottom.current = saved.atBottom;
    if (saved.atBottom) {
      viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      expectedTop.current = viewport.scrollTop;
      lastScrollTop.current = viewport.scrollTop;
      setShowScrollBottom((prev) => (prev ? false : prev));
      return;
    }
    // 中间位置不能立刻写：刷新后先有骨架、历史随后挂载，此时写下去会被骨架高度夹到顶部。
    pendingRestore.current = saved.top;
    applyPendingRestore(viewport, false);
    setShowScrollBottom(false);
  }, [sessionId, pinToBottomSync, applyPendingRestore]);

  useLayoutEffect(() => {
    if (!followBottom.current) return;
    pinToBottomSync();
  }, [latestTurnId, pinToBottomSync]);

  // 离开会话、卸载页面或关标签页时把当前位置落盘：滚完立刻 F5 也不会回到上一次的位置。
  useLayoutEffect(() => {
    if (!sessionId) return undefined;
    const viewport = scrollAreaRef.current;
    const flush = () => {
      if (viewport) rememberScrollPosition(sessionId, viewport);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [sessionId]);

  useLayoutEffect(() => {
    const viewport = scrollAreaRef.current;
    const thread = threadRef.current;
    if (!viewport || !thread) return;

    if (pendingRestore.current !== null) applyPendingRestore(viewport, true);
    else if (followBottom.current) pinToBottomSync();
    const observer = new ResizeObserver(() => {
      // 待落位的记忆优先：容器长够（或内容停止增长）再落到记忆位置，期间不跟底。
      if (pendingRestore.current !== null) {
        applyPendingRestore(viewport, true);
        return;
      }
      // 只在跟底态写 scrollTop：用户上滚之后内容再长高也绝不把视口拽回底部。
      if (!followBottom.current) return;
      if (!streaming) {
        // 回合结束后才挂载的整块内容（追问建议、改动卡片）平滑让位一次；
        // 动画在途时只把目标推进到新的底边，不重复发起，避免「每帧一个新动画」把位置来回拉扯。
        if (smoothTarget.current !== null) {
          smoothTarget.current = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
          return;
        }
        const gap = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        if (shouldSmoothReveal(gap, viewport.clientHeight)) {
          smoothTarget.current = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
          return;
        }
      }
      pinToBottomSync();
    });
    observer.observe(thread);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [sessionId, latestTurnId, streaming, pinToBottomSync]);

  /** 用户滚动后防抖存档，刷新或切换排版回来时按这个位置复原。 */
  const persistSoon = useCallback(() => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const viewportNow = scrollAreaRef.current;
      const id = sessionIdRef.current;
      if (viewportNow && id) rememberScrollPosition(id, viewportNow);
    }, SCROLL_MEMORY_DEBOUNCE_MS);
  }, []);

  /**
   * 消费一次 scroll 事件；返回 true 表示这次滚动由本 Hook 自己产生，外层可以跳过昂贵的锚点测量。
   */
  const trackScroll = useCallback((viewport: HTMLDivElement): boolean => {
    // 记忆落位期间：自己写下去的回声不参与来源判定（否则骨架那一下会被当成「滚到底」）；
    // 位置被人为改动则说明用户自己动手了，放弃记忆、按正常滚动继续判定。
    if (pendingRestore.current !== null) {
      if (Math.abs(viewport.scrollTop - expectedTop.current) <= 1) {
        applyPendingRestore(viewport, false);
        return true;
      }
      pendingRestore.current = null;
      pendingHeight.current = 0;
    }
    const top = viewport.scrollTop;
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const previousTop = lastScrollTop.current;
    const source = classifyViewportScroll({
      top,
      previousTop,
      expectedTop: expectedTop.current,
      smoothTarget: smoothTarget.current,
      maxTop,
    });
    lastScrollTop.current = top;
    expectedTop.current = top;

    if (source === "bottom") {
      smoothTarget.current = null;
      followBottom.current = true;
      setShowScrollBottom((prev) => (prev ? false : prev));
      persistSoon();
      return true;
    }
    if (source !== "user") return true;

    smoothTarget.current = null;
    followBottom.current = resolveScrollFollow(followBottom.current, source, previousTop, top, maxTop - top);
    const shouldShow = !followBottom.current && maxTop - top > BOTTOM_THRESHOLD;
    setShowScrollBottom((prev) => (prev === shouldShow ? prev : shouldShow));
    persistSoon();
    return false;
  }, [persistSoon, applyPendingRestore]);

  /**
   * 滚轮向上时在默认滚动发生前就交出跟随权：只靠 scroll 事件会让贴底写入抢在事件之前，
   * 用户看到的就是「往上滚一下又被拽回底部」。
   */
  const handleWheel = useCallback((event: ChatWheelLike) => {
    if (event.deltaY >= 0) return;
    const viewport = event.currentTarget;
    if (isNestedScrollConsumingUp(event.target, viewport)) return;
    // 用户自己动了滚轮：放弃尚未落位的记忆位置，以他为准。
    pendingRestore.current = null;
    pendingHeight.current = 0;
    followBottom.current = false;
    if (smoothTarget.current !== null) {
      // 正在平滑回底时用户抢了滚轮：立刻中止动画，别继续往下拖。
      smoothTarget.current = null;
      viewport.scrollTop = viewport.scrollTop;
    }
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const shouldShow = maxTop - viewport.scrollTop > BOTTOM_THRESHOLD;
    setShowScrollBottom((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const pauseFollowing = useCallback(() => {
    pendingRestore.current = null;
    pendingHeight.current = 0;
    followBottom.current = false;
  }, []);

  return {
    scrollAreaRef,
    threadRef,
    showScrollBottom,
    scrollToLatest,
    pauseFollowing,
    trackScroll,
    handleWheel,
  };
}