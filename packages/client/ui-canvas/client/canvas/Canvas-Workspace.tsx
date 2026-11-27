// 项目画布入口：默认展示「我的项目」创建与管理大厅，新建或选择项目后同步左二栏并自动绑定进入无限画布编辑器。
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { BoardDetail, CanvasProjectSummary } from "@lfaa/canvas/contract";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import {
  boardsPath,
  createBoard,
  deleteBoard,
  duplicateBoard,
  getBoard,
  getModels,
  listBoards,
  listProjectSummaries,
  type CanvasListItem,
  type CanvasModel,
} from "../api/canvas-api";
import { labels } from "../locales";
import { CanvasProjectsHub } from "../projects/Canvas-Projects-Hub";
import {
  buildHubProjectItems,
  readPersistedCanvasState,
  writePersistedCanvasState,
  type CanvasWorkspaceScreen,
  type PersistedCanvasWorkspaceState,
} from "../projects/project-hub-helpers";
import { CanvasEditor } from "./Canvas-Editor";
import styles from "./Canvas.module.css";

/** 切换激活项目可能触发右栏插件重挂载：短暂暂存待进入的画布目标，确保新建或点卡片后直达编辑器。 */
let pendingEditorTarget: { projectId: string; canvasId: string; expiresAt: number } | null = null;

