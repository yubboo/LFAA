/**
 * 功能：保存并恢复前端滚动区域的位置。
 * 作用：按账户与页面区域生成隔离键，并统一处理本地读取、节流保存和离页冲刷。
 * 关联文件：Workbench.tsx、SettingsPage.tsx、ApplicationWorkspace.tsx、AiWorkChat.tsx、MinecraftWorkspace.tsx。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { createBrowserPersistence, createClientPersistenceKey, createJsonPersistenceCodec, finiteNumberPersistenceCodec, stringPersistenceCodec } from "./browser-persistence.js";

const booleanPersistenceCodec = createJsonPersistenceCodec((value): value is boolean => typeof value === "boolean");

export interface ScrollRestorationOptions {
  /** 可选的语义位置：用于恢复会话是否跟随最新内容，而非依赖旧像素推断。 */
  bottomPinnedKey?: string;
  isBottomPinned?: () => boolean;
}

/** 使用账户和视图片段隔离不同页面，避免滚动位置在菜单或用户之间串用。 */
export function createScrollRestorationKey(userId: string, ...viewParts: string[]): string {
  return createClientPersistenceKey("ui-scroll-position", 1, [userId, ...viewParts]);
}

function readScrollPosition(storageKey: string, legacyStorageKey?: string): number | null {
  const persistence = createBrowserPersistence({ key: storageKey, codec: finiteNumberPersistenceCodec });
  const value = persistence.read();
  if (value !== undefined) {
    if (value >= 0) return value;
    persistence.remove();
  }

  if (!legacyStorageKey) return null;
  const legacyValue = createBrowserPersistence({ key: legacyStorageKey, codec: stringPersistenceCodec }).read();
  if (legacyValue === undefined || !legacyValue.trim()) return null;
  const position = Number(legacyValue);
  if (!Number.isFinite(position) || position < 0) return null;
  persistence.write(position);
  return position;
}

function writeScrollPosition(storageKey: string, position: number): void {
  if (!Number.isFinite(position)) return;
  createBrowserPersistence({ key: storageKey, codec: finiteNumberPersistenceCodec }).write(Math.max(0, position));
}

function readBottomPinned(storageKey?: string): boolean | null {
  if (!storageKey) return null;
  return createBrowserPersistence({ key: storageKey, codec: booleanPersistenceCodec }).read() ?? null;
}

function writeBottomPinned(storageKey: string | undefined, pinned: boolean | null): void {
  if (!storageKey || pinned === null) return;
  createBrowserPersistence({ key: storageKey, codec: booleanPersistenceCodec }).write(pinned);
}

/**
 * 把一个真实滚动容器接入共享记忆。ready 用于等待异步内容就绪，避免空状态覆盖旧位置。
 */
export function useScrollRestoration(
  storageKey: string,
  ready = true,
  target: "element" | "window" = "element",
  legacyStorageKey?: string,
  options: ScrollRestorationOptions = {}
) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);
  const storageKeyRef = useRef(storageKey);
  const readyRef = useRef(ready);
  const targetRef = useRef(target);
  const bottomPinnedKeyRef = useRef(options.bottomPinnedKey);
  const isBottomPinnedRef = useRef(options.isBottomPinned);
  const currentAreaReadyRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const lastBottomPinnedRef = useRef<boolean | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  bottomPinnedKeyRef.current = options.bottomPinnedKey;
  isBottomPinnedRef.current = options.isBottomPinned;
  const flush = useCallback((key: string, bottomPinnedKey = bottomPinnedKeyRef.current, position = lastScrollTopRef.current) => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (key) writeScrollPosition(key, position);
    let bottomPinned = lastBottomPinnedRef.current;
    try { bottomPinned = isBottomPinnedRef.current?.() ?? bottomPinned; } catch { /* UI 状态读取异常时保留上次滚动事件的值。 */ }
    writeBottomPinned(bottomPinnedKey, bottomPinned);
  }, []);
  const saveBottomPinnedNow = useCallback(() => {
    let bottomPinned: boolean | null = null;
    try { bottomPinned = isBottomPinnedRef.current?.() ?? lastBottomPinnedRef.current; } catch { /* UI 状态读取异常时保留上次保存值。 */ }
    lastBottomPinnedRef.current = bottomPinned;
    writeBottomPinned(bottomPinnedKeyRef.current, bottomPinned);
  }, []);

  const scheduleSave = useCallback((key: string, bottomPinnedKey: string | undefined, position: number, bottomPinned: boolean | null) => {
    if (lastScrollTopRef.current === position && lastBottomPinnedRef.current === bottomPinned) return;
    lastScrollTopRef.current = position;
    lastBottomPinnedRef.current = bottomPinned;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      writeScrollPosition(key, position);
      writeBottomPinned(bottomPinnedKey, bottomPinned);
      saveTimerRef.current = null;
    }, 140);
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    if (!currentAreaReadyRef.current) return;
    let bottomPinned: boolean | null = null;
    try { bottomPinned = isBottomPinnedRef.current?.() ?? null; } catch { /* 非会话视图仅保存像素位置。 */ }
    scheduleSave(storageKeyRef.current, bottomPinnedKeyRef.current, event.currentTarget.scrollTop, bottomPinned);
  }, [scheduleSave]);

  useLayoutEffect(() => {
    storageKeyRef.current = storageKey;
    readyRef.current = ready;
    targetRef.current = target;
    currentAreaReadyRef.current = false;
    if (!storageKey || !ready || target === "element" && !element) {
      lastScrollTopRef.current = 0;
      return;
    }

    const previousScrollRestoration = target === "window" ? window.history.scrollRestoration : null;
    const savedPosition = readScrollPosition(storageKey, legacyStorageKey);
    const savedBottomPinned = readBottomPinned(options.bottomPinnedKey);
    if (target === "window") {
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, savedBottomPinned === true ? document.documentElement.scrollHeight : savedPosition ?? 0);
      lastScrollTopRef.current = window.scrollY;
    } else if (element) {
      element.scrollTop = savedBottomPinned === true ? element.scrollHeight : savedPosition ?? 0;
      lastScrollTopRef.current = element.scrollTop;
    }
    lastBottomPinnedRef.current = savedBottomPinned;
    currentAreaReadyRef.current = true;

    return () => {
      currentAreaReadyRef.current = false;
      flush(storageKey, options.bottomPinnedKey);
      if (previousScrollRestoration !== null) window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [element, flush, legacyStorageKey, options.bottomPinnedKey, ready, storageKey, target]);

  useEffect(() => {
    if (target !== "window" || !storageKey) return;
    const saveWindowPosition = () => {
      if (!currentAreaReadyRef.current || targetRef.current !== "window") return;
      let bottomPinned: boolean | null = null;
      try { bottomPinned = isBottomPinnedRef.current?.() ?? null; } catch { /* 非会话视图仅保存像素位置。 */ }
      scheduleSave(storageKeyRef.current, bottomPinnedKeyRef.current, window.scrollY, bottomPinned);
    };
    window.addEventListener("scroll", saveWindowPosition, { passive: true });
    return () => window.removeEventListener("scroll", saveWindowPosition);
  }, [scheduleSave, storageKey, target]);

  useEffect(() => {
    const flushOnPageHide = () => {
      if (readyRef.current && currentAreaReadyRef.current) flush(storageKeyRef.current);
    };
    window.addEventListener("pagehide", flushOnPageHide);
    return () => window.removeEventListener("pagehide", flushOnPageHide);
  }, [flush]);

  return { ref, onScroll, saveBottomPinnedNow, restoredBottomPinnedRef: lastBottomPinnedRef };
}
