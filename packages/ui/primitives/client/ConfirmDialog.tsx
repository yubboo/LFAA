// 共享二次确认弹窗组件：采用居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本，供删除/移除等高风险操作复用。
// 破坏性操作只能显式选择「取消 / 确认（或右上角关闭）」离开：点遮罩与按 Esc 都不关闭，改为整卡轻抖 + 动作区描边提示。
import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import styles from "./ConfirmDialog.module.css";

/** 轻抖关键帧：幅度逐次收敛，读出「这里不能点外面」而不至于晃得难受。 */
const NUDGE_KEYFRAMES: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-7px)" },
  { transform: "translateX(6px)" },
  { transform: "translateX(-5px)" },
  { transform: "translateX(4px)" },
  { transform: "translateX(-2px)" },
  { transform: "translateX(0)" },
];

/** 规定确认操作、忙碌状态和警示文案的输入，让具体删除行为留在业务组件中。 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  closeLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** 复用基础弹窗呈现高风险确认，并在忙碌时保护确认入口免于重复提交。 */
export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  closeLabel,
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  // 点遮罩 / 按 Esc 的反馈：整卡轻抖一下（系统开了减少动效就完全静默），不加边框、不弹文案。
  const nudge = useCallback(() => {
    const element = dialogRef.current;
    if (!element || typeof element.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.animate(NUDGE_KEYFRAMES, { duration: 360, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" });
  }, []);

  // 打开时锁住背景滚动；Esc 在捕获阶段就地吃掉：不关闭确认框、不冒泡去关背后的浮层，只抖一下作为反馈。
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      nudge();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, nudge]);

  if (!open) return null;

  const modalNode = (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) nudge();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label={closeLabel}
            disabled={busy}
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        <p id={descId} className={styles.description}>
          {description}
        </p>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <footer className={styles.actions}>
          <button
            type="button"
            autoFocus
            className={styles.cancelBtn}
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );

  if (typeof document === "undefined") return modalNode;
  return createPortal(modalNode, document.querySelector("[data-device]") ?? document.body);
}
