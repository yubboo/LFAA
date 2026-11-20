// 管理右侧辅助栏（工作区文件树 / 上下文 / 任务面板）的指针拖拽调宽与本地偏好持久化。
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

const STORAGE_KEY = "lfaa:right-aux-width";
const DEFAULT_AUX_WIDTH = 248;
const MIN_AUX_WIDTH = 164;
const MAX_AUX_WIDTH = 440;
const MIN_STAGE_WIDTH = 220;

function readStoredAuxWidth(): number {
  if (typeof window === "undefined") return DEFAULT_AUX_WIDTH;
  try {
    const raw = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(raw) && raw >= MIN_AUX_WIDTH && raw <= MAX_AUX_WIDTH) return Math.round(raw);
  } catch {
    // 忽略本地存储读取异常
  }
  return DEFAULT_AUX_WIDTH;
}

function writeStoredAuxWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  } catch {
    // 忽略本地存储写入异常
  }
}

export function useAuxResize(containerRef: RefObject<HTMLDivElement | null>) {
  const [auxWidth, setAuxWidth] = useState(readStoredAuxWidth);
  const [dragging, setDragging] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const startResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    cleanupRef.current?.();

    const startX = event.clientX;
    const startW = event.currentTarget.nextElementSibling?.getBoundingClientRect().width ?? auxWidth;
    const maxAllowed = Math.max(MIN_AUX_WIDTH, Math.min(MAX_AUX_WIDTH, container.getBoundingClientRect().width - MIN_STAGE_WIDTH));
    let latestW = startW;
    setDragging(true);

    const onMove = (e: globalThis.PointerEvent) => {
      const delta = startX - e.clientX;
      latestW = Math.round(Math.max(MIN_AUX_WIDTH, Math.min(maxAllowed, startW + delta)));
      setAuxWidth(latestW);
    };

    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      cleanupRef.current = null;
      setDragging(false);
      writeStoredAuxWidth(latestW);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    cleanupRef.current = stop;
  }, [auxWidth, containerRef]);

  const handleKeyResize = useCallback((key: string) => {
    if (key === "ArrowLeft") {
      const max = Math.max(MIN_AUX_WIDTH, Math.min(MAX_AUX_WIDTH, (containerRef.current?.clientWidth ?? MAX_AUX_WIDTH) - MIN_STAGE_WIDTH));
      setAuxWidth((w) => { const next = Math.min(max, w + 16); writeStoredAuxWidth(next); return next; });
    } else if (key === "ArrowRight") {
      setAuxWidth((w) => { const next = Math.max(MIN_AUX_WIDTH, w - 16); writeStoredAuxWidth(next); return next; });
    }
  }, [containerRef]);

  return { auxWidth, dragging, startResize, handleKeyResize };
}
