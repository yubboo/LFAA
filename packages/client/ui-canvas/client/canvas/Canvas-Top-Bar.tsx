// 画布顶部多画布标签栏：支持「< | 项目名 | 画布 1 | [画布 2 ···] + 列表」，··· 菜单含新窗口打开、重命名、复制与删除。
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconChevronLeft,
  IconCopy,
  IconDots,
  IconExternalLink,
  IconFocus2,
  IconList,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import type { CanvasNode } from "@lfaa/canvas/contract";
import type { CanvasListItem } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import styles from "./Canvas-Top-Bar.module.css";

export function CanvasTopBar({
  t,
  isZh,
  projectName,
  boardId,
  boardTitle,
  boards,
  nodes,
  dirty,
  onSelectBoard,
  onCreateBoard,
  onOpenInNewWindow,
  onDuplicateBoard,
  onDeleteBoard,
  onBackToProjects,
  onCommitRename,
  onFocusNode,
}: {
  t: CanvasLabels;
  isZh: boolean;
  projectName: string;
  boardId: string;
  boardTitle: string;
  boards: CanvasListItem[];
  nodes: CanvasNode[];
  dirty: boolean;
  onSelectBoard: (canvasId: string) => void;
  onCreateBoard: () => void;
  onOpenInNewWindow: (canvasId: string) => void;
  onDuplicateBoard: (canvasId: string, label: string) => void;
  onDeleteBoard: (canvasId: string) => void;
  onBackToProjects?: (() => void) | undefined;
  onCommitRename: (nextTitle: string) => Promise<void>;
  onFocusNode: (node: CanvasNode) => void;
}) {
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState(boardTitle);
  const [tabMenu, setTabMenu] = useState<{ boardId: string; label: string; top: number; left: number } | null>(null);
  const [listMenu, setListMenu] = useState<{ top: number; left: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    setTitleDraft(boardTitle);
    setEditingBoardId(null);
    setTabMenu(null);
    setListMenu(null);
  }, [boardId, boardTitle]);

  const matchedNodes = searchText.trim()
    ? nodes.filter((node, i) => `${t[node.kind]}${i + 1} ${node.settings.prompt ?? ""}`.toLowerCase().includes(searchText.trim().toLowerCase()))
    : [];

  /** 历史遗留的「未命名画布 / 未命名画布 2」占位名按序号呈现为「画布 N」，用户自定义名原样展示。 */
  function displayTabTitle(board: CanvasListItem, index: number): string {
    const raw = board.title.trim();
    if (!raw || /^(?:未命名画布|Untitled canvas)(?:\s+\d+)?$/u.test(raw)) {
      return isZh ? `画布 ${index + 1}` : `Canvas ${index + 1}`;
    }
    return raw;
  }

  async function finishRename() {
    setEditingBoardId(null);
    const clean = titleDraft.trim();
    if (!clean || clean === boardTitle) {
      setTitleDraft(boardTitle);
      return;
    }
    await onCommitRename(clean);
  }

  return (
    <div className={styles.bar} onClick={() => { setTabMenu(null); setListMenu(null); }}>
      <div className={styles.left} onClick={(e) => e.stopPropagation()}>
        {onBackToProjects ? (
          <button
            type="button"
            className={styles.backBtn}
            aria-label={t.backToProjects}
            title={t.backToProjects}
            onClick={onBackToProjects}
          >
            <IconChevronLeft size={16} stroke={1.9} aria-hidden="true" />
            <span className={styles.projectName}>{projectName || t.untitledProject}</span>
          </button>
        ) : (
          <span className={styles.projectName} title={projectName || t.untitledProject}>
            {projectName || t.untitledProject}
          </span>
        )}

        <span className={styles.divider} aria-hidden="true" />

        <div className={styles.tabStrip} role="tablist" aria-label={t.boards}>
          {boards.map((board, index) => {
            const active = board.canvasId === boardId;
            const label = displayTabTitle(board, index);
            const isEditing = active && editingBoardId === board.canvasId;

            return (
              <div
                key={board.canvasId}
                role="tab"
                tabIndex={active ? 0 : -1}
                aria-selected={active}
                className={styles.tab}
                data-active={active ? "true" : undefined}
                onClick={() => {
                  setTabMenu(null);
                  setListMenu(null);
                  if (!active) onSelectBoard(board.canvasId);
                }}
                onDoubleClick={() => {
                  if (!active) return;
                  setTitleDraft(label);
                  setEditingBoardId(board.canvasId);
                }}
              >
                <IconFocus2 size={14} stroke={1.7} aria-hidden="true" />
                {isEditing ? (
                  <input
                    autoFocus
                    className={styles.tabInput}
                    value={titleDraft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => void finishRename()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void finishRename();
                      if (e.key === "Escape") { setEditingBoardId(null); setTitleDraft(boardTitle); }
                    }}
                  />
                ) : (
                  <span className={styles.tabTitle} title={label}>{label}</span>
                )}

                {active && !isEditing && (
                  <button
                    type="button"
                    className={styles.tabMoreBtn}
                    aria-label={isZh ? "画布操作" : "Canvas actions"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setListMenu(null);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTabMenu((current) => (current?.boardId === board.canvasId
                        ? null
                        : { boardId: board.canvasId, label, top: rect.bottom + 6, left: rect.left }));
                    }}
                  >
                    <IconDots size={13} stroke={1.9} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.addTabBtn}
          aria-label={t.create}
          title={t.create}
          onClick={onCreateBoard}
        >
          <IconPlus size={15} stroke={1.9} />
        </button>

        <button
          type="button"
          className={styles.addTabBtn}
          data-active={listMenu ? "true" : undefined}
          aria-label={isZh ? "全部画布" : "All canvases"}
          title={isZh ? "全部画布" : "All canvases"}
          onClick={(e) => {
            e.stopPropagation();
            setTabMenu(null);
            const rect = e.currentTarget.getBoundingClientRect();
            setListMenu((current) => (current ? null : { top: rect.bottom + 6, left: Math.max(8, rect.right - 168) }));
          }}
        >
          <IconList size={15} stroke={1.8} />
        </button>
      </div>

      <div className={styles.right} onClick={(e) => e.stopPropagation()}>
        {searchOpen && (
          <div className={styles.searchPopover}>
            <input
              autoFocus
              className={styles.searchInput}
              placeholder={t.searchNodes}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchText(""); } }}
            />
            {matchedNodes.length > 0 && (
              <div className={styles.searchList}>
                {matchedNodes.slice(0, 8).map((node, i) => (
                  <button
                    key={node.id}
                    type="button"
                    className={styles.searchItem}
                    onClick={() => {
                      onFocusNode(node);
                      setSearchOpen(false);
                      setSearchText("");
                    }}
                  >
                    <span>{t[node.kind]} {i + 1}</span>
                    {node.settings.prompt && <small>{node.settings.prompt.slice(0, 32)}</small>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t.searchNodes}
          title={t.searchNodes}
          onClick={() => setSearchOpen((v) => !v)}
        >
          <IconSearch size={14} stroke={1.8} />
        </button>
        <span className={styles.saveChip} data-dirty={dirty ? "true" : undefined}>
          {dirty ? t.saving : t.saved}
        </span>
      </div>

      {tabMenu && createPortal(
        <>
          <div className={styles.tabMenuBackdrop} onClick={() => setTabMenu(null)} />
          <div
            className={styles.tabMenu}
            role="menu"
            style={{ top: `${tabMenu.top}px`, left: `${tabMenu.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className={styles.tabMenuItem}
              onClick={() => {
                const target = tabMenu.boardId;
                setTabMenu(null);
                onOpenInNewWindow(target);
              }}
            >
              <IconExternalLink size={14} stroke={1.8} />
              <span>{isZh ? "在新窗口打开" : "Open in new window"}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.tabMenuItem}
              onClick={() => {
                setTitleDraft(tabMenu.label);
                setEditingBoardId(tabMenu.boardId);
                setTabMenu(null);
              }}
            >
              <IconPencil size={14} stroke={1.8} />
              <span>{isZh ? "重命名画布" : "Rename canvas"}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.tabMenuItem}
              onClick={() => {
                const target = tabMenu;
                setTabMenu(null);
                onDuplicateBoard(target.boardId, target.label);
              }}
            >
              <IconCopy size={14} stroke={1.8} />
              <span>{isZh ? "复制画布" : "Duplicate canvas"}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={`${styles.tabMenuItem} ${styles.tabMenuDanger}`}
              onClick={() => {
                const target = tabMenu.boardId;
                setTabMenu(null);
                onDeleteBoard(target);
              }}
            >
              <IconTrash size={14} stroke={1.8} />
              <span>{isZh ? "删除画布" : "Delete canvas"}</span>
            </button>
          </div>
        </>,
        document.body,
      )}

      {listMenu && createPortal(
        <>
          <div className={styles.tabMenuBackdrop} onClick={() => setListMenu(null)} />
          <div
            className={styles.tabMenu}
            role="menu"
            style={{ top: `${listMenu.top}px`, left: `${listMenu.left}px`, minWidth: "10.5rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.tabMenuHeader}>{isZh ? "全部画布" : "All canvases"}</div>
            {boards.map((board, index) => {
              const label = displayTabTitle(board, index);
              const active = board.canvasId === boardId;
              return (
                <button
                  key={board.canvasId}
                  type="button"
                  role="menuitem"
                  className={`${styles.tabMenuItem} ${active ? styles.tabMenuActive : ""}`}
                  onClick={() => {
                    setListMenu(null);
                    if (!active) onSelectBoard(board.canvasId);
                  }}
                >
                  <IconFocus2 size={14} stroke={1.7} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
