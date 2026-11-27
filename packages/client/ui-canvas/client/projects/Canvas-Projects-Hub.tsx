// 无限画布「我的项目」入口大厅：展示已有画布的项目，支持首卡一键快建、顶栏弹窗自定义新建、缩放、搜索、排序、网格/列表切换与卡片更多操作菜单。
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  IconArrowsSort,
  IconLayoutGrid,
  IconList,
  IconMinus,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import type { WorkbenchSectionItem } from "@lfaa/ui-layout/contract";
import { assetUrl, boardsPath, libraryMediaUrl, listLibraryMedia } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import { CanvasHubCardGrid } from "./Canvas-Hub-Card-Grid";
import { CanvasHubCardMenu, type HubCardMenuAnchor } from "./Canvas-Hub-Card-Menu";
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
  sections = [],
  loading,
  creating,
  error,
  onQuickCreate,
  onOpenCreateDialog,
  onOpenProject,
  onRenameProject,
  onDuplicateProject,
  onMoveProjectSection,
  onDeleteProject,
  onTrashRestored,
}: {
  t: CanvasLabels;
  isZh: boolean;
  items: readonly HubProjectCardItem[];
  sections?: readonly WorkbenchSectionItem[];
  loading: boolean;
  creating: boolean;
  error: string;
  onQuickCreate: () => void;
  onOpenCreateDialog: () => void;
  onOpenProject: (projectId: string, canvasId: string) => void;
  onRenameProject?: (projectId: string, name: string) => void;
  onDuplicateProject?: (item: HubProjectCardItem) => void;
  onMoveProjectSection?: (projectId: string, sectionId: string | null) => void;
  onDeleteProject?: (projectId: string) => void;
  onTrashRestored?: () => void;
}) {
  const [zoomRem, setZoomRem] = useState<number>(readInitialZoom);
  const [viewMode, setViewMode] = useState<ProjectHubViewMode>(readInitialView);
  const [sort, setSort] = useState<ProjectHubSort>(readInitialSort);
  const [searchOpen, setSearchOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [libraryImages, setLibraryImages] = useState<string[]>([]);
  const [customCovers, setCustomCovers] = useState<Record<string, string>>(readCustomCovers);
  const [menuAnchor, setMenuAnchor] = useState<HubCardMenuAnchor | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
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

  const visibleItems = useMemo(
    () => filterAndSortHubProjects(items, query, sort),
    [items, query, sort],
  );

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

  return (
    <div className={styles.hub}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.heading}>{t.myProjects}</h1>

          <div className={styles.toolbar}>
            {viewMode === "grid" && (
              <div className={styles.zoomPill} title={t.cardZoom}>
                <IconMinus size={13} stroke={1.8} aria-hidden="true" />
                <input
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={0.5}
                  value={zoomRem}
                  aria-label={t.cardZoom}
                  className={styles.zoomSlider}
                  onChange={(event) => updateZoom(Number(event.target.value))}
                />
                <IconPlus size={13} stroke={1.8} aria-hidden="true" />
              </div>
            )}

            {searchOpen ? (
              <label className={styles.searchWrap}>
                <IconSearch size={14} stroke={1.8} aria-hidden="true" />
                <input
                  autoFocus
                  type="search"
                  className={styles.searchInput}
                  value={query}
                  placeholder={t.searchProjects}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setQuery("");
                      setSearchOpen(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.clearBtn}
                  aria-label={isZh ? "关闭搜索" : "Close search"}
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <IconX size={13} stroke={1.8} />
                </button>
              </label>
            ) : (
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={t.searchProjects}
                title={t.searchProjects}
                onClick={() => setSearchOpen(true)}
              >
                <IconSearch size={15} stroke={1.8} />
              </button>
            )}

            <button
              type="button"
              className={styles.iconBtn}
              data-active={sort === "name" ? "true" : undefined}
              aria-label={sort === "recent" ? t.sortRecent : t.sortName}
              title={sort === "recent" ? t.sortRecent : t.sortName}
              onClick={() => setSort((current) => {
                const next = current === "recent" ? "name" : "recent";
                localStorage.setItem(SORT_STORAGE_KEY, next);
                return next;
              })}
            >
              <IconArrowsSort size={15} stroke={1.8} />
            </button>

            <div className={styles.viewSwitch} role="group" aria-label={isZh ? "切换视图" : "View mode"}>
              <button
                type="button"
                className={styles.viewBtn}
                data-active={viewMode === "grid" ? "true" : undefined}
                aria-label={t.gridView}
                title={t.gridView}
                onClick={() => updateView("grid")}
              >
                <IconLayoutGrid size={14} stroke={1.8} />
              </button>
              <button
                type="button"
                className={styles.viewBtn}
                data-active={viewMode === "list" ? "true" : undefined}
                aria-label={t.listView}
                title={t.listView}
                onClick={() => updateView("list")}
              >
                <IconList size={14} stroke={1.8} />
              </button>
            </div>

            <button
              type="button"
              className={styles.iconBtn}
              aria-label={isZh ? "回收站" : "Recycle Bin"}
              title={isZh ? "回收站" : "Recycle Bin"}
              onClick={() => setTrashOpen(true)}
            >
              <IconTrash size={15} stroke={1.8} />
            </button>

            <button
              type="button"
              className={styles.primaryBtn}
              disabled={creating}
              onClick={onOpenCreateDialog}
            >
              <IconPlus size={14} stroke={2.2} />
              <span>{t.quickCreate}</span>
            </button>
          </div>
        </header>

        {error && <div role="alert" className={styles.errorBanner}>{error}</div>}

        {viewMode === "grid" ? (
          <CanvasHubCardGrid
            t={t}
            isZh={isZh}
            zoomRem={zoomRem}
            creating={creating}
            items={visibleItems}
            now={now}
            renamingId={renamingId}
            renameDraft={renameDraft}
            openMenuProjectId={menuAnchor?.projectId ?? null}
            renderCover={renderCover}
            onTrackGlow={trackCardGlow}
            onQuickCreate={onQuickCreate}
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
          sections={sections}
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
          onMoveSection={(sectionId) => onMoveProjectSection?.(menuAnchor.projectId, sectionId)}
          onDelete={() => onDeleteProject?.(menuAnchor.projectId)}
        />
      )}
      {trashOpen && (
        <CanvasTrashModal
          isZh={isZh}
          onClose={() => setTrashOpen(false)}
          onRestored={() => onTrashRestored?.()}
        />
      )}
    </div>
  );
}
