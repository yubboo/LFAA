// 主题悬停预览：鼠标移入主题卡时在光标旁浮出实时预览，并用「预览」光标替代系统指针；
// 光标跟随只写 transform（rAF 合帧），不触发 React 重渲染；键盘聚焦时固定在卡片旁。
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThemePreview, type ThemePreviewSample } from "./ThemePreview";
import { placePreviewCard } from "./hover-preview-position";
import styles from "./ThemeHoverPreview.module.css";

/** 当前悬停的预览内容与锚点。 */
export interface ThemeHoverPreviewState {
  id: string;
  label: string;
  sample: ThemePreviewSample;
  secondarySample?: ThemePreviewSample | undefined;
  /** true：跟随鼠标；false：键盘聚焦，锚在卡片旁。 */
  follow: boolean;
  x: number;
  y: number;
}

/** 渲染悬停预览浮层；内容只在换卡时更新，位移在 rAF 里直接写 style。 */
export function ThemeHoverPreview({
  hover,
  cursorLabel,
  clickHint,
  onDismiss,
}: {
  hover: ThemeHoverPreviewState | null;
  cursorLabel: string;
  clickHint: string;
  onDismiss: () => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  // 关闭后保留最后一份内容做淡出，避免直接卸载导致「啪」地消失。
  const lastRef = useRef<ThemeHoverPreviewState | null>(null);
  const everOpen = useRef(false);
  const [open, setOpen] = useState(false);

  if (hover) lastRef.current = hover;
  const shown = hover ?? lastRef.current;

  // 首次出现先以关闭态挂载，下一帧再打开，让 CSS 的淡入/缩放真正跑起来。
  useEffect(() => {
    if (!hover) {
      setOpen(false);
      everOpen.current = false;
      return;
    }
    if (everOpen.current) return;
    const id = requestAnimationFrame(() => {
      everOpen.current = true;
      setOpen(true);
    });
    return () => cancelAnimationFrame(id);
  }, [hover]);

  // 布局阶段先落到鼠标位置，避免首帧闪在左上角；跟随期间只改 transform。
  useLayoutEffect(() => {
    if (!hover) return;
    const layer = layerRef.current;
    const card = cardRef.current;
    if (!layer || !card) return;

    const place = (x: number, y: number) => {
      const offset = placePreviewCard(x, y, window.innerWidth, window.innerHeight);
      layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      card.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
    };

    place(hover.x, hover.y);

    const dismiss = () => dismissRef.current();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    if (!hover.follow) {
      return () => window.removeEventListener("keydown", onKey);
    }

    let frame = 0;
    let latestX = hover.x;
    let latestY = hover.y;
    const move = (event: PointerEvent) => {
      latestX = event.clientX;
      latestY = event.clientY;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          place(latestX, latestY);
        });
      }
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", dismiss, { passive: true });
    window.addEventListener("wheel", dismiss, { passive: true });
    window.addEventListener("scroll", dismiss, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("wheel", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [hover]);

  if (!shown || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={layerRef}
      className={styles.layer}
      data-open={open ? "true" : "false"}
      data-theme-hover-preview="true"
      aria-hidden="true"
    >
      <span className={styles.cursor}>{cursorLabel}</span>
      <div ref={cardRef} className={styles.card}>
        <div className={styles.cardBody}>
          <ThemePreview variant="panel" sample={shown.sample} secondarySample={shown.secondarySample} />
          <div className={styles.caption}>
            <span className={styles.name}>{shown.label}</span>
            <span className={styles.hint}>{clickHint}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}