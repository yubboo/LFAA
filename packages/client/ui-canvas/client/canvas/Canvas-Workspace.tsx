// 项目画布入口：默认展示「我的项目」创建与管理大厅，新建或选择项目后同步左二栏并自动绑定进入无限画布编辑器。
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { BoardDetail, CanvasFolder, CanvasProjectSummary } from "@lfaa/canvas/contract";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import {
  boardsPath,
  createBoard,
  getBoard,
  getModels,
  listBoards,
  listCanvasFolders,
  listProjectSummaries,
  type CanvasListItem,
  type CanvasModel,
} from "../api/canvas-api";
import { labels } from "../locales";
import { CanvasCreateProjectModal } from "../projects/Canvas-Create-Project-Modal";
import { CanvasProjectsHub } from "../projects/Canvas-Projects-Hub";
import {
  buildHubProjectItems,
  readPersistedCanvasState,
  writePersistedCanvasState,
  type CanvasWorkspaceScreen,
  type PersistedCanvasWorkspaceState,
} from "../projects/project-hub-helpers";
import { CanvasEditor } from "./Canvas-Editor";
import { CanvasLoadingSkeleton } from "./Canvas-Loading-Skeleton";
import {
  DEFAULT_CANVAS_HIDDEN_KEY,
  consumePendingEditorTarget,
  openBoardInNewWindow,
  setPendingEditorTarget,
  syncCanvasProjectContext,
  useCanvasBoardActions,
  useCanvasHubActions,
} from "./useCanvasHubActions";
import styles from "./Canvas.module.css";

