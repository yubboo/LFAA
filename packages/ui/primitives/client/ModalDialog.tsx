// 提供全局统一的居中弹窗组件：支持 Escape 与遮罩关闭、自定义尺寸、图标头与集中可调进场动画预设。
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import type { DialogAnimationPreset, DialogSize } from "../contract/index";
import styles from "./ModalDialog.module.css";

const SIZE_CLASS: Record<DialogSize, string | undefined> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

const ANIM_CLASS: Record<DialogAnimationPreset, string | undefined> = {
  scale: styles.animScale,
  fade: styles.animFade,
  "slide-up": styles.animSlideUp,
};

/** 定义模态内容、底部操作与关闭策略，供确认弹窗和设置表单复用。 */
export interface ModalDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  size?: DialogSize;
  animation?: DialogAnimationPreset;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

/** 将通用模态层挂载到浏览器 Portal，统一遮罩、退出和进入动画。 */
export function ModalDialog({
  open,
  title,
  subtitle,
  icon,
  size = "md",
  animation = "scale",
  closeLabel = "关闭",
  closeOnBackdrop = true,
  onClose,
  footer,
  children,
}: ModalDialogProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const content = (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.dialog} ${SIZE_CLASS[size]} ${ANIM_CLASS[animation]}`}
      >
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            {icon && <span className={styles.iconSlot}>{icon}</span>}
            <div className={styles.titleText}>
              <h2 className={styles.title}>{title}</h2>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <IconX size={16} stroke={1.8} />
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
