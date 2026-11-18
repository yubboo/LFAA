// 渲染桌面端左二栏或右侧栏边缘的垂直拖拽调宽手柄。
import type { KeyboardEvent, PointerEvent } from "react";
import type { ResizeSide } from "../useSidebarResize";
import styles from "./ResizeHandle.module.css";

/** 提供拖拽和键盘可操作的分隔条，通过回调交给外层计算面板宽度。 */
export function SidebarResizeHandle({
  side,
  label,
  dragging,
  snapped,
  onStartResize,
  onKeyResize,
}: {
  side: ResizeSide;
  label: string;
  dragging: boolean;
  snapped: boolean;
  onStartResize: (side: ResizeSide, event: PointerEvent<HTMLDivElement>) => void;
  onKeyResize: (side: ResizeSide, event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      className={`${styles.resizeHandle} ${side === "left" ? styles.resizeHandleLeft : styles.resizeHandleRight}`}
      data-resize-side={side}
      data-dragging={dragging ? "true" : undefined}
      data-snapped={snapped ? "true" : undefined}
      onPointerDown={(event) => onStartResize(side, event)}
      onKeyDown={(event) => onKeyResize(side, event)}
    />
  );
}
