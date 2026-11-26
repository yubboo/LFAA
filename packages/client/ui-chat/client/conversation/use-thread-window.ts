// 消息列窗口化 Hook：封装虚拟化器，只回答「渲染哪一段、每行多高、占位多高」。
// 滚动跟随（贴底、上滚不拽回、位置复原）仍由 useChatScroll 独占，这里不写 scrollTop、不接管 follow。
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatMessageItem } from "../store/chat-types";
import { pickSessionSizes, resolveRowEstimate, THREAD_ESTIMATE_FALLBACK_PX, THREAD_WINDOW_OVERSCAN } from "./thread-window";

/** 会话级高度均值缓存：切会话后仍能用上一轮测得的高度做首屏估算。 */
const sessionEstimates = new Map<string, number>();

/** 交给外部（聊天区）的窗口句柄：锚点跳转、搜索定位都走它，避免直接查 DOM。 */
export interface ThreadWindowHandle {
  /** 把指定消息滚进窗口；返回 false 表示这条消息不在当前会话里。 */
  scrollToMessage: (messageId: string, behavior?: ScrollBehavior) => boolean;
  /** 当前是否真的在窗口化：调用方据此决定要不要再按 DOM 精调位置。 */
  isWindowed: () => boolean;
}

export interface UseThreadWindowParams {
  enabled: boolean;
  sessionId: string | null;
  messages: ChatMessageItem[];
  scrollElementRef: { current: HTMLElement | null };
  handleRef?: { current: ThreadWindowHandle | null } | undefined;
  overscan?: number;
  /** 轨道相对滚动内容顶部的偏移（日期分隔条高度），让行偏移与滚动坐标对齐。 */
  scrollMargin?: number;
}

/** 供测试与调试读取的会话估算缓存（不参与渲染）。 */
export function readSessionEstimate(sessionId: string | null): number | null {
  return sessionId ? sessionEstimates.get(sessionId) ?? null : null;
}

export function useThreadWindow({
  enabled,
  sessionId,
  messages,
  scrollElementRef,
  handleRef,
  overscan = THREAD_WINDOW_OVERSCAN,
  scrollMargin = 0,
}: UseThreadWindowParams) {
  const ids = useMemo(() => messages.map((message) => message.id), [messages]);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const idsSet = useMemo(() => new Set(ids), [ids]);
  // 估算值走 ref：虚拟化器在测量阶段会同步调用 estimateSize，不能依赖渲染时机。
  const estimateRef = useRef<number>(readSessionEstimate(sessionId) ?? THREAD_ESTIMATE_FALLBACK_PX);

  const virtualizer = useVirtualizer({
    enabled,
    count: enabled ? messages.length : 0,
    getScrollElement: () => scrollElementRef.current,
    getItemKey: (index) => idsRef.current[index] ?? index,
    estimateSize: () => estimateRef.current,
    overscan,
    scrollMargin,
  });

  // 测量完成后把本会话的均值写回缓存：下次打开同一会话首屏估算更接近真实高度。
  useEffect(() => {
    if (!enabled) return;
    const sizes = pickSessionSizes(virtualizer.itemSizeCache as Map<string, number>, idsSet);
    if (sizes.length === 0) return;
    const next = resolveRowEstimate(sizes);
    estimateRef.current = next;
    if (sessionId) sessionEstimates.set(sessionId, next);
  });

  const scrollToMessage = useCallback((messageId: string, behavior: ScrollBehavior = "auto"): boolean => {
    // 未窗口化时所有消息都在 DOM 里，交给调用方按 DOM 精确滚动，避免虚拟化器空跑。
    if (!enabled) return false;
    const index = idsRef.current.indexOf(messageId);
    if (index < 0) return false;
    virtualizer.scrollToIndex(index, { align: "center", behavior });
    return true;
  }, [enabled, virtualizer]);

  useEffect(() => {
    if (!handleRef) return undefined;
    handleRef.current = { scrollToMessage, isWindowed: () => enabled };
    return () => {
      handleRef.current = null;
    };
  }, [enabled, handleRef, scrollToMessage]);

  const virtualItems = enabled ? virtualizer.getVirtualItems() : [];
  return {
    virtualizer,
    virtualItems,
    totalSize: enabled ? virtualizer.getTotalSize() : 0,
  };
}