export default function CanvasWorkspace({
  projectId,
  isZh,
  workbench,
}: {
  projectId: string | null;
  isZh: boolean;
  workbench?: WorkbenchClientService;
}) {
  const t = labels[isZh ? "zh" : "en"];
  const wbSnap = useSyncExternalStore(
    workbench ? workbench.subscribe : () => () => {},
    () => workbench?.getSnapshot() ?? null,
    () => null,
  );

  const projects = useMemo(() => wbSnap?.projects ?? [], [wbSnap?.projects]);
  const projectIdsKey = useMemo(() => projects.map((item) => item.id).join("\n"), [projects]);
  const maximized = Boolean(wbSnap?.rightPanelMaximized);

  // 优先响应新建/URL直达目标，否则恢复上次停留的画布大厅或具体项目画布，F5 刷新不丢进度。
  const [initialState] = useState<PersistedCanvasWorkspaceState>(() => {
    const target = consumePendingEditorTarget();
    if (target) return { screen: "editor", projectId: target.projectId, boardId: target.canvasId };
    return readPersistedCanvasState();
  });
  const [screen, setScreen] = useState<CanvasWorkspaceScreen>(initialState.screen);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialState.projectId);
  const [summaries, setSummaries] = useState<CanvasProjectSummary[]>([]);
  const [folders, setFolders] = useState<CanvasFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [defaultCanvasHidden, setDefaultCanvasHidden] = useState<boolean>(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DEFAULT_CANVAS_HIDDEN_KEY) === "1",
  );
  const [hubLoading, setHubLoading] = useState(false);
  const [hubRefresh, setHubRefresh] = useState(0);
  const [creating, setCreating] = useState(false);

  const [boards, setBoards] = useState<CanvasListItem[]>([]);
  const [models, setModels] = useState<CanvasModel[]>([]);
  const [boardId, setBoardId] = useState(initialState.boardId);

  useEffect(() => {
    writePersistedCanvasState({ screen, projectId: selectedProjectId, boardId });
  }, [screen, selectedProjectId, boardId]);
  const [initial, setInitial] = useState<BoardDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createCanvasOpen, setCreateCanvasOpen] = useState(false);
  const [createCanvasError, setCreateCanvasError] = useState("");

  const effectiveProjectId = selectedProjectId ?? projectId ?? wbSnap?.activeProjectId ?? null;
  const activeProject = projects.find((item) => item.id === effectiveProjectId);
  const hubItems = useMemo(
    () => buildHubProjectItems(projects, summaries).filter((item) => !(defaultCanvasHidden && item.isDefault)),
    [defaultCanvasHidden, projects, summaries],
  );

  const base = effectiveProjectId ? boardsPath(effectiveProjectId) : "";
  const preference = "lfaa-canvas-board:" + effectiveProjectId;
  const path = boardId ? base + "/" + boardId : "";

  useEffect(() => {
    if (screen === "editor" && effectiveProjectId) syncCanvasProjectContext(workbench, effectiveProjectId);
  }, [screen, effectiveProjectId, workbench]);

  // 在「我的项目」大厅拉取画布项目摘要与画布分类文件夹，严格过滤普通代码项目。
  useEffect(() => {
    if (screen !== "hub") return;
    const ids = projectIdsKey ? projectIdsKey.split("\n") : [];
    const controller = new AbortController();
    setHubLoading(true);
    setError("");
    void Promise.all([
      ids.length > 0 ? listProjectSummaries(ids, controller.signal) : Promise.resolve([]),
      listCanvasFolders(controller.signal).catch(() => [] as CanvasFolder[]),
    ])
      .then(([items, folderList]) => {
        if (controller.signal.aborted) return;
        setSummaries(items);
        setFolders(folderList);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(String(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHubLoading(false);
      });
    return () => controller.abort();
  }, [screen, projectIdsKey, hubRefresh]);

  // 进入编辑器时加载当前项目的画布列表（无画布时自动初始化默认画布）与模型清单。
  useEffect(() => {
    if (screen !== "editor" || !effectiveProjectId) return;
    const controller = new AbortController();
    setError("");
    void listBoards(effectiveProjectId, controller.signal).then(async (items) => {
      if (controller.signal.aborted) return;
      if (items.length === 0) {
        const created = await createBoard(effectiveProjectId, isZh ? "画布 1" : "Canvas 1");
        if (controller.signal.aborted) return;
        setBoards([{ canvasId: created.canvasId, title: created.title }]);
        setBoardId(created.canvasId);
        return;
      }
      setBoards(items);
      setBoardId((current) => {
        if (current && items.some((item) => item.canvasId === current)) return current;
        const remembered = localStorage.getItem(preference);
        return remembered && items.some((item) => item.canvasId === remembered)
          ? remembered
          : items[0]!.canvasId;
      });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(String(cause));
    });

    void getModels(controller.signal).then(setModels).catch(() => {});
    return () => controller.abort();
  }, [screen, effectiveProjectId, preference, retry, t.untitledBoard]);

  useEffect(() => {
    if (screen !== "editor" || !path) return;
    const controller = new AbortController();
    setError("");
    void getBoard(path, controller.signal).then((data) => {
      setInitial(data);
      localStorage.setItem(preference, data.board.canvasId);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(String(cause));
    });
    return () => controller.abort();
  }, [screen, path, preference, retry]);

  /** 绑定项目并进入对应画布编辑器；新项目自动初始化默认画布，确保左二栏与大厅双向收录。 */
  async function enterProjectCanvas(targetProjectId: string, preferredCanvasId?: string) {
    setError("");
    let targetCanvasId = preferredCanvasId;
    if (!targetCanvasId) {
      const created = await createBoard(targetProjectId, isZh ? "画布 1" : "Canvas 1");
      targetCanvasId = created.canvasId;
      setBoards([{ canvasId: created.canvasId, title: created.title }]);
    }
    setPendingEditorTarget(targetProjectId, targetCanvasId);
    syncCanvasProjectContext(workbench, targetProjectId);
    setSelectedProjectId(targetProjectId);
    setInitial(null);
    setBoardId(targetCanvasId);
    setScreen("editor");
  }

  function openCreateCanvasModal() {
    if (creating) return;
    if (!wbSnap?.projectProvider?.quickCreateProject) {
      setCreateProjectOpen(true);
      return;
    }
    setCreateCanvasError("");
    setCreateCanvasOpen(true);
  }

  async function handleCreateNamedProject(rawName: string) {
    if (creating) return;
    const quickCreate = wbSnap?.projectProvider?.quickCreateProject;
    if (!quickCreate) return;
    setCreating(true);
    setCreateCanvasError("");
    setError("");
    try {
      const created = await quickCreate(rawName, { kind: "canvas", canvasFolderId: activeFolderId });
      setCreateCanvasOpen(false);
      await enterProjectCanvas(created.id);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setCreateCanvasError(message);
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  const boardActions = useCanvasBoardActions({
    isZh,
    effectiveProjectId,
    activeProject,
    provider: wbSnap?.projectProvider,
    boards,
    boardId,
    setBoards,
    setBoardId,
    setInitial: () => setInitial(null),
    setScreen,
    setError,
    bumpHubRefresh: () => setHubRefresh((count) => count + 1),
  });

  const projectDialog = createProjectOpen && wbSnap?.projectProvider?.renderCreateDialog
    ? wbSnap.projectProvider.renderCreateDialog({
        onCreated: (project) => {
          setCreateProjectOpen(false);
          setCreating(true);
          void enterProjectCanvas(project.id)
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
            .finally(() => setCreating(false));
        },
        onClose: () => setCreateProjectOpen(false),
      })
    : null;

  const renderFullscreenChat = wbSnap?.views.find((v) => v.id === "workspace")?.render;

  const hubActions = useCanvasHubActions({
    isZh,
    projects,
    folders,
    provider: wbSnap?.projectProvider,
    activeFolderId,
    setActiveFolderId,
    setFolders,
    setDefaultCanvasHidden,
    setCreating,
    setError,
    bumpHubRefresh: () => setHubRefresh((count) => count + 1),
  });

  const createCanvasModal = createCanvasOpen ? (
    <CanvasCreateProjectModal
      isZh={isZh}
      existingNames={projects.map((item) => item.name)}
      busy={creating}
      error={createCanvasError}
      onClose={() => setCreateCanvasOpen(false)}
      onConfirm={handleCreateNamedProject}
    />
  ) : null;

  if (screen === "hub") {
    return (
      <>
        <CanvasProjectsHub
          t={t}
          isZh={isZh}
          items={hubItems}
          folders={folders}
          activeFolderId={activeFolderId}
          loading={hubLoading}
          creating={creating}
          error={error}
          onQuickCreate={openCreateCanvasModal}
          onSelectFolder={setActiveFolderId}
          onCreateAutoFolder={() => hubActions.createAutoFolder()}
          onRenameFolder={(folderId, name) => void hubActions.renameFolder(folderId, name)}
          onDeleteFolder={(folderId) => void hubActions.deleteFolder(folderId)}
          onOpenProject={(targetId, latestCanvasId) => void enterProjectCanvas(targetId, latestCanvasId || undefined)}
          onRenameProject={(targetId, name) => void hubActions.renameHubProject(targetId, name)}
          onDuplicateProject={(item) => void hubActions.duplicateHubProject(item)}
          onMoveProjectFolder={(targetId, folderId) => void hubActions.moveHubProjectFolder(targetId, folderId)}
          onDeleteProject={(targetId) => void hubActions.deleteHubProject(targetId)}
          onDeleteWorkspace={(targetId) => wbSnap?.projectProvider?.requestDeleteWorkspace?.(targetId)}
          onTrashRestored={(info) => {
            if (info?.restoredDefaultCanvas) {
              if (typeof localStorage !== "undefined") localStorage.removeItem(DEFAULT_CANVAS_HIDDEN_KEY);
              setDefaultCanvasHidden(false);
            }
            void wbSnap?.projectProvider?.refreshProjects?.().then(() => setHubRefresh((count) => count + 1));
          }}
        />
        {projectDialog}
        {createCanvasModal}
      </>
    );
  }

  if (initial && initial.board.canvasId === boardId) {
    return (
      <>
        <CanvasEditor
          key={boardId}
          path={path}
          initial={initial}
          boards={boards}
          projectName={activeProject?.name ?? t.untitledProject}
          models={models}
          isZh={isZh}
          maximized={maximized}
          onSelectBoard={(id) => setBoardId(id)}
          onCreateBoard={() => void boardActions.handleCreateBoard()}
          onOpenInNewWindow={(id) => openBoardInNewWindow(effectiveProjectId, id)}
          onDuplicateBoard={(id, label) => void boardActions.handleDuplicateBoard(id, label)}
          onDeleteBoard={(id) => void boardActions.handleDeleteBoard(id)}
          onBackToProjects={() => {
            setScreen("hub");
            setHubRefresh((count) => count + 1);
          }}
          onRenamed={(title) => setBoards((list) => list.map((b) => b.canvasId === boardId ? { ...b, title } : b))}
          renderFullscreenChat={renderFullscreenChat}
        />
        {projectDialog}
        {createCanvasModal}
      </>
    );
  }

  if (error) {
    return (
      <div className={styles.start}>
        <div role="alert" className={styles.errorToast}>
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((r) => r + 1)}>{t.reload}</button>
        </div>
        {projectDialog}
      </div>
    );
  }

  return (
    <>
      <CanvasLoadingSkeleton isZh={isZh} />
      {projectDialog}
    </>
  );
}
