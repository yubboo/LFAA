// 浏览器画布的指针菜单：共享节点目录，并把菜单限制在画布可见范围内。
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { IconBox, IconClipboard, IconFolder, IconMaximize, IconPhoto, IconTypography, IconUpload, IconVideo } from "@tabler/icons-react";
import type { CanvasNodeKind } from "@lfaa/canvas/contract";
import type { CanvasLabels } from "../locales";
import { canvasMediaTypes } from "./canvas-clipboard";
import styles from "./Canvas-Menu.module.css";

export const canvasNodeOptions = [
  { kind: "prompt", Icon: IconTypography },
  { kind: "image", Icon: IconPhoto },
  { kind: "video", Icon: IconVideo },
  { kind: "asset", Icon: IconFolder },
  { kind: "previs", Icon: IconBox },
] as const;

export interface CanvasMenuAnchor {
  mode: "create" | "context";
  point: { x: number; y: number };
  canvas: HTMLElement;
  position: { x: number; y: number };
}

export function CanvasMenu({ anchor, t, onClose, onSelect, onAssets, onUpload, onFit, onPaste }: {
  anchor: CanvasMenuAnchor | null;
  t: CanvasLabels;
  onClose: () => void;
  onSelect: (kind: CanvasNodeKind) => void;
  onAssets: () => void;
  onUpload: (file: File, position: CanvasMenuAnchor["position"]) => void;
  onFit: () => void;
  onPaste: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadPosition = useRef<CanvasMenuAnchor["position"]>(null);
  const create = anchor?.mode === "create";
  const heading = create ? t.add : t.canvasMenu;

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !anchor) return;
    // 在首帧绘制前测量菜单，靠近画布边缘时翻转，再夹紧到可见区域。
    const place = () => {
      const gap = 8;
      const bounds = anchor.canvas.getBoundingClientRect();
      const left = Math.max(0, bounds.left) + gap;
      const top = Math.max(0, bounds.top) + gap;
      const right = Math.min(window.innerWidth, bounds.right) - gap;
      const bottom = Math.min(window.innerHeight, bounds.bottom) - gap;
      menu.style.maxWidth = `${Math.max(0, right - left)}px`;
      menu.style.maxHeight = `${Math.max(0, bottom - top)}px`;
      const { width, height } = menu.getBoundingClientRect();
      const x = anchor.point.x + gap + width <= right ? anchor.point.x + gap : anchor.point.x - width - gap;
      const y = anchor.point.y + gap + height <= bottom ? anchor.point.y + gap : anchor.point.y - height - gap;
      menu.style.left = `${Math.max(left, Math.min(x, right - width))}px`;
      menu.style.top = `${Math.max(top, Math.min(y, bottom - height))}px`;
    };
    place();
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    const resize = new ResizeObserver(place);
    resize.observe(anchor.canvas);
    return () => {
      window.removeEventListener("resize", place);
      resize.disconnect();
    };
  }, [anchor]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  const popup = anchor && createPortal(
    <div className={styles.layer} onContextMenu={(event) => event.preventDefault()}>
      <div className={styles.scrim} aria-hidden="true" onClick={onClose}
        onPointerDown={(event) => { if (event.button === 2) onClose(); }} />
      <div ref={menuRef} className={styles.menu} role="menu" aria-label={heading} onKeyDown={handleKey}>
        <div className={styles.heading} aria-hidden="true">{heading}</div>
        {canvasNodeOptions.map(({ kind, Icon }) => (
          <button key={kind} type="button" role="menuitem" tabIndex={-1} onClick={() => onSelect(kind)}>
            <Icon /><span>{t[kind]}</span>
          </button>
        ))}
        <div className={styles.separator} role="separator" />
        {create ? (
          <button type="button" role="menuitem" tabIndex={-1} onClick={onAssets}><IconFolder /><span>{t.chooseFromLibrary}</span></button>
        ) : (
          <>
            <button type="button" role="menuitem" tabIndex={-1} onClick={onFit}><IconMaximize /><span>{t.fitView}</span></button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={onPaste}><IconClipboard /><span>{t.paste}</span></button>
          </>
        )}
        <button type="button" role="menuitem" tabIndex={-1} onClick={() => {
          uploadPosition.current = anchor.position;
          onClose();
          fileInput.current?.click();
        }}><IconUpload /><span>{t.upload}</span></button>
      </div>
    </div>, document.body,
  );

  return (
    <>
      <input ref={fileInput} type="file" hidden accept={canvasMediaTypes.join(",")} onChange={(event) => {
        const file = event.target.files?.[0];
        const position = uploadPosition.current;
        event.target.value = "";
        uploadPosition.current = null;
        if (file && position) onUpload(file, position);
      }} />
      {popup}
    </>
  );
}
