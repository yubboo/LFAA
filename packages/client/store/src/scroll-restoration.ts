/**
 * 功能：保存并恢复前端滚动区域的位置。
 * 作用：按账户与页面区域生成隔离键，并统一处理本地读取、节流保存和离页冲刷。
 * 关联文件：Workbench.tsx、SettingsPage.tsx、ApplicationWorkspace.tsx、AiWorkChat.tsx、MinecraftWorkspace.tsx。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { createBrowserPersistence, createClientPersistenceKey, finiteNumberPersistenceCodec, stringPersistenceCodec } from "./browser-persistence.js";

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

/**
 * 把一个真实滚动容器接入共享记忆。ready 用于等待异步内容就绪，避免空状态覆盖旧位置。
 */
export function useScrollRestoration(storageKey: string, ready = true, target: "element" | "window" = "element", legacyStorageKey?: string) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);
  const storageKeyRef = useRef(storageKey);
  const readyRef = useRef(ready);
  const targetRef = useRef(target);
  const currentAreaReadyRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const flush = useCallback((key: string, position = lastScrollTopRef.current) => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (key) writeScrollPosition(key, position);
  }, []);

  const scheduleSave = useCallback((key: string, position: number) => {
    if (lastScrollTopRef.current === position) return;
    lastScrollTopRef.current = position;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      writeScrollPosition(key, position);
      saveTimerRef.current = null;
    }, 140);
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    if (!currentAreaReadyRef.current) return;
    scheduleSave(storageKeyRef.current, event.currentTarget.scrollTop);
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
    if (target === "window") {
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, savedPosition ?? 0);
      lastScrollTopRef.current = window.scrollY;
    } else if (element) {
      element.scrollTop = savedPosition ?? 0;
      lastScrollTopRef.current = element.scrollTop;
    }
    currentAreaReadyRef.current = true;

    return () => {
      currentAreaReadyRef.current = false;
      flush(storageKey);
      if (previousScrollRestoration !== null) window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [element, flush, legacyStorageKey, ready, storageKey, target]);

  useEffect(() => {
    if (target !== "window" || !storageKey) return;
    const saveWindowPosition = () => {
      if (!currentAreaReadyRef.current || targetRef.current !== "window") return;
      scheduleSave(storageKeyRef.current, window.scrollY);
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

  return { ref, onScroll };
}
