import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type SetStateAction, type UIEvent, type WheelEvent as ReactWheelEvent } from "react";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { createConversationScrollTracker, preserveConversationAnchorViewport, projectConversationWheelScroll, shouldAutoScrollToLatest, shouldFollowLatestMessage, shouldIgnoreMainConversationWheel, shouldRestoreConversationBottomPinned, shouldShowScrollToLatest, syncConversationScrollToLatest, updateResponseProcessFollowState, type NestedConversationScrollMetrics } from "../conversation-scroll.js";

type ScrollPointerDirection = "up" | "down";

interface AiConversationScrollOptions {
  userId: string;
  appId: string;
  activeSessionId: string | null;
  messagesReady: boolean;
  messagesSessionId: string | null;
  messages: readonly unknown[];
  initiallyPrepared: boolean;
  busy: boolean;
  reducedMotion: "on" | "off" | "system";
  setShowScrollToLatest: Dispatch<SetStateAction<boolean>>;
  setActiveAnchorId: Dispatch<SetStateAction<string | null>>;
  setAnchorViewportHeight: Dispatch<SetStateAction<number>>;
  stopPlayback: () => void;
}

/** 会话消息视口的滚动、锚点跟随和还原控制；消息内容及会话状态仍由 AiWorkChat 持有。 */
export function useAiConversationScroll(options: AiConversationScrollOptions) {
  const {
    userId, appId, activeSessionId, messagesReady, messagesSessionId, messages,
    initiallyPrepared, busy, reducedMotion, setShowScrollToLatest, stopPlayback
  } = options;
  const conversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
  const messagesElementRef = useRef<HTMLDivElement | null>(null);
  const olderMessagesScrollRestoreRef = useRef<{ height: number; top: number } | null>(null);
  const scrollTrackerRef = useRef<ReturnType<typeof createConversationScrollTracker> | null>(null);
  const activeScrollConversationRef = useRef<string | null>(null);
  const initializedScrollConversationRef = useRef<string | null>(null);
  const preparedScrollConversationRef = useRef<string | null>(initiallyPrepared ? conversationKey : null);
  const pointerScrollTopRef = useRef<number | null>(null);
  const pointerScrollDirectionRef = useRef<ScrollPointerDirection | null>(null);
  const followLatestMessageRef = useRef(true);
  const responseProcessDetailsRef = useRef(new Set<HTMLDetailsElement>());
  const followLatestBeforeResponseProcessRef = useRef<boolean | null>(null);
  const responseProcessUserScrolledRef = useRef(false);
  const responseProcessScrollAnchorRef = useRef<{ summary: HTMLElement; previousTop: number; frame: number | null; releaseFrame: number | null } | null>(null);

  useEffect(() => () => {
    const pending = responseProcessScrollAnchorRef.current;
    if (pending?.frame !== null && pending?.frame !== undefined) cancelAnimationFrame(pending.frame);
    if (pending?.releaseFrame !== null && pending?.releaseFrame !== undefined) cancelAnimationFrame(pending.releaseFrame);
    responseProcessScrollAnchorRef.current = null;
  }, []);

  const messagesScrollKey = createScrollRestorationKey(userId, "ai-messages", appId, activeSessionId ?? "new-session");
  const messagesReadyForScrollRestore = messagesReady && (!activeSessionId || messagesSessionId === activeSessionId);
  const messagesScroll = useScrollRestoration(
    messagesScrollKey,
    messagesReadyForScrollRestore,
    "element",
    undefined,
    {
      bottomPinnedKey: createScrollRestorationKey(userId, "ai-messages-follow-latest", appId, activeSessionId ?? "new-session"),
      isBottomPinned: () => followLatestMessageRef.current
    }
  );

  const setMessagesElement = useCallback((node: HTMLDivElement | null) => {
    messagesElementRef.current = node;
    messagesScroll.ref(node);
  }, [messagesScroll.ref]);

  const updateFollowFromUserScroll = useCallback((element: HTMLDivElement, direction: ScrollPointerDirection, projectedDistanceFromBottom?: number) => {
    const distanceFromBottom = projectedDistanceFromBottom ?? element.scrollHeight - element.scrollTop - element.clientHeight;
    if (responseProcessDetailsRef.current.size > 0) responseProcessUserScrolledRef.current = true;
    followLatestMessageRef.current = shouldFollowLatestMessage(followLatestMessageRef.current, direction, distanceFromBottom);
    setShowScrollToLatest(shouldShowScrollToLatest(distanceFromBottom, messages.length));
  }, [messages.length]);

  const handleResponseProcessClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const summary = event.target.closest("summary");
    const details = summary?.parentElement;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("ai-work-chat__response-process")) return;
    const container = messagesElementRef.current;
    if (container && summary instanceof HTMLElement) {
      const previous = responseProcessScrollAnchorRef.current;
      if (previous?.frame !== null && previous?.frame !== undefined) cancelAnimationFrame(previous.frame);
      if (previous?.releaseFrame !== null && previous?.releaseFrame !== undefined) cancelAnimationFrame(previous.releaseFrame);
      const snapshot = {
        summary,
        previousTop: previous?.summary === summary ? previous.previousTop : summary.getBoundingClientRect().top,
        frame: null as number | null,
        releaseFrame: null as number | null
      };
      responseProcessScrollAnchorRef.current = snapshot;
      details.addEventListener("toggle", () => {
        if (responseProcessScrollAnchorRef.current !== snapshot) return;
        snapshot.frame = requestAnimationFrame(() => {
          snapshot.frame = null;
          if (responseProcessScrollAnchorRef.current === snapshot && messagesElementRef.current === container && summary.isConnected) {
            preserveConversationAnchorViewport(container, summary, snapshot.previousTop);
          }
          // 滚动校正产生的 scroll 事件在下帧前处理；用户的真实滚动仍走原跟随逻辑。
          snapshot.releaseFrame = requestAnimationFrame(() => {
            if (responseProcessScrollAnchorRef.current === snapshot) {
              responseProcessScrollAnchorRef.current = null;
              scrollTrackerRef.current?.refresh();
            }
          });
        });
      }, { once: true });
    }
    if (!details.open && responseProcessDetailsRef.current.size === 0) responseProcessUserScrolledRef.current = false;
    const next = updateResponseProcessFollowState(
      responseProcessDetailsRef.current,
      details,
      !details.open,
      followLatestMessageRef.current,
      followLatestBeforeResponseProcessRef.current
    );
    followLatestBeforeResponseProcessRef.current = next.followingBeforeOpen;
    if (details.open && responseProcessDetailsRef.current.size === 0) {
      // 收起最后一个过程区时，保留展开期间用户主动滚动形成的新跟随状态。
      if (!responseProcessUserScrolledRef.current) followLatestMessageRef.current = next.following;
      responseProcessUserScrolledRef.current = false;
    } else {
      followLatestMessageRef.current = next.following;
    }
  }, []);

  const handleMessagesWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0 || event.ctrlKey) return;
    const element = event.currentTarget;
    const nestedScrollers: NestedConversationScrollMetrics[] = [];
    let ancestor = event.target instanceof Element ? event.target : null;
    while (ancestor && ancestor !== element) {
      if (ancestor instanceof HTMLElement && ancestor.matches(".ai-work-chat__tool-group-items, .ai-work-chat__markdown pre, .ai-work-chat__activity-output-card, .ai-work-chat__tool-contract-body")) {
        nestedScrollers.push({
          scrollTop: ancestor.scrollTop,
          scrollHeight: ancestor.scrollHeight,
          clientHeight: ancestor.clientHeight,
          overflowY: "auto",
          overscrollBehaviorY: "auto"
        });
      }
      ancestor = ancestor.parentElement;
    }
    if (shouldIgnoreMainConversationWheel(event.deltaY, nestedScrollers)) return;
    const projectedScroll = projectConversationWheelScroll(element.scrollTop, element.scrollHeight, element.clientHeight, event.deltaY);
    if (!projectedScroll) return;
    updateFollowFromUserScroll(element, projectedScroll.direction, projectedScroll.distanceFromBottom);
  }, [updateFollowFromUserScroll]);

  const handleMessagesPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const pointerOnScrollbar = event.clientX >= bounds.right - Math.max(14, element.offsetWidth - element.clientWidth);
    if (event.pointerType === "touch" || pointerOnScrollbar) {
      pointerScrollTopRef.current = element.scrollTop;
      pointerScrollDirectionRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    const restore = olderMessagesScrollRestoreRef.current;
    const element = messagesElementRef.current;
    if (!element) return;
    if (restore) {
      olderMessagesScrollRestoreRef.current = null;
      element.scrollTop = restore.top + element.scrollHeight - restore.height;
      return;
    }
    if (initializedScrollConversationRef.current === conversationKey) {
      syncConversationScrollToLatest(element, followLatestMessageRef.current);
    }
  }, [activeSessionId, appId, busy, messages]);

  const handleMessagesPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerScrollTopRef.current === null) return;
    pointerScrollTopRef.current = null;
    const pointerScrollDirection = pointerScrollDirectionRef.current;
    pointerScrollDirectionRef.current = null;
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (pointerScrollDirection === "down" && distanceFromBottom <= 64 && messages.length > 0) {
      followLatestMessageRef.current = true;
      setShowScrollToLatest(false);
    }
  }, [messages.length]);

  const handleMessagesScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const pointerScrollTop = pointerScrollTopRef.current;
    if (pointerScrollTop !== null && element.scrollTop !== pointerScrollTop) {
      const direction: ScrollPointerDirection = element.scrollTop < pointerScrollTop ? "up" : "down";
      pointerScrollDirectionRef.current = direction;
      updateFollowFromUserScroll(element, direction);
      pointerScrollTopRef.current = element.scrollTop;
    }
    messagesScroll.onScroll(event);
    const responseProcessAdjustment = (responseProcessDetailsRef.current.size > 0 && !responseProcessUserScrolledRef.current)
      || responseProcessScrollAnchorRef.current !== null;
    if (!responseProcessAdjustment) setShowScrollToLatest(shouldShowScrollToLatest(distanceFromBottom, messages.length));
    scrollTrackerRef.current?.refresh();
  }, [messages.length, messagesScroll.onScroll, updateFollowFromUserScroll]);

  const scrollToLatest = useCallback((smooth = false) => {
    const element = messagesElementRef.current;
    if (!element) return;
    if (responseProcessDetailsRef.current.size > 0) responseProcessUserScrolledRef.current = true;
    followLatestMessageRef.current = true;
    messagesScroll.saveBottomPinnedNow();
    stopPlayback();
    const useReducedMotion = reducedMotion === "on"
      || reducedMotion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !useReducedMotion) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    else element.scrollTop = element.scrollHeight;
    setShowScrollToLatest(false);
  }, [messagesScroll.saveBottomPinnedNow, reducedMotion, stopPlayback]);

  return {
    messagesElementRef,
    olderMessagesScrollRestoreRef,
    scrollTrackerRef,
    activeScrollConversationRef,
    initializedScrollConversationRef,
    preparedScrollConversationRef,
    pointerScrollTopRef,
    pointerScrollDirectionRef,
    followLatestMessageRef,
    responseProcessDetailsRef,
    followLatestBeforeResponseProcessRef,
    responseProcessUserScrolledRef,
    responseProcessScrollAnchorRef,
    messagesScroll,
    setMessagesElement,
    handleResponseProcessClickCapture,
    handleMessagesWheel,
    handleMessagesPointerDown,
    handleMessagesPointerUp,
    handleMessagesScroll,
    scrollToLatest
  };
}

