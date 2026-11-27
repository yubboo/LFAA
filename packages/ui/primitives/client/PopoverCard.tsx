// 提供可复用的锚点浮层卡片容器：复用共享外部点击与 Escape 退出逻辑，并支持平滑进出场过渡。
import { useMemo, useRef, type ReactNode } from "react";
import type { PopoverPlacement } from "../contract/index";
import { useDismissibleLayer } from "./useDismissibleLayer";
import { usePanePresence } from "./usePanePresence";
import styles from "./PopoverCard.module.css";

const PLACEMENT_CLASS: Record<PopoverPlacement, string | undefined> = {
  "top-start": styles.topStart,
  "top-end": styles.topEnd,
  "bottom-start": styles.bottomStart,
  "bottom-end": styles.bottomEnd,
};

/** 描述触发锚点、摆放方向和关闭请求的控制契约。 */
export interface PopoverCardProps {
  open: boolean;
  label: string;
  placement?: PopoverPlacement;
  // CSS Modules 的样式键可能为 undefined，允许显式传入以配合 exactOptionalPropertyTypes。
  className?: string | undefined;
  anchorRef?: { current: HTMLElement | null };
  onClose: () => void;
  children: ReactNode;
}

/** 定位锚点浮层，统一处理页面外部点击、Escape 关闭与进出场平滑过渡。 */
export function PopoverCard({
  open,
  label,
  placement = "top-start",
  className,
  anchorRef,
  onClose,
  children,
}: PopoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mounted = usePanePresence(open, 140);
  const layerRefs = useMemo(() => [cardRef, anchorRef], [anchorRef]);

  useDismissibleLayer({ open, refs: layerRefs, onClose });

  if (!mounted) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={label}
      data-state={open ? "open" : "closed"}
      className={`${styles.popover} ${PLACEMENT_CLASS[placement]}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
