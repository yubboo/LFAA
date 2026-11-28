// 无限画布「我的项目」入口大厅：展示已有画布的项目，支持首卡一键快建、顶栏弹窗自定义新建、缩放、搜索、排序、网格/列表切换与卡片更多操作菜单。
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { IconPhoto } from "@tabler/icons-react";
import type { CanvasFolder } from "@lfaa/canvas/contract";
import { assetUrl, boardsPath, libraryMediaUrl, listLibraryMedia } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import { CanvasHubCardGrid } from "./Canvas-Hub-Card-Grid";
import { CanvasHubCardMenu, type HubCardMenuAnchor } from "./Canvas-Hub-Card-Menu";
import { CanvasHubHeader } from "./Canvas-Hub-Header";
import { CanvasHubList } from "./Canvas-Hub-List";
import { CanvasTrashModal } from "./Canvas-Trash-Modal";
import {
  filterAndSortHubProjects,
  pickFallbackCoverPath,
  readCustomCovers,
  saveCustomCoverFile,
  type HubProjectCardItem,
  type ProjectHubSort,
  type ProjectHubViewMode,
} from "./project-hub-helpers";
import cardStyles from "./Canvas-Hub-Card.module.css";
import styles from "./Canvas-Projects-Hub.module.css";

const ZOOM_STORAGE_KEY = "lfaa-canvas-hub-zoom-v3";
const VIEW_STORAGE_KEY = "lfaa-canvas-hub-view";
const SORT_STORAGE_KEY = "lfaa-canvas-hub-sort";
const ZOOM_MIN = 9;
const ZOOM_MAX = 20;
const ZOOM_DEFAULT = 12;

function readInitialZoom(): number {
  const raw = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
  return Number.isFinite(raw) && raw >= ZOOM_MIN && raw <= ZOOM_MAX ? raw : ZOOM_DEFAULT;
}

function readInitialView(): ProjectHubViewMode {
  return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
}

function readInitialSort(): ProjectHubSort {
  return localStorage.getItem(SORT_STORAGE_KEY) === "name" ? "name" : "recent";
}

