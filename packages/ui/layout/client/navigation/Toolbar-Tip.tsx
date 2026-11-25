// 左二栏工具栏与列表行的浮层提示：用 portal 渲染到 body，避免被左栏层叠上下文与胶囊裁切。
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./NavigationSidebar.module.css";

/** 悬停/聚焦时在触发元素下方居中显示提示；贴边时按实际宽度收拢，滚动或缩放时立即隐藏。 */
export function ToolbarTip({ label, className, children }: { label: string; className?: string | undefined; children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [shift, setShift] = useState(0);

  const hide = useCallback(() => setPosition(null), []);

  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setShift(0);
    setPosition({ left: rect.left + rect.width / 2, top: rect.bottom + 6 });
  }, []);

  // 气泡宽度随文案变化（例如完整路径），渲染后按真实宽度把贴边的一侧收回视口内。
  useLayoutEffect(() => {
    if (!position) return;
    const element = tipRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const margin = 8;
    let next = 0;
    if (rect.left < margin) next = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) next = window.innerWidth - margin - rect.right;
    if (Math.abs(next - shift) > 0.5) setShift(next);
  }, [position, shift]);

  useEffect(() => {
    if (!position) return;
    const close = (): void => hide();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [position, hide]);

  return (
    <span
      ref={anchorRef}
      className={`${styles.tipAnchor} ${className ?? ""}`}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onClickCapture={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {position && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          className={styles.tip}
          style={{ left: position.left, top: position.top, marginLeft: shift }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}