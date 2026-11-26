// 会话滚动的纯逻辑：贴底判定、scroll 来源分类、跟随开关与滚动记忆存取。
// 与 React / 组件无关，便于单测；真实写入 scrollTop 只发生在 useChatScroll。

/** 距底容差：用户滚回这段距离内就恢复跟随；上滚超过它才显示「回到底部」。 */
export const BOTTOM_THRESHOLD = 28;

/** 贴底判定容差：滚动高度与可视高度都是取整值，相减可能比真实可滚终点少半像素。 */
const BOTTOM_EPSILON = 0.5;

/** 区分「自己写的 scrollTop」与用户位移的容差：程序写入后读回的 scrollTop 与写入值最多差半个像素。 */
const SELF_SCROLL_EPSILON = 0.5;

/** 每条会话的滚动记忆：刷新页面、切换排版、切回会话都按它复原，不再一律贴到底部。 */
const SCROLL_MEMORY_KEY = "lfaa:chat-scroll-memory";
const SCROLL_MEMORY_LIMIT = 40;

/** 用户滚动后落盘的防抖时间。 */
export const SCROLL_MEMORY_DEBOUNCE_MS = 300;

export interface ScrollMemoryEntry {
  top: number;
  atBottom: boolean;
}

type ScrollMemoryMap = Record<string, ScrollMemoryEntry>;

/**
 * 判断视口是否还需要补写 scrollTop 才是「真实底边」。
 * 取整尺寸算出的底边可能比真实底边高 0.3–0.9px，这点缝隙会让用户以为已经到底，
 * 却还能用滚轮把正文再推开 1–2px；所以只允许半个像素以内的误差。
 */
export function isOffBottom(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
  const targetTop = Math.max(0, scrollHeight - clientHeight);
  return Math.abs(scrollTop - targetTop) > BOTTOM_EPSILON;
}

/** 一次 scroll 事件的来源：自己写的、平滑动画、夹到新底边、还是用户在滚。 */
export type ViewportScrollSource = "self" | "smooth" | "bottom" | "user";

export interface ViewportScrollInput {
  top: number;
  /** 上一次事件记录的 scrollTop。 */
  previousTop: number;
  /** 我们最后一次写下去的位置；与 top 相等说明这次事件是自己导致的。 */
  expectedTop: number;
  /** 正在进行的平滑滚动目标；null 表示没有自动动画。 */
  smoothTarget: number | null;
  maxTop: number;
}

/**
 * 判定 scroll 事件的来源。
 * 关键点：不再用「程序化时间窗口」猜来源——流式输出时贴底写入每帧都在发生，时间窗口会把用户的滚轮
 * 一并吞掉，视口于是永远停在底部。这里改为比较实际写入值与目标位置，用户的位移一定能被识别出来。
 */
export function classifyViewportScroll(input: ViewportScrollInput): ViewportScrollSource {
  const { top, previousTop, expectedTop, smoothTarget, maxTop } = input;
  // 内容变短时浏览器会把 scrollTop 夹到新底边，这类事件必须算「到底」而不是用户上滚。
  if (maxTop - top <= BOTTOM_EPSILON) return "bottom";
  // 平滑动画的每帧都在靠近目标；距离没有变大就还是动画自己在走。
  if (smoothTarget !== null && Math.abs(top - smoothTarget) <= Math.abs(previousTop - smoothTarget)) return "smooth";
  if (Math.abs(top - expectedTop) <= SELF_SCROLL_EPSILON) return "self";
  return "user";
}

/** 按事件来源决定是否继续跟随：到底恢复跟随，用户上滚离开底部立即暂停。 */
export function resolveScrollFollow(
  follow: boolean,
  source: ViewportScrollSource,
  previousTop: number,
  top: number,
  gapToBottom: number,
): boolean {
  if (source === "bottom" || gapToBottom <= BOTTOM_THRESHOLD) return true;
  if (source === "user" && top < previousTop) return false;
  return follow;
}

/**
 * 内容长高后要不要「平滑让位」而不是直接贴底。
 * 只有真正的晚到小块（追问建议、改动卡片，通常一两百像素）才值得动画；
 * 一次涌入超过半屏的只可能是刷新/切会话后历史一次性挂载——那时做动画就是肉眼可见的
 * 「自动从顶部滚到最底部」，必须同步贴底。
 */
export function shouldSmoothReveal(gap: number, viewportHeight: number): boolean {
  return gap > BOTTOM_THRESHOLD && gap < viewportHeight * 0.5;
}

/**
 * 恢复会话时的落位目标。
 * 刷新后会话先渲染骨架、历史随后才挂载，此时容器只有几百像素高：直接写 `min(记忆位置, 可滚终点)`
 * 会被骨架高度夹到顶部，而且这一下滚动还会被当成「用户滚到了底部」。所以容器装不下记忆位置时
 * 先记着（pending），等高度涨够或连续两帧高度不再变化（说明内容已成型）再落位。
 */
export function resolveScrollRestore(
  savedTop: number,
  maxTop: number,
  previousHeight: number,
  height: number,
): { top: number; pending: boolean } {
  const target = Math.max(0, savedTop);
  const settled = previousHeight > 0 && previousHeight === height;
  return { top: Math.min(target, maxTop), pending: maxTop < target - BOTTOM_EPSILON && !settled };
}

/**
 * 这次滚轮是不是被内嵌的限高滚动区（思考正文、工具输出、步骤列表）吃掉了。
 * 内层还能往上滚时不该让会话视口交出跟随权，否则在内层读数就会悄悄停掉流式贴底。
 */
export function isNestedScrollConsumingUp(target: EventTarget | null, viewport: HTMLElement): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== viewport) {
    if (node instanceof HTMLElement) {
      const overflowY = getComputedStyle(node).overflowY;
      const scrollable = (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1;
      if (scrollable && node.scrollTop > 0) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** 读取滚动记忆；存储不可用或内容损坏时按空表处理。 */
export function readScrollMemory(): ScrollMemoryMap {
  try {
    const raw = localStorage.getItem(SCROLL_MEMORY_KEY);
    return raw ? (JSON.parse(raw) as ScrollMemoryMap) : {};
  } catch {
    return {};
  }
}

/** 写入滚动记忆，只保留最近若干条，避免无限增长。 */
export function writeScrollMemory(map: ScrollMemoryMap, sessionId: string, entry: ScrollMemoryEntry): void {
  map[sessionId] = entry;
  const keys = Object.keys(map);
  if (keys.length > SCROLL_MEMORY_LIMIT) {
    for (const key of keys.slice(0, keys.length - SCROLL_MEMORY_LIMIT)) delete map[key];
  }
  try {
    localStorage.setItem(SCROLL_MEMORY_KEY, JSON.stringify(map));
  } catch {
    void 0;
  }
}

/** 落盘当前会话的滚动位置：刷新回来停在原处。 */
export function rememberScrollPosition(sessionId: string, viewport: HTMLElement): void {
  const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  writeScrollMemory(readScrollMemory(), sessionId, {
    top: Math.round(viewport.scrollTop),
    atBottom: maxTop - viewport.scrollTop <= BOTTOM_THRESHOLD,
  });
}