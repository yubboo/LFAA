// 输入区图片的大图预览：默认约占屏幕七成（四周留白），可缩放到 1:1 或更大；被放大时改用像素化渲染避免发虚。
// 遮罩 + 顶部工具条（复制 / 另存为 / 缩放 / 关闭），Esc、点击空白与关闭按钮都能退出。
// 通过 Portal 挂到 body，避免被输入卡片的容器查询和裁剪影响；挂载时锁滚动并在卸载后恢复焦点。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCopy, IconDownload, IconMinus, IconPlus, IconX } from "@tabler/icons-react";
import type { ChatLocaleMessages } from "../locales";
import styles from "./ComposerImagePreview.module.css";

/** 缩放上下限：小图「适应屏幕」本身就可能超过 8 倍，上限留给继续放大的空间。 */
const MIN_SCALE = 0.1;
const MAX_SCALE = 16;
const ZOOM_STEP = 1.25;

export function ComposerImagePreview({
  src,
  label,
  locale,
  onCopy,
  onSave,
  onClose,
}: {
  src: string;
  label: string;
  locale: ChatLocaleMessages;
  onCopy: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  // 回调每次渲染都会重建：用 ref 持有最新关闭动作，挂载期只装一次监听。
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // null 表示「适应屏幕」：由 CSS 按七成区域铺开；数字表示按原始像素的倍数显示。
  const [scale, setScale] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number }>();
  const [rendered, setRendered] = useState<{ width: number; height: number }>();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
      previousFocus?.focus();
    };
  }, []);

  // 记录实际渲染尺寸：比原始像素大说明正在放大，改用像素化渲染保持清晰。
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !natural) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setRendered({ width: box.width, height: box.height });
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, [natural]);

  const containScale = natural && rendered
    ? Math.min(rendered.width / natural.width, rendered.height / natural.height)
    : 1;
  const currentScale = scale ?? containScale;
  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  const zoomTo = (value: number) => setScale(clampScale(value));
  /** 放大 / 缩小：从当前实际比例起步，避免从「适应」切到数字时跳变。 */
  const stepZoom = (factor: number) => zoomTo(currentScale * factor);
  /** 在「适应屏幕」与 1:1 之间切换。 */
  const toggleActualSize = () => setScale(scale === null ? 1 : null);
  // 轻微放大仍走平滑插值；放得很大（比如图标被拉到全屏）才切像素化，避免糊成一片。
  const upscaled = currentScale > 1.5;
  const scaleLabel = scale === null ? locale.attachmentZoomFit : `${Math.round(scale * 100)}%`;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-composer-image-preview="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div className={styles.toolbar}>
        <span className={styles.name} title={label}>{label}</span>
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={onCopy}>
            <IconCopy size={14} aria-hidden="true" />
            <span>{locale.attachmentCopyImage}</span>
          </button>
          <button type="button" className={styles.action} onClick={onSave}>
            <IconDownload size={14} aria-hidden="true" />
            <span>{locale.attachmentSaveImage}</span>
          </button>
          <span className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={locale.attachmentZoomOut}
            title={locale.attachmentZoomOut}
            onClick={() => stepZoom(1 / ZOOM_STEP)}
          >
            <IconMinus size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.scaleLabel}
            data-zoom-fit="true"
            title={locale.attachmentZoomFit}
            onClick={() => setScale(null)}
          >
            {scaleLabel}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={locale.attachmentZoomIn}
            title={locale.attachmentZoomIn}
            onClick={() => stepZoom(ZOOM_STEP)}
          >
            <IconPlus size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={locale.attachmentZoomActual}
            title={locale.attachmentZoomActual}
            onClick={() => zoomTo(1)}
          >
            <span className={styles.actualSize}>1:1</span>
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.close}
            aria-label={locale.attachmentClosePreview}
            title={locale.attachmentClosePreview}
            onClick={onClose}
          >
            <IconX size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className={styles.stage}
        data-zoomed={scale === null ? undefined : "true"}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeRef.current();
        }}
      >
        <img
          ref={imageRef}
          className={styles.image}
          src={src}
          alt={label}
          draggable={false}
          data-upscaled={upscaled ? "true" : undefined}
          data-zoomed={scale === null ? undefined : "true"}
          style={scale === null || !natural
            ? undefined
            : { width: natural.width * scale, height: natural.height * scale }}
          onClick={(event) => {
            // 点图本身切换「适应 / 1:1」；点遮罩才是关闭。
            event.stopPropagation();
            toggleActualSize();
          }}
          onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        />
      </div>
    </div>,
    document.body,
  );
}