// 画布工具面板：用浏览器原生模态管理焦点、遮罩和 Esc 关闭。
import { useEffect, useRef, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import styles from "./Canvas-Tools.module.css";

export function CanvasToolsDialog({ title, closeLabel, header, children, onClose, catalog = false }: {
  title: string;
  closeLabel: string;
  header?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  catalog?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={ref} className={`${styles.dialog}${catalog ? ` ${styles.catalogDialog}` : ""}`} aria-label={title} onCancel={(event) => {
      event.preventDefault();
      onClose();
    }} onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={styles.dialogContent}>
        <header className={styles.dialogHeader}>
          <h2>{title}</h2>
          {header}
          <button type="button" className={styles.closeButton} aria-label={closeLabel} onClick={onClose}><IconX size={17} /></button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
      </div>
    </dialog>
  );
}
