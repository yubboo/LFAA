// 项目画布入口：自动载入或创建默认画布直达沉浸式编辑器，并复用左二栏同款创建项目弹窗与全屏对话抽屉。
import { useEffect, useState, useSyncExternalStore } from "react";
import { IconFolderPlus } from "@tabler/icons-react";
import type { BoardDetail } from "@lfaa/canvas/contract";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import { boardsPath, createBoard, getBoard, getModels, listBoards, type CanvasListItem, type CanvasModel } from "../api/canvas-api";
import { labels } from "../locales";
import { CanvasEditor } from "./Canvas-Editor";
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

  const effectiveProjectId = projectId ?? wbSnap?.activeProjectId ?? wbSnap?.projects[0]?.id ?? null;
  const activeProject = wbSnap?.projects.find((item) => item.id === effectiveProjectId);
  const maximized = Boolean(wbSnap?.rightPanelMaximized);

  const [boards, setBoards] = useState<CanvasListItem[]>([]);
  const [models, setModels] = useState<CanvasModel[]>([]);
  const [boardId, setBoardId] = useState("");
  const [initial, setInitial] = useState<BoardDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const base = effectiveProjectId ? boardsPath(effectiveProjectId) : "";
  const preference = "lfaa-canvas-board:" + effectiveProjectId;
  const path = boardId ? base + "/" + boardId : "";

  // 有项目时自动进入上次画布或自动创建默认「未命名画布」，直达沉浸式画布不拦路。
  useEffect(() => {
    if (!effectiveProjectId) return;
    const controller = new AbortController();
    setError("");
    void listBoards(effectiveProjectId, controller.signal).then(async (items) => {
      if (controller.signal.aborted) return;
      if (items.length === 0) {
        const created = await createBoard(effectiveProjectId, t.untitledBoard);
        if (controller.signal.aborted) return;
        setBoards([{ canvasId: created.canvasId, title: created.title }]);
        setBoardId(created.canvasId);
        return;
      }
      setBoards(items);
      const remembered = localStorage.getItem(preference);
      const target = remembered && items.some((item) => item.canvasId === remembered)
        ? remembered
        : items[0]!.canvasId;
      setBoardId(target);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(String(cause));
    });

    void getModels(controller.signal).then(setModels).catch(() => {});
    return () => controller.abort();
  }, [effectiveProjectId, preference, retry, t.untitledBoard]);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setError("");
    void getBoard(path, controller.signal).then((data) => {
      setInitial(data);
      localStorage.setItem(preference, data.board.canvasId);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(String(cause));
    });
    return () => controller.abort();
  }, [path, preference, retry]);

  async function handleCreateBoard() {
    if (!effectiveProjectId) return;
    try {
      const nextTitle = `${t.untitledBoard} ${boards.length + 1}`;
      const created = await createBoard(effectiveProjectId, nextTitle);
      setBoards((items) => [...items, { canvasId: created.canvasId, title: created.title }]);
      setBoardId(created.canvasId);
    } catch (cause) {
      setError(String(cause));
    }
  }

  const projectDialog = createProjectOpen && wbSnap?.projectProvider?.renderCreateDialog
    ? wbSnap.projectProvider.renderCreateDialog({
        onCreated: (project) => {
          setCreateProjectOpen(false);
          workbench?.setActiveProject(project.id);
        },
        onClose: () => setCreateProjectOpen(false),
      })
    : null;

  const renderFullscreenChat = wbSnap?.views.find((v) => v.id === "workspace")?.render;

  if (!effectiveProjectId) {
    return (
      <div className={styles.start}>
        <p className={styles.startHint}>{t.noProject}</p>
        {wbSnap?.projectProvider?.renderCreateDialog && (
          <button type="button" className={styles.createProjectBtn} onClick={() => setCreateProjectOpen(true)}>
            <IconFolderPlus size={16} />
            <span>{t.createProject}</span>
          </button>
        )}
        {projectDialog}
      </div>
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
          onCreateProject={wbSnap?.projectProvider?.renderCreateDialog ? () => setCreateProjectOpen(true) : undefined}
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
