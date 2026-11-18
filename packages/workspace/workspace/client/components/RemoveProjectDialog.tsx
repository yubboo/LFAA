// 移出项目二次确认弹窗：复用 @lfaa/ui-primitives 的共享 ConfirmDialog，明确告知仅从应用中移出。
import { useState } from "react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import { ConfirmDialog } from "@lfaa/ui-primitives/client";
import type { LocalProjectStore } from "../local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";

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

  return (
    <ConfirmDialog
      open
      title={`${locale.removeConfirmPrefix} ${project.name}?`}
      description={locale.removeConfirmDescription}
      cancelLabel={locale.cancel}
      confirmLabel={busy ? locale.removingProject : locale.removeProjectMenu}
      closeLabel={locale.close}
      busy={busy}
      error={error}
      onConfirm={() => { void handleConfirm(); }}
      onClose={onClose}
    />
  );
}
