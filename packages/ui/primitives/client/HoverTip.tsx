// 共享悬停提示胶囊：portal 到 body 渲染，按触发元素位置自动落在上方或下方，并在视口边缘内收避让。
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./HoverTip.module.css";

/** 气泡与视口边缘的最小留白。 */
const VIEWPORT_MARGIN = 8;
/** 触发元素离窗口顶部太近时，气泡改到下方，避免被顶栏裁掉。 */
const ABOVE_FLIP_TOP = 72;

/** 为触发元素提供悬停提示与快捷键标签；multiline 用于完整路径这类可能很长的文案。 */
export function HoverTip({
  label,
  shortcut,
  disabled = false,
  multiline = false,
  children,
}: {
  label: string;
  shortcut?: string | undefined;
  disabled?: boolean | undefined;
  multiline?: boolean | undefined;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ center: number; top: number; bottom: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const hide = useCallback(() => setAnchor(null), []);

  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSize({ width: 0, height: 0 });
    setAnchor({ center: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
  }, []);

  // 先量出真实气泡宽高，再做翻转与边缘内收，避免贴边或顶栏位置被裁切。
  useLayoutEffect(() => {
    if (!anchor) return;
    const element = tipRef.current;
    if (!element) return;
    const next = { width: element.offsetWidth, height: element.offsetHeight };
    if (next.width !== size.width || next.height !== size.height) setSize(next);
  }, [anchor, size.width, size.height]);

  useEffect(() => {
    if (!anchor) return;
    const closeOnKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") hide();
    };
    const close = (): void => hide();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", closeOnKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", closeOnKey);
    };
  }, [anchor, hide]);

  const placement = anchor && anchor.top < ABOVE_FLIP_TOP ? "bottom" : "top";
  const half = size.width / 2;
  const center = anchor
    ? Math.min(Math.max(anchor.center, VIEWPORT_MARGIN + half), window.innerWidth - VIEWPORT_MARGIN - half)
    : 0;
  const top = anchor ? (placement === "bottom" ? anchor.bottom + 6 : anchor.top - size.height - 6) : 0;

  return (
    <span
      ref={anchorRef}
      className={`${styles.wrap} ${disabled ? styles.disabled : ""}`}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onClickCapture={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {!disabled && label && anchor && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          className={`${styles.tip} ${styles.tipOpen} ${multiline ? styles.tipMultiline : ""}`}
          style={{ left: center, top, visibility: size.height > 0 ? "visible" : "hidden" }}
        >
          <span>{label}</span>
          {shortcut && <span className={styles.kbd}>{shortcut}</span>}
        </span>,
        document.body,
      )}
    </span>
  );
}