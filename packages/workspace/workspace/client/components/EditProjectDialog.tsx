// 编辑项目弹窗：支持修改项目名、增删多个本机源文件夹，或从本地列表安全移除项目。
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { IconFolder, IconFolderPlus, IconX } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { LocalProjectStore } from "../local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import styles from "./EditProjectDialog.module.css";

function getFolderName(folderPath: string): string {
  const parts = folderPath.split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : folderPath;
}

function appendUniquePath(list: string[], nextPath: string): string[] {
  const normalized = nextPath.toLowerCase();
  if (list.some((item) => item.toLowerCase() === normalized)) return list;
  return [...list, nextPath];
}

export function EditProjectDialog({
  locale,
  project,
  store,
  onUpdated,
  onRequestRemove,
  onClose,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  store: LocalProjectStore;
  onUpdated: (project: WorkbenchProjectItem) => void;
  onRequestRemove: (projectId: string) => void;
  onClose: () => void;
}) {
  const initialFolders = project.rootPaths?.length
    ? project.rootPaths
    : project.rootPath
      ? [project.rootPath]
      : [];

  const [name, setName] = useState(project.name);
  const [folders, setFolders] = useState<string[]>(initialFolders);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const handlePickAddFolder = async () => {
    setError("");
    setPicking(true);
    try {
      const result = await store.pickLocalFolder();
      if (result.error) {
        setShowManualInput(true);
        setError(result.error);
        return;
      }
      if (!result.cancelled && result.path) {
        const nextPath = result.path;
        setFolders((current) => appendUniquePath(current, nextPath));
      }
    } catch (err) {
      setShowManualInput(true);
      setError(err instanceof Error ? err.message : locale.projectStorageError);
    } finally {
      setPicking(false);
    }
  };

  const handleApplyManualPath = async () => {
    setError("");
    setPicking(true);
    try {
      const validated = await store.validateLocalFolder(manualPath);
      setFolders((current) => appendUniquePath(current, validated.path));
      setManualPath("");
      setShowManualInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.projectStorageError);
    } finally {
      setPicking(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(locale.projectNameRequired);
      return;
    }
    if (store.hasProjectName(trimmedName, project.id)) {
      setError(locale.projectNameDuplicate);
      return;
    }

    setBusy(true);
    try {
      let nextFolders = folders;
      if (showManualInput && manualPath.trim()) {
        const validated = await store.validateLocalFolder(manualPath);
        nextFolders = appendUniquePath(folders, validated.path);
        setFolders(nextFolders);
        setManualPath("");
        setShowManualInput(false);
      }

      if (nextFolders.length === 0) {
        setError(locale.atLeastOneFolder);
        return;
      }

      const updated = await store.updateProject(project.id, {
        name: trimmedName,
        rootPaths: nextFolders,
      });
      onUpdated(updated);
      onClose();
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfaa-edit-project-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
        }}
      >
        <header className={styles.header}>
          <h2 id="lfaa-edit-project-title">{locale.editProject}</h2>
          <button
            className={styles.close}
            type="button"
            aria-label={locale.close}
            disabled={busy}
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        <form onSubmit={(event) => { void handleSave(event); }}>
          <label className={styles.nameBox}>
            <span className={styles.nameIcon} aria-hidden="true">
              <IconFolder />
            </span>
            <input
              id="lfaa-edit-project-name"
              autoFocus
              maxLength={80}
              placeholder={locale.projectName}
              aria-label={locale.projectName}
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
                setError("");
              }}
            />
          </label>

          <p className={styles.sectionLabel}>{locale.sourceFolderLabel}</p>

          <div className={styles.sourceCard}>
            {folders.map((folderPath) => {
              const shortName = getFolderName(folderPath);
              return (
                <div key={folderPath} className={styles.folderRow} title={folderPath}>
                  <IconFolder className={styles.rowIcon} aria-hidden="true" />
                  <div className={styles.folderMeta}>
                    <span className={styles.folderName}>{shortName}</span>
                    <small className={styles.folderPath}>{folderPath}</small>
                  </div>
                  <button
                    type="button"
                    className={styles.removeFolderBtn}
                    aria-label={`${locale.removeSourceFolderAria}: ${shortName}`}
                    disabled={busy}
                    onClick={() => {
                      setFolders((current) => current.filter((item) => item !== folderPath));
                      setError("");
                    }}
                  >
                    <IconX />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              className={styles.addFolderRow}
              disabled={busy || picking}
              onClick={() => { void handlePickAddFolder(); }}
            >
              <IconFolderPlus className={styles.rowIcon} aria-hidden="true" />
              <span>{picking ? locale.pickingFolder : locale.addSourceFolder}</span>
            </button>

            {showManualInput && (
              <div className={styles.manualRow}>
                <input
                  type="text"
                  className={styles.manualInput}
                  aria-label={locale.manualPathPlaceholder}
                  placeholder={locale.manualPathPlaceholder}
                  value={manualPath}
                  onChange={(event) => {
                    setManualPath(event.currentTarget.value);
                    setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && manualPath.trim()) {
                      event.preventDefault();
                      void handleApplyManualPath();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.manualApplyBtn}
                  disabled={busy || picking || !manualPath.trim()}
                  onClick={() => { void handleApplyManualPath(); }}
                >
                  {locale.applyPathButton}
                </button>
              </div>
            )}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy}
              onClick={() => onRequestRemove(project.id)}
            >
              {locale.removeLocalProject}
            </button>
            <div className={styles.footerRight}>
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={busy}
                onClick={onClose}
              >
                {locale.cancel}
              </button>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={busy}
              >
                {locale.save}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );

  if (typeof document === "undefined") return modalNode;
  return createPortal(modalNode, document.querySelector("[data-device]") ?? document.body);
}
