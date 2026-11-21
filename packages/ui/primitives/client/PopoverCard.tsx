// 提供可复用的锚点浮层卡片容器：自动处理外部点击关闭与 Escape 退出，供模型选择器和工具浮窗复用。
import { useEffect, useRef, type ReactNode } from "react";
import type { PopoverPlacement } from "../contract/index";
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

/** 定位锚点浮层，统一处理页面外部点击与 Escape 关闭。 */
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

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (cardRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={label}
      className={`${styles.popover} ${PLACEMENT_CLASS[placement]}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
