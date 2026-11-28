// 画布项目大厅顶栏：负责面包屑导航、缩放滑块、搜索、排序、视图切换、回收站与「+ 新建」下拉菜单（新建项目 / 新建文件夹）。
// 关联：packages/client/ui-canvas/client/projects/Canvas-Projects-Hub.tsx；运行环境：浏览器。
import { useEffect, useRef, useState } from "react";
import {
  IconArrowsSort,
  IconFolderPlus,
  IconLayoutGrid,
  IconList,
  IconMinus,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import type { CanvasFolder } from "@lfaa/canvas/contract";
import type { CanvasLabels } from "../locales";
import type { ProjectHubSort, ProjectHubViewMode } from "./project-hub-helpers";
import styles from "./Canvas-Projects-Hub.module.css";
import menuStyles from "./Canvas-Hub-Card-Menu.module.css";

export function CanvasHubHeader({
  t,
  isZh,
  activeFolder,
  viewMode,
  sort,
  zoomRem,
  zoomMin,
  zoomMax,
  query,
  creating,
  onSelectFolder,
  onUpdateZoom,
  onQueryChange,
  onToggleSort,
  onUpdateView,
  onOpenTrash,
  onQuickCreate,
  onCreateFolderAuto,
}: {
  t: CanvasLabels;
  isZh: boolean;
  activeFolder: CanvasFolder | null;
  viewMode: ProjectHubViewMode;
  sort: ProjectHubSort;
  zoomRem: number;
  zoomMin: number;
  zoomMax: number;
  query: string;
  creating: boolean;
  onSelectFolder?: ((folderId: string | null) => void) | undefined;
  onUpdateZoom: (next: number) => void;
  onQueryChange: (next: string) => void;
  onToggleSort: () => void;
  onUpdateView: (next: ProjectHubViewMode) => void;
  onOpenTrash: () => void;
  onQuickCreate: () => void;
  onCreateFolderAuto?: (() => void | Promise<void>) | undefined;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!newMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && newMenuRef.current?.contains(event.target)) return;
      setNewMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNewMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [newMenuOpen]);

  return (
    <header className={styles.header}>
      <h1 className={styles.heading}>
        {activeFolder ? (
          <span className={styles.breadcrumb}>
            <button type="button" className={styles.breadcrumbLink} onClick={() => onSelectFolder?.(null)}>{t.myProjects}</button>
            <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
            <span>{activeFolder.name}</span>
          </span>
        ) : t.myProjects}
      </h1>

      <div className={styles.toolbar}>
        {viewMode === "grid" && (
          <div className={styles.zoomPill} title={t.cardZoom}>
            <IconMinus size={13} stroke={1.8} aria-hidden="true" />
            <input
              type="range"
              min={zoomMin}
              max={zoomMax}
              step={0.5}
              value={zoomRem}
              aria-label={t.cardZoom}
              className={styles.zoomSlider}
              onChange={(event) => onUpdateZoom(Number(event.target.value))}
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
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  onQueryChange("");
                  setSearchOpen(false);
                }
              }}
            />
            <button
              type="button"
              className={styles.clearBtn}
              aria-label={isZh ? "关闭搜索" : "Close search"}
              onClick={() => {
                onQueryChange("");
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
          onClick={onToggleSort}
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
            onClick={() => onUpdateView("grid")}
          >
            <IconLayoutGrid size={14} stroke={1.8} />
          </button>
          <button
            type="button"
            className={styles.viewBtn}
            data-active={viewMode === "list" ? "true" : undefined}
            aria-label={t.listView}
            title={t.listView}
            onClick={() => onUpdateView("list")}
          >
            <IconList size={14} stroke={1.8} />
          </button>
        </div>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label={isZh ? "回收站" : "Recycle Bin"}
          title={isZh ? "回收站" : "Recycle Bin"}
          onClick={onOpenTrash}
        >
          <IconTrash size={15} stroke={1.8} />
        </button>

        <div ref={newMenuRef} className={menuStyles.newMenuWrap}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={creating}
            aria-haspopup="menu"
            aria-expanded={newMenuOpen}
            onClick={() => setNewMenuOpen((open) => !open)}
          >
            <IconPlus size={14} stroke={2.1} />
            <span>{isZh ? "新建" : "New"}</span>
          </button>

          {newMenuOpen && (
            <div role="menu" className={menuStyles.newMenu} aria-label={isZh ? "新建菜单" : "Create menu"}>
              <button
                type="button"
                role="menuitem"
                className={menuStyles.newMenuItem}
                onClick={() => {
                  setNewMenuOpen(false);
                  onQuickCreate();
                }}
              >
                <IconPlus size={15} stroke={1.9} aria-hidden="true" />
                <span>{isZh ? "新建项目" : "New project"}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuStyles.newMenuItem}
                onClick={() => {
                  setNewMenuOpen(false);
                  void onCreateFolderAuto?.();
                }}
              >
                <IconFolderPlus size={15} stroke={1.8} aria-hidden="true" />
                <span>{isZh ? "新建文件夹" : "New folder"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
