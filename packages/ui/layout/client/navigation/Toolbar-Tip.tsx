// 左二栏工具栏与列表行的浮层提示：用 portal 渲染到 body，避免被左栏层叠上下文与胶囊裁切。
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./NavigationSidebar.module.css";

/** 气泡与视口边缘之间的最小留白（px）。 */
const TIP_VIEWPORT_MARGIN = 8;

/**
 * 计算气泡为了留在视口内需要的水平位移。
 * 只以「未位移时的居中左边缘 + 气泡宽度 + 视口宽度」为输入，不读已位移的实测矩形：
 * 否则位移量会被下一次测量当成新的溢出量再修一次，在贴边场景下无限来回，最终把整棵树打崩。
 */
export function resolveTipShift({
  center,
  width,
  viewportWidth,
  margin = TIP_VIEWPORT_MARGIN,
}: {
  center: number;
  width: number;
  viewportWidth: number;
  margin?: number;
}): number {
  const baseLeft = center - width / 2;
  const maxLeft = Math.max(margin, viewportWidth - margin - width);
  const clampedLeft = Math.min(Math.max(baseLeft, margin), maxLeft);
  return clampedLeft - baseLeft;
}

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
    const next = resolveTipShift({
      center: position.left,
      width: element.offsetWidth,
      viewportWidth: window.innerWidth,
    });
    if (Math.abs(next - shift) > 0.5) setShift(next);
  }, [position, shift]);

  useEffect(() => {
    if (!position) return;
    const close = (): void => hide();
    // 抽屉滑入、栏轨道展开这类祖先动画结束时，按悬停瞬间量到的位置已经失真，直接收起气泡。
    const onAncestorAnimationEnd = (event: AnimationEvent): void => {
      const anchor = anchorRef.current;
      if (anchor && event.target instanceof Element && event.target.contains(anchor)) hide();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("animationend", onAncestorAnimationEnd, true);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("animationend", onAncestorAnimationEnd, true);
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