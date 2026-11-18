// 移出项目二次确认弹窗：明确告知仅从应用中移出、不会删除电脑文件和现有聊天。
import { useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { LocalProjectStore } from "../local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import styles from "./RemoveProjectDialog.module.css";

export function RemoveProjectDialog({
  locale,
  project,
  store,
  onRemoved,
  onClose,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  store: LocalProjectStore;
  onRemoved: (projectId: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setError("");
    setBusy(true);
    try {
      const removed = await store.removeProject(project.id);
      if (removed) {
        onRemoved(project.id);
      } else {
        setError(locale.projectStorageError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.projectStorageError);
    } finally {
      setBusy(false);
    }
  };

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
        aria-labelledby="lfaa-remove-project-title"
        aria-describedby="lfaa-remove-project-desc"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
        }}
      >
        <header className={styles.header}>
          <h2 id="lfaa-remove-project-title" className={styles.title}>
            {`${locale.removeConfirmPrefix} ${project.name}?`}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label={locale.close}
            disabled={busy}
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        <p id="lfaa-remove-project-desc" className={styles.description}>
          {locale.removeConfirmDescription}
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
            {locale.cancel}
          </button>
          <button
            type="button"
            className={styles.removeBtn}
            disabled={busy}
            onClick={() => { void handleConfirm(); }}
          >
            {busy ? locale.removingProject : locale.removeProjectMenu}
          </button>
        </footer>
      </section>
    </div>
  );

  if (typeof document === "undefined") return modalNode;
  return createPortal(modalNode, document.querySelector("[data-device]") ?? document.body);
}
