// 画布项目大厅操作 Hook：集中处理画布项目重命名、复制、删除（含默认工作区画布独立删除）、移动文件夹以及画布分类文件夹增删改名。
// 关联：packages/client/ui-canvas/client/canvas/Canvas-Workspace.tsx；运行环境：浏览器。
import type { Dispatch, SetStateAction } from "react";
import type { CanvasFolder } from "@lfaa/canvas/contract";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { WorkbenchProjectItem, WorkbenchProjectProvider } from "@lfaa/ui-layout/contract";
import {
  boardsPath,
  createBoard,
  createCanvasFolder,
  deleteBoard,
  deleteCanvasFolder,
  deleteProjectCanvas,
  duplicateBoard,
  renameCanvasFolder,
  type CanvasListItem,
} from "../api/canvas-api";

export const DEFAULT_CANVAS_HIDDEN_KEY = "lfaa-canvas-hide-default-workspace";

let pendingEditorTarget: { projectId: string; canvasId: string; expiresAt: number } | null = null;

/** 记录新建或跳转进入画布编辑器的瞬时目标，避免右栏重挂载丢失目标画布。 */
export function setPendingEditorTarget(projectId: string, canvasId: string): void {
  pendingEditorTarget = { projectId, canvasId, expiresAt: Date.now() + 1500 };
}

/** 消费待进入画布目标（优先内存暂存，其次 URL 查询参数）。 */
export function consumePendingEditorTarget(): { projectId: string; canvasId: string } | null {
  const target = pendingEditorTarget;
  pendingEditorTarget = null;
  if (target && Date.now() <= target.expiresAt) return { projectId: target.projectId, canvasId: target.canvasId };
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const qProject = params.get("canvasProject")?.trim();
    const qBoard = params.get("canvasBoard")?.trim();
    if (qProject && qBoard) return { projectId: qProject, canvasId: qBoard };
  }
  return null;
}

/** 为同一项目下的新建画布挑选不冲突的递增名称。 */
export function pickNextBoardTitle(boards: ReadonlyArray<{ title: string }>, isZh: boolean): string {
  const prefix = isZh ? "画布" : "Canvas";
  const used = new Set(boards.map((item, idx) => {
    const raw = item.title.trim();
    if (!raw || /^(?:未命名画布|Untitled canvas)(?:\s+\d+)?$/u.test(raw)) return `${prefix} ${idx + 1}`;
    return raw;
  }));
  let index = boards.length + 1;
  while (used.has(`${prefix} ${index}`)) index += 1;
  return `${prefix} ${index}`;
}

/** 在新标签页打开指定画布板。 */
export function openBoardInNewWindow(projectId: string | null, targetCanvasId: string): void {
  if (!projectId || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("canvasProject", projectId);
  url.searchParams.set("canvasBoard", targetCanvasId);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

/** 封装编辑器内的画布板新建、复制与删除（含最后一张删空时清理纯画布空壳项目）。 */
export function useCanvasBoardActions({
  isZh,
  effectiveProjectId,
  activeProject,
  provider,
  boards,
  boardId,
  setBoards,
  setBoardId,
  setInitial,
  setScreen,
  setError,
  bumpHubRefresh,
}: {
  isZh: boolean;
  effectiveProjectId: string | null;
  activeProject: WorkbenchProjectItem | undefined;
  provider?: WorkbenchProjectProvider<unknown> | null | undefined;
  boards: CanvasListItem[];
  boardId: string;
  setBoards: Dispatch<SetStateAction<CanvasListItem[]>>;
  setBoardId: Dispatch<SetStateAction<string>>;
  setInitial: Dispatch<SetStateAction<null>>;
  setScreen: Dispatch<SetStateAction<"hub" | "editor">>;
  setError: Dispatch<SetStateAction<string>>;
  bumpHubRefresh: () => void;
}) {
  async function handleCreateBoard() {
    if (!effectiveProjectId) return;
    try {
      const created = await createBoard(effectiveProjectId, pickNextBoardTitle(boards, isZh));
      setBoards((items) => [...items, { canvasId: created.canvasId, title: created.title }]);
      setBoardId(created.canvasId);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function handleDuplicateBoard(targetCanvasId: string, label: string) {
    if (!effectiveProjectId) return;
    try {
      const targetPath = `${boardsPath(effectiveProjectId)}/${encodeURIComponent(targetCanvasId)}`;
      const nextTitle = isZh ? `${label} 副本` : `${label} Copy`;
      const created = await duplicateBoard(targetPath, nextTitle);
      setBoards((items) => [...items, { canvasId: created.canvasId, title: created.title }]);
      setBoardId(created.canvasId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function handleDeleteBoard(targetCanvasId: string) {
    if (!effectiveProjectId) return;
    try {
      const targetPath = `${boardsPath(effectiveProjectId)}/${encodeURIComponent(targetCanvasId)}`;
      await deleteBoard(targetPath);
      const remaining = boards.filter((item) => item.canvasId !== targetCanvasId);
      setBoards(remaining);
      if (remaining.length === 0) {
        if (activeProject && activeProject.kind === "canvas" && !activeProject.isDefault && activeProject.chatCount === 0) {
          await provider?.removeProject?.(effectiveProjectId);
          await provider?.refreshProjects?.();
        }
        setInitial(null);
        setBoardId("");
        setScreen("hub");
        bumpHubRefresh();
        return;
      }
      if (boardId === targetCanvasId) {
        setInitial(null);
        setBoardId(remaining[0]!.canvasId);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return { handleCreateBoard, handleDuplicateBoard, handleDeleteBoard };
}

/** 进入具体画布项目即视为已进入项目工作：切到工作模式、同步左二高亮并绑定未开始的聊天草稿。 */
export function syncCanvasProjectContext(
  workbench: WorkbenchClientService | undefined,
  targetProjectId: string,
): void {
  if (!workbench || !targetProjectId) return;
  const snap = workbench.getSnapshot();
  if (snap.workspaceMode !== "codex") workbench.setWorkspaceMode("codex");
  if (snap.activeProjectId !== targetProjectId) workbench.setActiveProject(targetProjectId);
  if (!snap.activeChatSessionId && snap.chatProvider?.getDraftProjectId?.() !== targetProjectId) {
    void snap.chatProvider?.setActiveProjectBinding?.(targetProjectId);
  }
}

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
        // 默认工作区在画布侧独立删除：整组移入画布回收站（含 0 张空样板）并从大厅隐藏，不触碰左二栏工作区。
        await deleteProjectCanvas(targetId);
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
