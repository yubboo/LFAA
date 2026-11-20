// 内置浏览器实时视口：把 CDP 画面映射为可点击/滚轮/键盘直输的交互区，空白时展示就绪提示与本地快捷入口。
import { useRef, type CompositionEvent, type KeyboardEvent, type MouseEvent, type RefObject, type WheelEvent } from "react";
import { IconWorld } from "@tabler/icons-react";
import { performBrowserAction, type BrowserSessionSnapshot } from "./browser-client";
import type { ViewportPreset } from "./BrowserToolbar";
import styles from "./RightBrowserPane.module.css";

const QUICK_PORTS = ["http://127.0.0.1:5173/", "http://127.0.0.1:3000/"];

export function BrowserViewport({
  sessionId,
  isZh,
  snap,
  preset,
  streamConnected,
  stageRef,
  applySnap,
  onError,
  onOpenUrl,
}: {
  sessionId: string;
  isZh: boolean;
  snap: BrowserSessionSnapshot | null;
  preset: ViewportPreset;
  streamConnected: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  applySnap: (next: BrowserSessionSnapshot) => void;
  onError: (message: string) => void;
  onOpenUrl: (url: string) => void;
}) {
  const wheelBufferRef = useRef({ dx: 0, dy: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const composingRef = useRef(false);

  // 用户在视口内点击属于直接交互，不触发导航「加载中...」提示；HiDPI 下严格按 CSS viewport 映射坐标。
  const handleStageClick = async (event: MouseEvent<HTMLImageElement>) => {
    stageRef.current?.focus();
    if (!snap?.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const vw = snap.viewport?.width || event.currentTarget.naturalWidth || 1024;
    const vh = snap.viewport?.height || event.currentTarget.naturalHeight || 768;
    const x = Math.round(((event.clientX - rect.left) / rect.width) * vw);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * vh);
    onError("");
    try {
      const res = await performBrowserAction(sessionId, {
        kind: "click",
        x,
        y,
        button: event.button === 2 ? "right" : "left",
        clickCount: event.detail >= 2 ? 2 : 1,
        fast: streamConnected,
      });
      if (!streamConnected || res.state.url !== snap.url) applySnap(res.state);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStageWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!snap?.active) return;
    wheelBufferRef.current.dx += event.deltaX;
    wheelBufferRef.current.dy += event.deltaY;
    if (wheelBufferRef.current.timer) return;
    wheelBufferRef.current.timer = setTimeout(() => {
      const { dx, dy } = wheelBufferRef.current;
      wheelBufferRef.current = { dx: 0, dy: 0, timer: 0 };
      void performBrowserAction(sessionId, {
        kind: "scroll",
        deltaX: Math.round(dx),
        deltaY: Math.round(dy),
        fast: streamConnected,
      }).then((res) => {
        if (!streamConnected) applySnap(res.state);
      }).catch(() => {});
    }, streamConnected ? 32 : 90);
  };

  const handleStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!snap?.active || composingRef.current) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const navKeys = new Set([
      "Enter", "Backspace", "Tab", "Escape", "Delete",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown",
    ]);
    if (navKeys.has(event.key)) {
      event.preventDefault();
      void performBrowserAction(sessionId, { kind: "key", key: event.key, fast: streamConnected })
        .then((res) => { if (!streamConnected || res.state.url !== snap.url) applySnap(res.state); })
        .catch(() => {});
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      void performBrowserAction(sessionId, { kind: "type", text: event.key, fast: streamConnected })
        .then((res) => { if (!streamConnected) applySnap(res.state); })
        .catch(() => {});
    }
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>) => {
    composingRef.current = false;
    if (snap?.active && event.data) {
      void performBrowserAction(sessionId, { kind: "type", text: event.data, fast: streamConnected })
        .then((res) => { if (!streamConnected) applySnap(res.state); })
        .catch(() => {});
    }
  };

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      className={styles.viewportStage}
      aria-label={isZh ? "内置浏览器实时操作画面（可直接点击、滚轮与键入）" : "Interactive built-in browser viewport"}
      onWheel={handleStageWheel}
      onKeyDown={handleStageKeyDown}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={handleCompositionEnd}
      onContextMenu={(e) => {
        if (snap?.active) e.preventDefault();
      }}
    >
      {snap?.screenshotBase64 && snap.url !== "about:blank" ? (
        <img
          src={`data:${snap.screenshotMime || "image/png"};base64,${snap.screenshotBase64}`}
          alt={snap.title || snap.url || "Browser Preview"}
          className={styles.viewportImg}
          data-preset={preset}
          draggable={false}
          onClick={(e) => void handleStageClick(e)}
        />
      ) : (
        <div className={styles.emptyStage}>
          <IconWorld size={34} stroke={1.4} aria-hidden="true" />
          <h4>{isZh ? "内置浏览器已就绪" : "Built-in Browser Ready"}</h4>
          <p>
            {isZh
              ? "直接输入网址回车打开，或由小鱼 Agent 自动访问本地开发服务并在界面实时点击、滚动与排错。"
              : "Enter a URL above or let the agent browse and inspect localhost or web apps live."}
          </p>
          <div className={styles.quickLinks}>
            {QUICK_PORTS.map((u) => (
              <button key={u} type="button" className={styles.quickBtn} onClick={() => onOpenUrl(u)}>
                {u}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}