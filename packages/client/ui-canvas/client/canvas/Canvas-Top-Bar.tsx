// 画布左上角项目/画布浮层菜单（支持切换画布、重命名与调用左二栏同款新建项目）及右上角节点搜索与保存态。
import { useState } from "react";
import { IconChevronLeft, IconFolderPlus, IconPlus, IconSearch } from "@tabler/icons-react";
import type { CanvasNode } from "@lfaa/canvas/contract";
import type { CanvasListItem } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import styles from "./Canvas.module.css";

export function CanvasTopBar({
  t,
  projectName,
  boardId,
  boardTitle,
  boards,
  nodes,
  dirty,
  onSelectBoard,
  onCreateBoard,
  onCreateProject,
  onCommitRename,
  onFocusNode,
}: {
  t: CanvasLabels;
  projectName: string;
  boardId: string;
  boardTitle: string;
  boards: CanvasListItem[];
  nodes: CanvasNode[];
  dirty: boolean;
  onSelectBoard: (canvasId: string) => void;
  onCreateBoard: () => void;
  onCreateProject?: (() => void) | undefined;
  onCommitRename: (nextTitle: string) => Promise<void>;
  onFocusNode: (node: CanvasNode) => void;
}) {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(boardTitle);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const matchedNodes = searchText.trim()
    ? nodes.filter((node, i) => `${t[node.kind]}${i + 1} ${node.settings.prompt ?? ""}`.toLowerCase().includes(searchText.trim().toLowerCase()))
    : [];

  async function finishRename() {
    setEditingTitle(false);
    const clean = titleDraft.trim();
    if (!clean || clean === boardTitle) {
      setTitleDraft(boardTitle);
      return;
    }
    await onCommitRename(clean);
  }

  return (
    <>
      <div className={styles.topLeft} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.brandChip}
          onClick={() => setProjectMenuOpen((v) => !v)}
          aria-expanded={projectMenuOpen}
        >
          <IconChevronLeft size={15} stroke={1.8} />
          <span className={styles.projectLabel}>{projectName || t.untitledProject}</span>
          <span className={styles.titleSlash}>/</span>
          {editingTitle ? (
            <input
              autoFocus
              className={styles.titleInput}
              value={titleDraft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void finishRename()}
              onKeyDown={(e) => { if (e.key === "Enter") void finishRename(); }}
            />
          ) : (
            <span
              className={styles.boardTitle}
              title={titleDraft}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
            >
              {titleDraft}
            </span>
          )}
        </button>

        {projectMenuOpen && (
          <div className={styles.boardMenu} role="menu">
            <div className={styles.boardMenuHeader}>{t.boards}</div>
            {boards.map((board) => (
              <button
                key={board.canvasId}
                type="button"
                role="menuitem"
                className={styles.boardMenuItem}
                data-active={board.canvasId === boardId ? "true" : undefined}
                onClick={() => {
                  setProjectMenuOpen(false);
                  if (board.canvasId !== boardId) onSelectBoard(board.canvasId);
                }}
              >
                <span>{board.title}</span>
              </button>
            ))}
            <div className={styles.boardMenuSep} />
            <button type="button" role="menuitem" className={styles.boardMenuItem} onClick={() => { setProjectMenuOpen(false); onCreateBoard(); }}>
              <IconPlus size={14} /><span>{t.create}</span>
            </button>
            {onCreateProject && (
              <button type="button" role="menuitem" className={styles.boardMenuItem} onClick={() => { setProjectMenuOpen(false); onCreateProject(); }}>
                <IconFolderPlus size={14} /><span>{t.createProject}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.topRight}>
        {searchOpen && (
          <div className={styles.searchPill}>
            <input
              autoFocus
              value={searchText}
              placeholder={t.searchNodes}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
            />
            {matchedNodes.length > 0 && (
              <div className={styles.searchHits}>
                {matchedNodes.slice(0, 6).map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      onFocusNode(node);
                      setSearchOpen(false);
                      setSearchText("");
                    }}
                  >
                    {t[node.kind]} · {(node.settings.prompt || node.id.slice(0, 6)).slice(0, 22)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className={styles.topIconBtn}
          aria-label={t.searchNodes}
          title={t.searchNodes}
          onClick={() => setSearchOpen((v) => !v)}
        >
          <IconSearch size={15} stroke={1.8} />
        </button>
        <span className={styles.saveBadge} role="status">{dirty ? t.saving : t.saved}</span>
      </div>
    </>
  );
}
