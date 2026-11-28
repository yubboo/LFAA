// 移出项目二次确认弹窗：复用 @lfaa/ui-primitives 的共享 ConfirmDialog，明确告知仅从应用中移出。
import { useState } from "react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import { ConfirmDialog } from "@lfaa/ui-primitives/client";
import type { LocalProjectStore } from "../store/local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";

/** 请求用户确认从应用列表移出项目，项目文件仍由原目录管理。 */
export function RemoveProjectDialog({
  locale,
  project,
  deleteDisk = false,
  store,
  onRemoved,
  onClose,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  deleteDisk?: boolean;
  store: LocalProjectStore;
  onRemoved: (projectId: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isDefaultDeleteDisk = Boolean(project.isDefault && deleteDisk);
  const isDefaultUnbindOnly = Boolean(project.isDefault && !deleteDisk);
  const isCanvasProject = project.kind === "canvas";

  const handleConfirm = async () => {
    setError("");
    setBusy(true);
    try {
      const removed = await store.removeProject(
        project.id,
        isDefaultDeleteDisk
          ? { permanent: true, deleteDisk: true }
          : isDefaultUnbindOnly
            ? { permanent: true, deleteDisk: false }
            : undefined,
      );
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

  const title = isDefaultDeleteDisk
    ? `删除工作区「${project.name}」？`
    : `${locale.removeConfirmPrefix} ${project.name}?`;
  const description = isDefaultDeleteDisk
    ? `将删除默认工作区目录（${project.rootPath ?? "default-workspace"}）并从左二栏与无限画布同步移除，重启后不再自动重建。此操作不可恢复。`
    : isDefaultUnbindOnly
      ? "仅从应用列表移出，不会删除硬盘上的默认工作区文件夹。"
      : isCanvasProject
        ? "移入回收站后将从左二栏与无限画布「我的项目」同时移除，30 天内可在无限画布回收站还原。"
        : locale.removeConfirmDescription;
  const confirmLabel = busy
    ? locale.removingProject
    : isDefaultDeleteDisk
      ? "确认删除工作区"
      : locale.removeProjectMenu;

  return (
    <ConfirmDialog
      open
      title={title}
      description={description}
      cancelLabel={locale.cancel}
      confirmLabel={confirmLabel}
      closeLabel={locale.close}
      busy={busy}
      error={error}
      onConfirm={() => { void handleConfirm(); }}
      onClose={onClose}
    />
  );
}
