// 高清低延迟 CDP 画布视口：Canvas + createImageBitmap 双缓冲绘制、非被动滚轮防穿透、单在途背压与完整键鼠直通。
import {
  useCallback,
  useEffect,
  useRef,
  type CompositionEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { sendBrowserInput, type BrowserSessionSnapshot } from "../api/browser-client";
import type { ViewportPreset } from "./BrowserToolbar";
import { computeCdpModifiers, tryDecodeBase64ToBlobNative } from "./browser-render-mode";
import styles from "./BrowserViewport.module.css";

export type FrameDrawer = (base64: string, mime: "image/jpeg" | "image/png", updatedAt?: number) => void;

const BUTTON_NAMES = ["left", "middle", "right"] as const;

export function BrowserCanvasViewport({
  sessionId,
  isZh,
  snap,
  preset,
  interactive,
  stageRef,
  frameDrawerRef,
}: {
  sessionId: string;
  isZh: boolean;
  snap: BrowserSessionSnapshot;
  preset: ViewportPreset;
  /** 仅用户显式点击「接管」后才允许向远端页面发送键鼠与滚轮事件。 */
  interactive: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  frameDrawerRef: RefObject<FrameDrawer | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawSeqRef = useRef(0);
  const lastPaintedAtRef = useRef(0);
  const hasPaintedRef = useRef(false);
  const composingRef = useRef(false);
  const pointerDownRef = useRef(false);
  const lastMoveSentAtRef = useRef(0);
  const viewportRef = useRef(snap.viewport);
  viewportRef.current = snap.viewport;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  // 滚轮单帧合并 + 单在途背压状态，彻底杜绝并发堆积与松手后乱滚。
  const wheelStateRef = useRef({
    dx: 0,
    dy: 0,
    x: 0,
    y: 0,
    modifiers: 0,
    rafId: 0,
    inFlight: false,
  });

  const mapPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    const vw = viewportRef.current?.width || 1024;
    const vh = viewportRef.current?.height || 768;
    const x = Math.max(0, Math.min(vw, Math.round(((clientX - rect.left) / rect.width) * vw)));
    const y = Math.max(0, Math.min(vh, Math.round(((clientY - rect.top) / rect.height) * vh)));
    return { x, y };
  }, []);

  /** 双缓冲绘制帧到 Canvas；恒定 2x 像素时原地覆盖不重置画布尺寸，彻底杜绝闪白与抖动。 */
  const drawFrame = useCallback<FrameDrawer>((base64, mime, updatedAt) => {
    const canvas = canvasRef.current;
    if (!canvas || !base64) return;
    if (updatedAt !== undefined) {
      lastPaintedAtRef.current = Math.max(lastPaintedAtRef.current, updatedAt);
    }
    const seq = ++drawSeqRef.current;
    const paint = (source: CanvasImageSource, width: number, height: number) => {
      if (seq !== drawSeqRef.current || !canvasRef.current) return;
      const target = canvasRef.current;
      if (target.width !== width || target.height !== height) {
        target.width = width;
        target.height = height;
      }
      const ctx = target.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, width, height);
      hasPaintedRef.current = true;
    };

    if (typeof createImageBitmap === "function") {
      const nativeBlob = tryDecodeBase64ToBlobNative(base64, mime);
      if (nativeBlob) {
        void createImageBitmap(nativeBlob)
          .then((bitmap) => {
            try {
              paint(bitmap, bitmap.width, bitmap.height);
            } finally {
              bitmap.close();
            }
          })
          .catch(() => {});
        return;
      }
    }

    // 浏览器原生 C++ 图像解码器异步解码，彻底避免 JS 主线程几十万次 for 循环逐字节 atob 拷贝。
    const img = new Image();
    img.decoding = "async";
    img.src = `data:${mime};base64,${base64}`;
    if (typeof img.decode === "function") {
      void img.decode().then(() => paint(img, img.naturalWidth || 1, img.naturalHeight || 1)).catch(() => {});
    } else {
      img.onload = () => paint(img, img.naturalWidth || 1, img.naturalHeight || 1);
    }
  }, []);

  // 注册直通绘制回调供 SSE 帧流绕过 React setState 直接上屏。
  useEffect(() => {
    frameDrawerRef.current = drawFrame;
    return () => {
      if (frameDrawerRef.current === drawFrame) {
        frameDrawerRef.current = null;
      }
    };
  }, [drawFrame, frameDrawerRef]);

  // 仅在首次上屏或快照确实比当前画面更新时绘制，防止旧 HTTP 轮询快照覆盖实时 SSE 帧引发闪跳。
  useEffect(() => {
    if (!snap.screenshotBase64) return;
    if (hasPaintedRef.current && snap.updatedAt <= lastPaintedAtRef.current) return;
    drawFrame(snap.screenshotBase64, snap.screenshotMime ?? "image/png", snap.updatedAt);
  }, [drawFrame, snap.screenshotBase64, snap.screenshotMime, snap.updatedAt]);

  // 挂载原生非被动 wheel 监听：无条件阻断冒泡与默认滚动链，按 rAF 合并增量并以单在途背压发送给远端。
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const flushWheel = () => {
      const st = wheelStateRef.current;
      st.rafId = 0;
      if (st.inFlight || (st.dx === 0 && st.dy === 0)) return;
      const dx = Math.round(st.dx);
      const dy = Math.round(st.dy);
      const { x, y, modifiers } = st;
      st.dx = 0;
      st.dy = 0;
      if (dx === 0 && dy === 0) return;
      st.inFlight = true;
      void sendBrowserInput(sessionId, { kind: "wheel", x, y, deltaX: dx, deltaY: dy, modifiers })
        .catch(() => {})
        .finally(() => {
          st.inFlight = false;
          if (st.dx !== 0 || st.dy !== 0) {
            flushWheel();
          }
        });
    };

    const onWheel = (event: WheelEvent) => {
      // 彻底锁死外层宿主滚动与触控板越界穿透；未点击「接管」时不向远端发送滚轮，防止误触。
      event.preventDefault();
      event.stopPropagation();
      if (!interactiveRef.current) return;
      const scale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? (viewportRef.current?.height || 600) : 1;
      const point = mapPoint(event.clientX, event.clientY);
      const st = wheelStateRef.current;
      st.dx += event.deltaX * scale;
      st.dy += event.deltaY * scale;
      st.x = point.x;
      st.y = point.y;
      st.modifiers = computeCdpModifiers(event);
      if (!st.rafId && !st.inFlight) {
        st.rafId = requestAnimationFrame(flushWheel);
      }
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      if (wheelStateRef.current.rafId) {
        cancelAnimationFrame(wheelStateRef.current.rafId);
        wheelStateRef.current.rafId = 0;
      }
      wheelStateRef.current.dx = 0;
      wheelStateRef.current.dy = 0;
    };
  }, [mapPoint, sessionId, stageRef]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!interactiveRef.current) return;
    hostRef.current?.focus();
    pointerDownRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 合成事件不支持 pointer capture 时忽略
    }
    const { x, y } = mapPoint(event.clientX, event.clientY);
    const button = BUTTON_NAMES[event.button] ?? "left";
    void sendBrowserInput(sessionId, {
      kind: "mousedown",
      x,
      y,
      button,
      buttons: event.buttons,
      clickCount: event.detail >= 2 ? 2 : 1,
      modifiers: computeCdpModifiers(event),
    }).catch(() => {});
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!interactiveRef.current) return;
    const now = performance.now();
    const minGap = pointerDownRef.current ? 16 : 36;
    if (now - lastMoveSentAtRef.current < minGap) return;
    lastMoveSentAtRef.current = now;
    const { x, y } = mapPoint(event.clientX, event.clientY);
    void sendBrowserInput(sessionId, {
      kind: "mousemove",
      x,
      y,
      buttons: event.buttons,
      modifiers: computeCdpModifiers(event),
    }).catch(() => {});
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // 忽略释放异常
    }
    const { x, y } = mapPoint(event.clientX, event.clientY);
    const button = BUTTON_NAMES[event.button] ?? "left";
    void sendBrowserInput(sessionId, {
      kind: "mouseup",
      x,
      y,
      button,
      buttons: event.buttons,
      clickCount: event.detail >= 2 ? 2 : 1,
      modifiers: computeCdpModifiers(event),
    }).catch(() => {});
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactiveRef.current || composingRef.current || event.key === "Process") return;
    // 放行全局面板最大化等应用级组合键，其余页面编辑快捷键直通给远端页面。
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "m") return;
    const isPrintable = event.key.length === 1;
    const isCommandKey = event.ctrlKey || event.metaKey;
    const isNavKey = [
      "Enter", "Backspace", "Tab", "Escape", "Delete", " ",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown",
    ].includes(event.key);
    if (!isPrintable && !isNavKey) return;
    event.preventDefault();
    void sendBrowserInput(sessionId, {
      kind: "keydown",
      key: event.key,
      code: event.code,
      ...(!isCommandKey && isPrintable ? { text: event.key } : {}),
      modifiers: computeCdpModifiers(event),
    }).catch(() => {});
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactiveRef.current || composingRef.current) return;
    void sendBrowserInput(sessionId, {
      kind: "keyup",
      key: event.key,
      code: event.code,
      modifiers: computeCdpModifiers(event),
    }).catch(() => {});
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>) => {
    composingRef.current = false;
    if (interactiveRef.current && event.data) {
      void sendBrowserInput(sessionId, { kind: "text", text: event.data }).catch(() => {});
    }
  };

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      className={styles.canvasHost}
      data-preset={preset}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={handleCompositionEnd}
    >
      <canvas
        ref={canvasRef}
        className={styles.viewportCanvas}
        data-preset={preset}
        aria-label={isZh ? "内置浏览器高清协同画面" : "Built-in browser live canvas"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerDownRef.current = false; }}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}
