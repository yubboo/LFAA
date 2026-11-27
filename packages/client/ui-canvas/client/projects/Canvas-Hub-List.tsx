// 无限画布「我的项目」无边框极简列表视图：默认通透无外框，悬停高亮圆角行并浮现快捷操作与更多菜单。
import type { ReactNode } from "react";
import { IconCopy, IconDotsVertical, IconPhotoEdit, IconPlus } from "@tabler/icons-react";
import type { CanvasLabels } from "../locales";
import type { HubCardMenuAnchor } from "./Canvas-Hub-Card-Menu";
import { formatRelativeEditedTime, type HubProjectCardItem } from "./project-hub-helpers";
import styles from "./Canvas-Projects-Hub.module.css";

export function CanvasHubList({
  t,
  isZh,
  creating,
  items,
  now,
  renamingId,
  renameDraft,
  openMenuProjectId,
  renderCover,
  onQuickCreate,
  onOpenProject,
  onPickCover,
  onDuplicate,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
}: {
  t: CanvasLabels;
  isZh: boolean;
  creating: boolean;
  items: readonly HubProjectCardItem[];
  now: number;
  renamingId: string | null;
  renameDraft: string;
  openMenuProjectId: string | null;
  renderCover: (item: HubProjectCardItem) => ReactNode;
  onQuickCreate: () => void;
  onOpenProject: (projectId: string, canvasId: string) => void;
  onPickCover: (projectId: string) => void;
  onDuplicate: (item: HubProjectCardItem) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: (projectId: string, fallbackName: string) => void;
  onCancelRename: () => void;
  onOpenMenu: (anchor: HubCardMenuAnchor) => void;
}) {
  return (
    <div className={styles.list}>
      <button
        type="button"
        className={`${styles.listRow} ${styles.listNewRow}`}
        disabled={creating}
        onClick={onQuickCreate}
      >
        <span className={styles.listThumb}><IconPlus size={16} stroke={1.8} /></span>
        <span className={styles.listName}>{creating ? t.creatingProject : t.createProject}</span>
      </button>

      {items.map((item) => {
        const isRenaming = renamingId === item.id;
        const isMenuOpen = openMenuProjectId === item.id;
        return (
          <div
            key={item.id}
            className={styles.listRow}
            data-open={isMenuOpen ? "true" : undefined}
            onClick={() => { if (!isRenaming) onOpenProject(item.id, item.latestCanvasId); }}
          >
            <span className={styles.listThumb}>{renderCover(item)}</span>

            {isRenaming ? (
              <input
                autoFocus
                type="text"
                className={styles.listRenameInput}
                value={renameDraft}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onRenameDraftChange(event.target.value)}
                onBlur={() => onCommitRename(item.id, item.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onCommitRename(item.id, item.name);
                  if (event.key === "Escape") onCancelRename();
                }}
              />
            ) : (
              <span className={styles.listName} title={item.name}>{item.name}</span>
            )}

            <span className={styles.listMeta}>
              {`${t.editedPrefix} ${formatRelativeEditedTime(item.updatedAt, now, isZh)}`}
            </span>

            <div className={styles.listActions} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={styles.listActionBtn}
                title={isZh ? "修改封面" : "Change cover"}
                aria-label={isZh ? "修改封面" : "Change cover"}
                onClick={() => onPickCover(item.id)}
              >
                <IconPhotoEdit size={15} stroke={1.7} />
              </button>
              <button
                type="button"
                className={styles.listActionBtn}
                title={isZh ? "创建副本" : "Duplicate"}
                aria-label={isZh ? "创建副本" : "Duplicate"}
                onClick={() => onDuplicate(item)}
              >
                <IconCopy size={15} stroke={1.7} />
              </button>
              <button
                type="button"
                className={styles.listActionBtn}
                data-open={isMenuOpen ? "true" : undefined}
                title={isZh ? "更多操作" : "More actions"}
                aria-label={isZh ? "更多操作" : "More actions"}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  onOpenMenu({
                    projectId: item.id,
                    canvasId: item.latestCanvasId,
                    name: item.name,
                    top: rect.bottom + 6,
                    right: rect.right,
                  });
                }}
              >
                <IconDotsVertical size={15} stroke={1.8} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
