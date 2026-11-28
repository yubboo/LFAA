// 画布项目大厅操作 Hook：集中处理画布项目重命名、复制、删除（含默认工作区画布独立删除）、移动文件夹以及画布分类文件夹增删改名。
// 关联：packages/client/ui-canvas/client/canvas/Canvas-Workspace.tsx；运行环境：浏览器。
import type { Dispatch, SetStateAction } from "react";
import type { CanvasFolder } from "@lfaa/canvas/contract";
import type { WorkbenchProjectItem, WorkbenchProjectProvider } from "@lfaa/ui-layout/contract";
import {
  boardsPath,
  createBoard,
  createCanvasFolder,
  deleteBoard,
  deleteCanvasFolder,
  listBoards,
  renameCanvasFolder,
} from "../api/canvas-api";

export const DEFAULT_CANVAS_HIDDEN_KEY = "lfaa-canvas-hide-default-workspace";

function pickNextFolderName(folders: readonly CanvasFolder[], isZh: boolean): string {
  const base = isZh ? "新建文件夹" : "New folder";
  const taken = new Set(folders.map((item) => item.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let index = 2;
  while (taken.has(`${base} (${index})`.toLowerCase())) index += 1;
  return `${base} (${index})`;
}

export function useCanvasHubActions({
  isZh,
  projects,
  folders,
  provider,
  activeFolderId,
  setActiveFolderId,
  setFolders,
  setDefaultCanvasHidden,
  setCreating,
  setError,
  bumpHubRefresh,
}: {
  isZh: boolean;
  projects: readonly WorkbenchProjectItem[];
  folders: readonly CanvasFolder[];
  provider?: WorkbenchProjectProvider<unknown> | null | undefined;
  activeFolderId: string | null;
  setActiveFolderId: Dispatch<SetStateAction<string | null>>;
  setFolders: Dispatch<SetStateAction<CanvasFolder[]>>;
  setDefaultCanvasHidden: Dispatch<SetStateAction<boolean>>;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  bumpHubRefresh: () => void;
}) {
  async function renameHubProject(targetId: string, name: string) {
    try {
      await provider?.renameProject?.(targetId, name);
      bumpHubRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function duplicateHubProject(item: { id: string; name: string }) {
    if (!provider?.quickCreateProject) return;
    setCreating(true);
    setError("");
    try {
      const copyBase = isZh ? `${item.name} 副本` : `${item.name} Copy`;
      const created = await provider.quickCreateProject(copyBase, { kind: "canvas", canvasFolderId: activeFolderId });
      await createBoard(created.id, isZh ? "画布 1" : "Canvas 1");
      bumpHubRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  }

  async function createAutoFolder(): Promise<CanvasFolder | null> {
    try {
      const created = await createCanvasFolder(pickNextFolderName(folders, isZh));
      setFolders((prev) => [created, ...prev]);
      return created;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  }

  async function renameFolder(folderId: string, name: string) {
    try {
      const updated = await renameCanvasFolder(folderId, name);
      setFolders((prev) => prev.map((item) => (item.id === folderId ? updated : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function deleteFolder(folderId: string) {
    try {
      await deleteCanvasFolder(folderId);
      setFolders((prev) => prev.filter((item) => item.id !== folderId));
      if (activeFolderId === folderId) setActiveFolderId(null);
      await provider?.refreshProjects?.();
      bumpHubRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function moveHubProjectFolder(targetId: string, folderId: string | null) {
    try {
      await provider?.assignCanvasFolder?.(targetId, folderId);
      await provider?.refreshProjects?.();
      bumpHubRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function deleteHubProject(targetId: string) {
    const target = projects.find((item) => item.id === targetId);
    if (!target) return;
    try {
      if (target.isDefault) {
        // 默认工作区在画布侧独立删除：只将其画布内容移入画布回收站并从大厅移除，不触碰左二栏代码工作区与磁盘目录。
        const existingBoards = await listBoards(targetId, new AbortController().signal).catch(() => []);
        for (const board of existingBoards) {
          await deleteBoard(`${boardsPath(targetId)}/${encodeURIComponent(board.canvasId)}`).catch(() => {});
        }
        if (typeof localStorage !== "undefined") localStorage.setItem(DEFAULT_CANVAS_HIDDEN_KEY, "1");
        setDefaultCanvasHidden(true);
        bumpHubRefresh();
        return;
      }
      if (target.kind !== "canvas") return;
      await provider?.removeProject?.(targetId);
      await provider?.refreshProjects?.();
      bumpHubRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return {
    renameHubProject,
    duplicateHubProject,
    createAutoFolder,
    renameFolder,
    deleteFolder,
    moveHubProjectFolder,
    deleteHubProject,
  };
}