interface AiConversationScrollLifecycleOptions {
  scroll: ReturnType<typeof useAiConversationScroll>;
  appId: string;
  activeSessionId: string | null;
  busy: boolean;
  messagesReady: boolean;
  messages: readonly unknown[];
  setShowScrollToLatest: Dispatch<SetStateAction<boolean>>;
  setActiveAnchorId: Dispatch<SetStateAction<string | null>>;
  setAnchorViewportHeight: Dispatch<SetStateAction<number>>;
}

/** 在会话消息切换后恢复跟随状态，并更新可见锚点。 */
export function useAiConversationScrollLifecycle(options: AiConversationScrollLifecycleOptions): void {
  const { scroll, appId, activeSessionId, busy, messagesReady, messages, setShowScrollToLatest, setActiveAnchorId, setAnchorViewportHeight } = options;
  const {
    activeScrollConversationRef, followLatestMessageRef, responseProcessDetailsRef,
    followLatestBeforeResponseProcessRef, responseProcessUserScrolledRef,
    responseProcessScrollAnchorRef, initializedScrollConversationRef,
    pointerScrollTopRef, pointerScrollDirectionRef, preparedScrollConversationRef,
    messagesElementRef, messagesScroll, scrollTrackerRef
  } = scroll;

  useLayoutEffect(() => {
    const conversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
    if (activeScrollConversationRef.current !== conversationKey) {
      activeScrollConversationRef.current = conversationKey;
      followLatestMessageRef.current = busy;
      responseProcessDetailsRef.current.clear();
      followLatestBeforeResponseProcessRef.current = null;
      responseProcessUserScrolledRef.current = false;
      initializedScrollConversationRef.current = null;
      pointerScrollTopRef.current = null;
      pointerScrollDirectionRef.current = null;
      if (busy) initializedScrollConversationRef.current = conversationKey;
    }
    if (!busy && messagesReady && preparedScrollConversationRef.current === conversationKey
      && initializedScrollConversationRef.current !== conversationKey) {
      const element = messagesElementRef.current;
      if (element) {
        let distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
        followLatestMessageRef.current = shouldRestoreConversationBottomPinned(messagesScroll.restoredBottomPinnedRef.current, distanceFromBottom);
        if (followLatestMessageRef.current) {
          syncConversationScrollToLatest(element, true);
          distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
        }
        setShowScrollToLatest(shouldShowScrollToLatest(distanceFromBottom, messages.length));
      }
      initializedScrollConversationRef.current = conversationKey;
    }
    scrollTrackerRef.current?.refresh(true);
  }, [activeSessionId, appId, busy, messages, messagesReady, messagesScroll.restoredBottomPinnedRef]);

  useEffect(() => {
    const element = messagesElementRef.current;
    if (!element || !messagesReady) return;
    const tracker = createConversationScrollTracker(element, ({ viewportHeight, activeId, lastId, layoutChanged }) => {
      setAnchorViewportHeight(current => current === viewportHeight ? current : viewportHeight);
      const responseProcessViewportAdjusting = responseProcessDetailsRef.current.size > 0 || responseProcessScrollAnchorRef.current !== null;
      if (!responseProcessViewportAdjusting && shouldAutoScrollToLatest(followLatestMessageRef.current, layoutChanged)) syncConversationScrollToLatest(element, true);
      if (followLatestMessageRef.current) {
        setActiveAnchorId(current => current === lastId ? current : lastId);
        if (!responseProcessViewportAdjusting) setShowScrollToLatest(false);
      } else {
        if (!responseProcessViewportAdjusting) setShowScrollToLatest(shouldShowScrollToLatest(element.scrollHeight - element.scrollTop - element.clientHeight, messages.length));
        setActiveAnchorId(current => current === activeId ? current : activeId);
      }
    });
    scrollTrackerRef.current = tracker;
    return () => { tracker.stop(); if (scrollTrackerRef.current === tracker) scrollTrackerRef.current = null; };
  }, [activeSessionId, appId, messagesReady]);
}
