// 管理右侧辅助栏（工作区文件树 / 上下文 / 任务面板）的实时跟手拖拽调宽与本地偏好持久化。
// 拖拽期通过 rAF 直接写 DOM flexBasis（零 React 重渲染），松手再提交 state 与本地存储。
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
    const handleEl = event.currentTarget;
    const drawerEl = handleEl.nextElementSibling instanceof HTMLElement ? handleEl.nextElementSibling : null;
    if (!container) return;
    event.preventDefault();
    cleanupRef.current?.();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startW = drawerEl?.getBoundingClientRect().width ?? auxWidth;
    const maxAllowed = Math.max(MIN_AUX_WIDTH, Math.min(MAX_AUX_WIDTH, container.getBoundingClientRect().width - MIN_STAGE_WIDTH));

    let latestClientX = startX;
    let latestW = Math.round(startW);
    let rafId: number | null = null;
    let captured = false;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    container.dataset.resizing = "true";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setDragging(true);

    try {
      if (typeof handleEl.setPointerCapture === "function") {
        handleEl.setPointerCapture(pointerId);
        captured = handleEl.hasPointerCapture?.(pointerId) ?? true;
      }
    } catch {
      // 合成事件或无真实指针 ID 时忽略捕获失败，仍由 window 监听兜底。
    }

    const applyFrame = () => {
      rafId = null;
      const delta = startX - latestClientX;
      latestW = Math.round(Math.max(MIN_AUX_WIDTH, Math.min(maxAllowed, startW + delta)));
      if (drawerEl) drawerEl.style.flexBasis = `${latestW}px`;
    };

    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
        stop();
        return;
      }
      latestClientX = e.clientX;
      if (rafId === null) rafId = window.requestAnimationFrame(applyFrame);
    };

    const stop = (endEvent?: globalThis.PointerEvent | FocusEvent) => {
      if (endEvent && "pointerId" in endEvent && endEvent.pointerId !== pointerId) return;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        applyFrame();
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
      handleEl.removeEventListener("lostpointercapture", stop);
      if (captured) {
        captured = false;
        try {
          if (handleEl.hasPointerCapture?.(pointerId)) {
            handleEl.releasePointerCapture?.(pointerId);
          }
        } catch {
          // 忽略元素已卸载时的释放异常。
        }
      }
      delete container.dataset.resizing;
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      cleanupRef.current = null;
      setDragging(false);
      setAuxWidth(latestW);
      writeStoredAuxWidth(latestW);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    handleEl.addEventListener("lostpointercapture", stop);
    cleanupRef.current = () => stop();
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
