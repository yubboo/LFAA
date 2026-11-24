// 聊天 Store 精确切片订阅 Hook：仅在所选字段实际变化时触发组件重渲染，避免流式增量引起整页陪跑。
import { useRef, useSyncExternalStore } from "react";
import type { ChatClientStore } from "./chat-store";
import type { ChatStoreSnapshot } from "./chat-types";

/** 浅比较两个对象或值是否等价，用于 useChatSelector 缓存命中判定。 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key) || !Object.is(aObj[key], bObj[key])) {
      return false;
    }
  }
  return true;
}

/** 订阅聊天 Store 的最小状态切片；相邻快照经比较相等时复用旧引用，React 直接跳过重渲染。 */
export function useChatSelector<T>(
  store: ChatClientStore,
  selector: (snapshot: ChatStoreSnapshot) => T,
  isEqual: (prev: T, next: T) => boolean = shallowEqual,
): T {
  const cacheRef = useRef<{ snapshot: ChatStoreSnapshot; value: T } | null>(null);
  const getSnapshot = (): T => {
    const snap = store.getSnapshot();
    const cached = cacheRef.current;
    if (cached && cached.snapshot === snap) return cached.value;
    const next = selector(snap);
    if (cached && isEqual(cached.value, next)) {
      cacheRef.current = { snapshot: snap, value: cached.value };
      return cached.value;
    }
    cacheRef.current = { snapshot: snap, value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
