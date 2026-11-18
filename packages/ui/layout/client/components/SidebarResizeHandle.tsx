// 渲染桌面端左二栏或右侧栏边缘的垂直拖拽调宽手柄。
import type { KeyboardEvent, PointerEvent } from "react";
import type { ResizeSide } from "../useSidebarResize";
import styles from "./ResizeHandle.module.css";

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
