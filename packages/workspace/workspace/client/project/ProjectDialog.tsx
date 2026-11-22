// 创建项目弹窗：支持输入名称、本机资源管理器选目录 / 远程说明，以及按“文档/lfaa”生成前的目录信任确认。
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { IconCloud, IconDeviceDesktop, IconFolder, IconX } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { LocalProjectStore } from "../store/local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import { useProjectBrief } from "./useProjectBrief";
import { ProjectBriefField } from "./ProjectBriefField";
import { ProjectSourcePicker } from "./ProjectSourcePicker";
import { ProjectTrustPrompt } from "./ProjectTrustPrompt";
import styles from "./ProjectDialog.module.css";

interface PendingTrustTarget {
  name: string;
  targetPath: string;
  usesDefaultLocation: boolean;
}

/** 收集新项目名称和目录选项，确认本机目录后交由项目 Store 创建。 */
export function ProjectDialog({
  locale,
  store,
  onClose,
  onCreated,
}: {
  locale: WorkspaceLocaleMessages;
  store: LocalProjectStore;
  onClose: () => void;
  onCreated: (project: WorkbenchProjectItem) => void;
}) {
  const [name, setName] = useState("");
  const [sourceTab, setSourceTab] = useState<"local" | "remote">("local");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [manualPath, setManualPath] = useState("");
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trustTarget, setTrustTarget] = useState<PendingTrustTarget | null>(null);
  // 选择文件夹后自动按目录生成简介初稿，创建时随项目一起保存。
  const brief = useProjectBrief(store, selectedFolder, name, locale);

  const handlePickFolder = async () => {
    setError("");
    setPicking(true);
    try {
      const result = await store.pickLocalFolder();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.cancelled && result.path) {
        setSelectedFolder(result.path);
        setManualPath("");
        if (!name.trim() && result.name) {
          setName(result.name);
        }
      }
    } catch (err) {
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
      setSelectedFolder(validated.path);
      setManualPath("");
      if (!name.trim() && validated.name) {
        setName(validated.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.projectStorageError);
    } finally {
      setPicking(false);
    }
  };

  const handleContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (sourceTab === "remote") {
      setError(locale.remoteUnavailable);
      return;
    }

    setSubmitting(true);
    try {
      if (selectedFolder) {
        const trimmedName = name.trim();
        if (!trimmedName) {
          setError(locale.projectNameRequired);
          return;
        }
        if (store.hasProjectName(trimmedName)) {
          setError(locale.projectNameDuplicate);
          return;
        }
        setTrustTarget({
          name: trimmedName,
          targetPath: selectedFolder,
          usesDefaultLocation: false,
        });
        return;
      }

      const rawManualPath = manualPath.trim();
      if (rawManualPath) {
        const validated = await store.validateLocalFolder(rawManualPath);
        const resolvedName = name.trim() || validated.name;
        setSelectedFolder(validated.path);
        setManualPath("");
        if (!name.trim()) setName(resolvedName);
        if (store.hasProjectName(resolvedName)) {
          setError(locale.projectNameDuplicate);
          return;
        }
        setTrustTarget({
          name: resolvedName,
          targetPath: validated.path,
          usesDefaultLocation: false,
        });
        return;
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError(locale.projectNameRequired);
        return;
      }
      if (store.hasProjectName(trimmedName)) {
        setError(locale.projectNameDuplicate);
        return;
      }
      const resolved = await store.resolveDefaultPath(trimmedName);
      setTrustTarget({
        name: trimmedName,
        targetPath: resolved.targetPath,
        usesDefaultLocation: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.projectStorageError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmTrust = async () => {
    if (!trustTarget) return;
    setError("");
    setSubmitting(true);
    try {
      const created = await store.createProject({
        name: trustTarget.name,
        ...(trustTarget.usesDefaultLocation
          ? { confirmedDefaultPath: trustTarget.targetPath }
          : { rootPath: trustTarget.targetPath }),
        ...(brief.brief.trim() ? { description: brief.brief.trim() } : {}),
        trusted: true,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.projectStorageError);
      setTrustTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfaa-project-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !submitting) {
            if (trustTarget) setTrustTarget(null);
            else onClose();
          }
        }}
      >
        {trustTarget ? (
          <ProjectTrustPrompt
            locale={locale}
            targetPath={trustTarget.targetPath}
            submitting={submitting}
            error={error}
            onConfirm={() => { void handleConfirmTrust(); }}
            onCancel={() => setTrustTarget(null)}
          />
        ) : (
          <>
            <header className={styles.header}>
              <h2 id="lfaa-project-title">{locale.createProject}</h2>
              <button className={styles.close} type="button" aria-label={locale.close} onClick={onClose}>
                <IconX />
              </button>
            </header>

            <form onSubmit={(event) => { void handleContinue(event); }}>
              <label className={styles.nameBox}>
                <span className={styles.nameIcon} aria-hidden="true">
                  <IconFolder />
                </span>
                <input
                  id="lfaa-project-name"
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

              <div className={styles.sourceBox}>
                <div className={styles.sourceTabs} role="tablist" aria-label={locale.sourceFolderLabel}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceTab === "local"}
                    className={`${styles.sourceTab} ${sourceTab === "local" ? styles.sourceTabActive : ""}`}
                    onClick={() => {
                      setSourceTab("local");
                      setError("");
                    }}
                  >
                    <IconDeviceDesktop />
                    <span>{locale.locationLocal}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceTab === "remote"}
                    className={`${styles.sourceTab} ${sourceTab === "remote" ? styles.sourceTabActive : ""}`}
                    onClick={() => {
                      setSourceTab("remote");
                      setError("");
                    }}
                  >
                    <IconCloud />
                    <span>{locale.locationRemote}</span>
                  </button>
                </div>

                <ProjectSourcePicker
                  locale={locale}
                  sourceTab={sourceTab}
                  selectedFolder={selectedFolder}
                  manualPath={manualPath}
                  picking={picking}
                  onPickFolder={() => { void handlePickFolder(); }}
                  onClearFolder={() => {
                    setSelectedFolder("");
                    setManualPath("");
                  }}
                  onManualPathChange={(value) => {
                    setManualPath(value);
                    setError("");
                  }}
                  onApplyManualPath={() => { void handleApplyManualPath(); }}
                />
              </div>

              {sourceTab === "local" && (
                <>
                  <ProjectBriefField
                    locale={locale}
                    value={brief.brief}
                    disabled={submitting}
                    generating={brief.busy}
                    onChange={brief.updateBrief}
                    onRegenerate={() => brief.regenerate(selectedFolder || manualPath)}
                  />
                  {brief.notice && <p className={styles.defaultHint} role="status">{brief.notice}</p>}
                </>
              )}

              {error && <p className={styles.error} role="alert">{error}</p>}

              <footer className={styles.actions}>
                <button className={styles.cancel} type="button" disabled={submitting} onClick={onClose}>
                  {locale.cancel}
                </button>
                <button className={styles.submit} type="submit" disabled={submitting}>
                  {locale.create}
                </button>
              </footer>
            </form>
          </>
        )}
      </section>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.querySelector("[data-device]") ?? document.body);
}