function consumePendingTarget(): { projectId: string; canvasId: string } | null {
  const target = pendingEditorTarget;
  pendingEditorTarget = null;
  if (target && Date.now() <= target.expiresAt) {
    return { projectId: target.projectId, canvasId: target.canvasId };
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const qProject = params.get("canvasProject")?.trim();
    const qBoard = params.get("canvasBoard")?.trim();
    if (qProject && qBoard) return { projectId: qProject, canvasId: qBoard };
  }
  return null;
}

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
    const target = consumePendingTarget();
    if (target) return { screen: "editor", projectId: target.projectId, boardId: target.canvasId };
    return readPersistedCanvasState();
  });
  const [screen, setScreen] = useState<CanvasWorkspaceScreen>(initialState.screen);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialState.projectId);
  const [summaries, setSummaries] = useState<CanvasProjectSummary[]>([]);
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

  const effectiveProjectId = selectedProjectId ?? projectId ?? wbSnap?.activeProjectId ?? null;
  const activeProject = projects.find((item) => item.id === effectiveProjectId);
  const hubItems = useMemo(() => buildHubProjectItems(projects, summaries), [projects, summaries]);

  const base = effectiveProjectId ? boardsPath(effectiveProjectId) : "";
  const preference = "lfaa-canvas-board:" + effectiveProjectId;
  const path = boardId ? base + "/" + boardId : "";

  // 在「我的项目」大厅批量拉取已有画布的项目摘要，过滤掉普通纯代码项目。
  useEffect(() => {
    if (screen !== "hub") return;
    const ids = projectIdsKey ? projectIdsKey.split("\n") : [];
    if (ids.length === 0) {
      setSummaries([]);
      setHubLoading(false);
      return;
    }
    const controller = new AbortController();
    setHubLoading(true);
    setError("");
    void listProjectSummaries(ids, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setSummaries(items);
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
    pendingEditorTarget = { projectId: targetProjectId, canvasId: targetCanvasId, expiresAt: Date.now() + 1500 };
    workbench?.setActiveProject(targetProjectId);
    setSelectedProjectId(targetProjectId);
    setInitial(null);
    setBoardId(targetCanvasId);
    setScreen("editor");
  }

  async function handleCreateBoard() {
    if (!effectiveProjectId) return;
    try {
      const prefix = isZh ? "画布" : "Canvas";
      const used = new Set(boards.map((item, idx) => {
        const raw = item.title.trim();
        if (!raw || /^(?:未命名画布|Untitled canvas)(?:\s+\d+)?$/u.test(raw)) return `${prefix} ${idx + 1}`;
        return raw;
      }));
      let index = boards.length + 1;
      while (used.has(`${prefix} ${index}`)) index += 1;
      const created = await createBoard(effectiveProjectId, `${prefix} ${index}`);
      setBoards((items) => [...items, { canvasId: created.canvasId, title: created.title }]);
      setBoardId(created.canvasId);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function handleQuickCreateProject() {
    if (creating) return;
    const quickCreate = wbSnap?.projectProvider?.quickCreateProject;
    if (!quickCreate) {
      setCreateProjectOpen(true);
      return;
    }
    setCreating(true);
    setError("");
    try {
      const created = await quickCreate(t.untitledProject);
      await enterProjectCanvas(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  }

  function handleOpenInNewWindow(targetCanvasId: string) {
    if (!effectiveProjectId || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("canvasProject", effectiveProjectId);
    url.searchParams.set("canvasBoard", targetCanvasId);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
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
        // 纯画布项目（尚无对话）删空最后一张画布时同步移出左二栏空壳；回收站恢复画布时会自动连带还原项目。
        if (activeProject && activeProject.chatCount === 0) {
          await wbSnap?.projectProvider?.removeProject?.(effectiveProjectId);
          await wbSnap?.projectProvider?.refreshProjects?.();
        }
        setInitial(null); setBoardId(""); setScreen("hub"); setHubRefresh((count) => count + 1);
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

  async function handleRenameHubProject(targetId: string, name: string) {
    try {
      await wbSnap?.projectProvider?.renameProject?.(targetId, name);
      setHubRefresh((count) => count + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function handleDuplicateHubProject(item: { id: string; name: string }) {
    const provider = wbSnap?.projectProvider;
    if (!provider?.quickCreateProject) return;
    setCreating(true);
    setError("");
    try {
      const copyBase = isZh ? `${item.name} 副本` : `${item.name} Copy`;
      const created = await provider.quickCreateProject(copyBase);
      await createBoard(created.id, isZh ? "画布 1" : "Canvas 1");
      setHubRefresh((count) => count + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  }

  async function handleMoveHubProjectSection(targetId: string, sectionId: string | null) {
    try {
      await wbSnap?.projectProvider?.assignProjectSection?.(targetId, sectionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function handleDeleteHubProject(targetId: string) {
    try {
      await wbSnap?.projectProvider?.removeProject?.(targetId);
      await wbSnap?.projectProvider?.refreshProjects?.();
      setHubRefresh((count) => count + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  if (screen === "hub") {
    return (
      <>
        <CanvasProjectsHub
          t={t}
          isZh={isZh}
          items={hubItems}
          sections={wbSnap?.sections ?? []}
          loading={hubLoading}
          creating={creating}
          error={error}
          onQuickCreate={() => void handleQuickCreateProject()}
          onOpenCreateDialog={() => setCreateProjectOpen(true)}
          onOpenProject={(targetId, latestCanvasId) => void enterProjectCanvas(targetId, latestCanvasId)}
          onRenameProject={(targetId, name) => void handleRenameHubProject(targetId, name)}
          onDuplicateProject={(item) => void handleDuplicateHubProject(item)}
          onMoveProjectSection={(targetId, sectionId) => void handleMoveHubProjectSection(targetId, sectionId)}
          onDeleteProject={(targetId) => void handleDeleteHubProject(targetId)}
          onTrashRestored={() => {
            void wbSnap?.projectProvider?.refreshProjects?.().then(() => setHubRefresh((count) => count + 1));
          }}
        />
        {projectDialog}
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
          onCreateBoard={() => void handleCreateBoard()}
          onOpenInNewWindow={handleOpenInNewWindow}
          onDuplicateBoard={(id, label) => void handleDuplicateBoard(id, label)}
          onDeleteBoard={(id) => void handleDeleteBoard(id)}
          onBackToProjects={() => {
            setScreen("hub");
            setHubRefresh((count) => count + 1);
          }}
          onRenamed={(title) => setBoards((list) => list.map((b) => b.canvasId === boardId ? { ...b, title } : b))}
          renderFullscreenChat={renderFullscreenChat}
        />
        {projectDialog}
      </>
    );
  }

  return (
    <div className={styles.start}>
      {error ? (
        <div role="alert" className={styles.errorToast}>
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((r) => r + 1)}>{t.reload}</button>
        </div>
      ) : (
        <p className={styles.startHint}>{isZh ? "正在打开画布…" : "Opening canvas…"}</p>
      )}
      {projectDialog}
    </div>
  );
}
