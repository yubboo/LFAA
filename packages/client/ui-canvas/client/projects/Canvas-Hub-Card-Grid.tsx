// 无限画布「我的项目」网格卡片区：无外框极简缩略图 + 文件夹折耳造型卡片（支持行内改名）+ 下方独立标题/日期 + 右下更多操作触发按钮。
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { IconDots, IconPlus, IconTrash } from "@tabler/icons-react";
import type { CanvasFolder } from "@lfaa/canvas/contract";
import type { CanvasLabels } from "../locales";
import type { HubCardMenuAnchor } from "./Canvas-Hub-Card-Menu";
import { formatRelativeEditedTime, type HubProjectCardItem } from "./project-hub-helpers";
import cardStyles from "./Canvas-Hub-Card.module.css";

export function CanvasHubCardGrid({
  t,
  isZh,
  zoomRem,
  creating,
  folders = [],
  folderCounts,
  items,
  now,
  renamingId,
  renameDraft,
  renamingFolderId,
  folderRenameDraft,
  openMenuProjectId,
  renderCover,
  onTrackGlow,
  onQuickCreate,
  onOpenFolder,
  onStartRenameFolder,
  onFolderRenameDraftChange,
  onCommitFolderRename,
  onCancelFolderRename,
  onDeleteFolder,
  onOpenProject,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
}: {
  t: CanvasLabels;
  isZh: boolean;
  zoomRem: number;
  creating: boolean;
  folders?: readonly CanvasFolder[];
  folderCounts?: ReadonlyMap<string, number>;
  items: readonly HubProjectCardItem[];
  now: number;
  renamingId: string | null;
  renameDraft: string;
  renamingFolderId?: string | null;
  folderRenameDraft?: string;
  openMenuProjectId: string | null;
  renderCover: (item: HubProjectCardItem) => ReactNode;
  onTrackGlow: (event: PointerEvent<HTMLElement>) => void;
  onQuickCreate: () => void;
  onOpenFolder?: ((folderId: string) => void) | undefined;
  onStartRenameFolder?: ((folder: CanvasFolder) => void) | undefined;
  onFolderRenameDraftChange?: ((value: string) => void) | undefined;
  onCommitFolderRename?: ((folderId: string, fallbackName: string) => void) | undefined;
  onCancelFolderRename?: (() => void) | undefined;
  onDeleteFolder?: ((folderId: string) => void) | undefined;
  onOpenProject: (projectId: string, canvasId: string) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: (projectId: string, fallbackName: string) => void;
  onCancelRename: () => void;
  onOpenMenu: (anchor: HubCardMenuAnchor) => void;
}) {
  return (
    <div
      className={cardStyles.grid}
      style={{ "--hub-card-min": `${zoomRem}rem` } as CSSProperties}
    >
      <button
        type="button"
        className={cardStyles.card}
        disabled={creating}
        onClick={onQuickCreate}
      >
        <div
          className={`${cardStyles.thumb} ${cardStyles.newThumb}`}
          onPointerMove={onTrackGlow}
        >
          <IconPlus size={20} stroke={1.8} className={cardStyles.newPlus} />
          <span>{creating ? t.creatingProject : (isZh ? "开始创作" : "Start creating")}</span>
        </div>
        <div className={cardStyles.cardBody}>
          <span className={cardStyles.newHint}>
            {isZh ? "创建新的画布项目" : "Create a new canvas project"}
          </span>
        </div>
      </button>

      {folders.map((folder) => {
        const count = folderCounts?.get(folder.id) ?? 0;
        const isRenamingFolder = renamingFolderId === folder.id;
        return (
          <div key={`folder:${folder.id}`} className={cardStyles.card}>
            <button
              type="button"
              className={`${cardStyles.thumb} ${cardStyles.folderThumb}`}
              onPointerMove={onTrackGlow}
              onClick={() => onOpenFolder?.(folder.id)}
            >
              <span className={cardStyles.folderTab} aria-hidden="true" />
              <span className={cardStyles.folderFront} aria-hidden="true" />
              <span className={cardStyles.coverSheen} aria-hidden="true" />
            </button>
            <div className={cardStyles.cardFooter}>
              <div className={cardStyles.cardBody}>
                {isRenamingFolder ? (
                  <input
                    autoFocus
                    type="text"
                    className={cardStyles.renameInput}
                    value={folderRenameDraft ?? folder.name}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => onFolderRenameDraftChange?.(event.target.value)}
                    onBlur={() => onCommitFolderRename?.(folder.id, folder.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onCommitFolderRename?.(folder.id, folder.name);
                      if (event.key === "Escape") onCancelFolderRename?.();
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className={cardStyles.cardTitleBtn}
                    title={folder.name}
                    onClick={() => onOpenFolder?.(folder.id)}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      onStartRenameFolder?.(folder);
                    }}
                  >
                    {folder.name}
                  </button>
                )}
                <span className={cardStyles.cardMeta}>
                  {count > 0
                    ? (isZh ? `${count} 个画布项目` : `${count} projects`)
                    : `${t.editedPrefix} ${formatRelativeEditedTime(folder.updatedAt, now, isZh)}`}
                </span>
              </div>
              {onDeleteFolder && (
                <button
                  type="button"
                  className={cardStyles.moreBtn}
                  aria-label={isZh ? `删除文件夹：${folder.name}` : `Delete folder: ${folder.name}`}
                  title={isZh ? "删除文件夹（内部项目退回根目录）" : "Delete folder (projects return to root)"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteFolder(folder.id);
                  }}
                >
                  <IconTrash size={14} stroke={1.8} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {items.map((item) => {
        const isRenaming = renamingId === item.id;
        const isMenuOpen = openMenuProjectId === item.id;
        return (
          <div key={item.id} className={cardStyles.card}>
            <button
              type="button"
              className={cardStyles.thumb}
              onPointerMove={onTrackGlow}
              onClick={() => onOpenProject(item.id, item.latestCanvasId)}
            >
              {renderCover(item)}
              <span className={cardStyles.coverSheen} aria-hidden="true" />
            </button>

            <div className={cardStyles.cardFooter}>
              <div className={cardStyles.cardBody}>
                {isRenaming ? (
                  <input
                    autoFocus
                    type="text"
                    className={cardStyles.renameInput}
                    value={renameDraft}
                    onChange={(event) => onRenameDraftChange(event.target.value)}
                    onBlur={() => onCommitRename(item.id, item.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onCommitRename(item.id, item.name);
                      if (event.key === "Escape") onCancelRename();
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className={cardStyles.cardTitleBtn}
                    title={item.name}
                    onClick={() => onOpenProject(item.id, item.latestCanvasId)}
                  >
                    {item.name}
                    {item.isDefault && <span className={cardStyles.sampleTag}>{isZh ? "画布" : "Canvas"}</span>}
                  </button>
                )}
                <span className={cardStyles.cardMeta}>
                  {item.isDefault && item.boardCount === 0
                    ? (isZh ? "默认工作区画布" : "Default workspace canvas")
                    : `${t.editedPrefix} ${formatRelativeEditedTime(item.updatedAt, now, isZh)}`}
                </span>
              </div>

              <button
                type="button"
                className={cardStyles.moreBtn}
                data-open={isMenuOpen ? "true" : undefined}
                aria-label={isZh ? "更多操作" : "More actions"}
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  onOpenMenu({
                    projectId: item.id,
                    canvasId: item.latestCanvasId,
                    name: item.name,
                    folderId: item.canvasFolderId ?? null,
                    ...(item.isDefault ? { isDefault: true } : {}),
                    top: rect.bottom + 6,
                    right: rect.right,
                  });
                }}
              >
                <IconDots size={15} stroke={1.9} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
