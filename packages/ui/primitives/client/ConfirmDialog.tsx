// 共享二次确认弹窗组件：采用居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本，供删除/移除等高风险操作复用。
import { useId } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import styles from "./ConfirmDialog.module.css";

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

  if (!open) return null;

  const modalNode = (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
        }}
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
