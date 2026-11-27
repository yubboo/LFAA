// 无限画布「我的项目」网格卡片区：无外框极简缩略图 + 下方独立标题/日期 + 右下更多操作触发按钮。
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { IconDots, IconPlus } from "@tabler/icons-react";
import type { CanvasLabels } from "../locales";
import type { HubCardMenuAnchor } from "./Canvas-Hub-Card-Menu";
import { formatRelativeEditedTime, type HubProjectCardItem } from "./project-hub-helpers";
import cardStyles from "./Canvas-Hub-Card.module.css";

export function CanvasHubCardGrid({
  t,
  isZh,
  zoomRem,
  creating,
  items,
  now,
  renamingId,
  renameDraft,
  openMenuProjectId,
  renderCover,
  onTrackGlow,
  onQuickCreate,
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
  items: readonly HubProjectCardItem[];
  now: number;
  renamingId: string | null;
  renameDraft: string;
  openMenuProjectId: string | null;
  renderCover: (item: HubProjectCardItem) => ReactNode;
  onTrackGlow: (event: PointerEvent<HTMLElement>) => void;
  onQuickCreate: () => void;
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
                  </button>
                )}
                <span className={cardStyles.cardMeta}>
                  {`${t.editedPrefix} ${formatRelativeEditedTime(item.updatedAt, now, isZh)}`}
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
