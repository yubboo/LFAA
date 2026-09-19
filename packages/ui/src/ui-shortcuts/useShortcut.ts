/**
 * 文件：useShortcut.ts
 * 作用：集中注册页面级快捷键，避免各功能重复写 keydown / preventDefault / 输入框过滤。
 */
import { useEffect, useRef } from "react";

export interface ShortcutSpec {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  allowInEditable?: boolean;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function matches(event: KeyboardEvent, spec: ShortcutSpec): boolean {
  return event.key.toLowerCase() === spec.key.toLowerCase()
    && event.ctrlKey === Boolean(spec.ctrl)
    && event.shiftKey === Boolean(spec.shift)
    && event.altKey === Boolean(spec.alt)
    && event.metaKey === Boolean(spec.meta);
}

export function useShortcut(spec: ShortcutSpec, handler: () => void, enabled = true): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matches(event, spec)) return;
      if (!spec.allowInEditable && isEditable(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      handlerRef.current();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [enabled, spec.alt, spec.allowInEditable, spec.ctrl, spec.key, spec.meta, spec.shift]);
}
