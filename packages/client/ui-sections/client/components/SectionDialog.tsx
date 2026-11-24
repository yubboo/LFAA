// 新建或重命名分区的整页居中液态玻璃弹窗。
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { IconFolder, IconX } from "@tabler/icons-react";
import type { SectionsLocaleMessages } from "../locales";
import type { SectionDialogState, SectionStore } from "../store/section-store";
import styles from "./SectionDialog.module.css";

/** 共用创建与重命名分区表单，将已确认的名称交给分区 Store。 */
export function SectionDialog({
  locale,
  store,
  dialogState,
}: {
  locale: SectionsLocaleMessages;
  store: SectionStore;
  dialogState: Exclude<SectionDialogState, null>;
}) {
  const isRename = dialogState.kind === "rename";
  const initialName = isRename ? dialogState.section.name : "";
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(isRename ? dialogState.section.name : "");
    setError("");
  }, [dialogState, isRename]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError(locale.sectionNameRequired);
      return;
    }
    const excludeId = isRename ? dialogState.section.id : undefined;
    if (store.hasSectionName(trimmed, excludeId)) {
      setError(locale.sectionNameDuplicate);
      return;
    }

    setSubmitting(true);
    try {
      if (isRename) {
        await store.renameSection(dialogState.section.id, trimmed);
      } else {
        await store.createSection(trimmed);
      }
      store.closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.sectionStorageError);
    } finally {
      setSubmitting(false);
    }
  };

  const modalNode = (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !submitting) store.closeDialog();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfaa-section-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !submitting) store.closeDialog();
        }}
      >
        <header className={styles.header}>
          <h2 id="lfaa-section-dialog-title">
            {isRename ? locale.renameSection : locale.createSection}
          </h2>
          <button
            className={styles.close}
            type="button"
            aria-label={locale.close}
            disabled={submitting}
            onClick={store.closeDialog}
          >
            <IconX />
          </button>
        </header>

        <form onSubmit={(event) => { void handleSubmit(event); }}>
          <label className={styles.nameBox}>
            <span className={styles.nameIcon} aria-hidden="true">
              <IconFolder />
            </span>
            <input
              id="lfaa-section-name"
              autoFocus
              maxLength={40}
              placeholder={locale.sectionNamePlaceholder}
              aria-label={locale.sectionName}
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
                setError("");
              }}
            />
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <footer className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              disabled={submitting}
              onClick={store.closeDialog}
            >
              {locale.cancel}
            </button>
            <button type="submit" className={styles.submit} disabled={submitting}>
              {isRename ? locale.save : locale.create}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );

  if (typeof document === "undefined") return modalNode;
  return createPortal(modalNode, document.querySelector("[data-device]") ?? document.body);
}