export function CanvasProjectsHub({
  t,
  isZh,
  items,
  folders = [],
  activeFolderId = null,
  loading,
  creating,
  error,
  onQuickCreate,
  onSelectFolder,
  onCreateAutoFolder,
  onRenameFolder,
  onDeleteFolder,
  onOpenProject,
  onRenameProject,
  onDuplicateProject,
  onMoveProjectFolder,
  onDeleteProject,
  onDeleteWorkspace,
  onTrashRestored,
}: {
  t: CanvasLabels;
  isZh: boolean;
  items: readonly HubProjectCardItem[];
  folders?: readonly CanvasFolder[];
  activeFolderId?: string | null;
  loading: boolean;
  creating: boolean;
  error: string;
  onQuickCreate: () => void;
  onSelectFolder?: (folderId: string | null) => void;
  onCreateAutoFolder?: () => Promise<CanvasFolder | null>;
  onRenameFolder?: (folderId: string, name: string) => void | Promise<void>;
  onDeleteFolder?: (folderId: string) => void;
  onOpenProject: (projectId: string, canvasId: string) => void;
  onRenameProject?: (projectId: string, name: string) => void;
  onDuplicateProject?: (item: HubProjectCardItem) => void;
  onMoveProjectFolder?: (projectId: string, folderId: string | null) => void;
  onDeleteProject?: (projectId: string) => void;
  onDeleteWorkspace?: (projectId: string) => void;
  onTrashRestored?: (info?: { restoredDefaultCanvas?: boolean }) => void;
}) {
  const [zoomRem, setZoomRem] = useState<number>(readInitialZoom);
  const [viewMode, setViewMode] = useState<ProjectHubViewMode>(readInitialView);
  const [sort, setSort] = useState<ProjectHubSort>(readInitialSort);
  const [trashOpen, setTrashOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [libraryImages, setLibraryImages] = useState<string[]>([]);
  const [customCovers, setCustomCovers] = useState<Record<string, string>>(readCustomCovers);
  const [menuAnchor, setMenuAnchor] = useState<HubCardMenuAnchor | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameDraft, setFolderRenameDraft] = useState("");
  const coverTargetRef = useRef<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // 拉取用户统一资料库中自己生成的图片，作为尚无画布图片项目的智能封面背景。
  useEffect(() => {
    const controller = new AbortController();
    void listLibraryMedia(40, controller.signal)
      .then((entries) => {
        if (controller.signal.aborted) return;
        setLibraryImages(entries.filter((entry) => entry.kind === "image").map((entry) => entry.path));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  /** 更新卡片上的鼠标坐标变量，驱动 1px 跟随流光边框与柔和表面光斑，不触发 React 重渲染。 */
  function trackCardGlow(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  const activeFolder = useMemo(
    () => (activeFolderId ? folders.find((item) => item.id === activeFolderId) ?? null : null),
    [activeFolderId, folders],
  );
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.canvasFolderId) counts.set(item.canvasFolderId, (counts.get(item.canvasFolderId) ?? 0) + 1);
    }
    return counts;
  }, [items]);
  const scopedItems = useMemo(() => {
    if (query.trim()) return items;
    if (activeFolderId) return items.filter((item) => item.canvasFolderId === activeFolderId);
    return items.filter((item) => !item.canvasFolderId);
  }, [activeFolderId, items, query]);
  const visibleItems = useMemo(
    () => filterAndSortHubProjects(scopedItems, query, sort),
    [scopedItems, query, sort],
  );
  const visibleFolders = !activeFolderId && !query.trim() ? folders : [];

  const now = Date.now();

  function updateZoom(next: number) {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    setZoomRem(clamped);
    localStorage.setItem(ZOOM_STORAGE_KEY, String(clamped));
  }

  function updateView(next: ProjectHubViewMode) {
    setViewMode(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  function renderCover(item: HubProjectCardItem) {
    if (customCovers[item.id]) return <img src={customCovers[item.id]} alt={item.name} className={cardStyles.coverImg} loading="lazy" />;
    if (item.coverAssetId) {
      const boardUrl = `${boardsPath(item.id)}/${encodeURIComponent(item.latestCanvasId)}`;
      return <img src={assetUrl(boardUrl, item.coverAssetId)} alt={item.name} className={cardStyles.coverImg} loading="lazy" />;
    }
    const fallbackPath = pickFallbackCoverPath(item.id, libraryImages);
    if (fallbackPath) return <img src={libraryMediaUrl(fallbackPath)} alt={item.name} className={cardStyles.coverImg} loading="lazy" />;
    return <IconPhoto size={22} stroke={1.5} className={cardStyles.coverPlaceholder} aria-hidden="true" />;
  }

  function commitRename(projectId: string, fallbackName: string) {
    const trimmed = renameDraft.trim();
    setRenamingId(null);
    if (trimmed && trimmed !== fallbackName) {
      onRenameProject?.(projectId, trimmed);
    }
  }

  function commitFolderRename(folderId: string, fallbackName: string) {
    const trimmed = folderRenameDraft.trim();
    setRenamingFolderId(null);
    if (trimmed && trimmed !== fallbackName) {
      void onRenameFolder?.(folderId, trimmed);
    }
  }

  async function handleCreateAutoFolder() {
    if (!onCreateAutoFolder) return;
    if (activeFolderId) onSelectFolder?.(null);
    const created = await onCreateAutoFolder();
    if (created) {
      setRenamingFolderId(created.id);
      setFolderRenameDraft(created.name);
    }
  }

  return (
    <div className={styles.hub}>
      <div className={styles.inner}>
        <CanvasHubHeader
          t={t}
          isZh={isZh}
          activeFolder={activeFolder}
          viewMode={viewMode}
          sort={sort}
          zoomRem={zoomRem}
          zoomMin={ZOOM_MIN}
          zoomMax={ZOOM_MAX}
          query={query}
          creating={creating}
          onSelectFolder={onSelectFolder}
          onUpdateZoom={updateZoom}
          onQueryChange={setQuery}
          onToggleSort={() => setSort((current) => {
            const next = current === "recent" ? "name" : "recent";
            localStorage.setItem(SORT_STORAGE_KEY, next);
            return next;
          })}
          onUpdateView={updateView}
          onOpenTrash={() => setTrashOpen(true)}
          onQuickCreate={onQuickCreate}
          onCreateFolderAuto={handleCreateAutoFolder}
        />

        {error && <div role="alert" className={styles.errorBanner}>{error}</div>}

        {viewMode === "grid" ? (
          <CanvasHubCardGrid
            t={t}
            isZh={isZh}
            zoomRem={zoomRem}
            creating={creating}
            folders={visibleFolders}
            folderCounts={folderCounts}
            items={visibleItems}
            now={now}
            renamingId={renamingId}
            renameDraft={renameDraft}
            renamingFolderId={renamingFolderId}
            folderRenameDraft={folderRenameDraft}
            openMenuProjectId={menuAnchor?.projectId ?? null}
            renderCover={renderCover}
            onTrackGlow={trackCardGlow}
            onQuickCreate={onQuickCreate}
            onOpenFolder={(folderId) => onSelectFolder?.(folderId)}
            onStartRenameFolder={(folder) => {
              setRenamingFolderId(folder.id);
              setFolderRenameDraft(folder.name);
            }}
            onFolderRenameDraftChange={setFolderRenameDraft}
            onCommitFolderRename={commitFolderRename}
            onCancelFolderRename={() => setRenamingFolderId(null)}
            onDeleteFolder={onDeleteFolder}
            onOpenProject={onOpenProject}
            onRenameDraftChange={setRenameDraft}
            onCommitRename={commitRename}
            onCancelRename={() => setRenamingId(null)}
            onOpenMenu={setMenuAnchor}
          />
        ) : (
          <CanvasHubList
            t={t}
            isZh={isZh}
            creating={creating}
            items={visibleItems}
            now={now}
            renamingId={renamingId}
            renameDraft={renameDraft}
            openMenuProjectId={menuAnchor?.projectId ?? null}
            renderCover={renderCover}
            onQuickCreate={onQuickCreate}
            onOpenProject={onOpenProject}
            onPickCover={(projectId) => {
              coverTargetRef.current = projectId;
              coverInputRef.current?.click();
            }}
            onDuplicate={(item) => onDuplicateProject?.(item)}
            onRenameDraftChange={setRenameDraft}
            onCommitRename={commitRename}
            onCancelRename={() => setRenamingId(null)}
            onOpenMenu={setMenuAnchor}
          />
        )}

        {!loading && (
          <p className={styles.footerHint}>
            {query.trim() && visibleItems.length === 0 ? t.noMatchingProjects : t.noMoreProjects}
          </p>
        )}
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          const targetId = coverTargetRef.current;
          event.target.value = "";
          if (!file || !targetId) return;
          void saveCustomCoverFile(targetId, file).then(setCustomCovers).catch(() => {});
        }}
      />

      {menuAnchor && (
        <CanvasHubCardMenu
          anchor={menuAnchor}
          isZh={isZh}
          folders={folders}
          onClose={() => setMenuAnchor(null)}
          onOpen={() => onOpenProject(menuAnchor.projectId, menuAnchor.canvasId)}
          onStartRename={() => {
            setRenamingId(menuAnchor.projectId);
            setRenameDraft(menuAnchor.name);
          }}
          onPickCover={() => {
            coverTargetRef.current = menuAnchor.projectId;
            coverInputRef.current?.click();
          }}
          onDuplicate={() => {
            const target = items.find((item) => item.id === menuAnchor.projectId);
            if (target) onDuplicateProject?.(target);
          }}
          onMoveFolder={(folderId) => onMoveProjectFolder?.(menuAnchor.projectId, folderId)}
          onDelete={() => onDeleteProject?.(menuAnchor.projectId)}
          onDeleteWorkspace={onDeleteWorkspace ? () => onDeleteWorkspace(menuAnchor.projectId) : undefined}
        />
      )}
      {trashOpen && (
        <CanvasTrashModal
          isZh={isZh}
          onClose={() => setTrashOpen(false)}
          onRestored={(info) => onTrashRestored?.(info)}
        />
      )}
    </div>
  );
}
