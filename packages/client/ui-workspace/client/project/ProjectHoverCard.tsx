// 渲染项目行“···”触发的液态玻璃悬浮信息卡：展示项目名、置顶开关、聊天次数、源文件夹路径与“编辑项目”入口。
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  IconFolder,
  IconFolderShare,
  IconMessageCircle,
  IconPin,
  IconPinFilled,
  IconSettings,
} from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { WorkspaceLocaleMessages } from "../locales";
import type { HoverAnchorRect } from "../shared/anchor";
import styles from "./ProjectHoverCard.module.css";

/** 保存悬浮卡片触发区域的坐标及尺寸，便于按可用空间定位。 */
function getFolderName(folderPath: string): string {
  const parts = folderPath.split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : folderPath;
}

/** 在项目行附近提供摘要与编辑入口，避免预览时切换当前工作区。 */
export function ProjectHoverCard({
  locale,
  project,
  anchorRect,
  pinnedMode,
  canPin,
  canEdit,
  closing = false,
  entering = true,
  onMouseEnter,
  onMouseLeave,
  onTogglePin,
  onEdit,
  onClose,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  anchorRect: HoverAnchorRect;
  pinnedMode: boolean;
  canPin: boolean;
  canEdit: boolean;
  /** 关闭淡出阶段：禁用交互，仅播动画。 */
  closing?: boolean | undefined;
  /** 是否播放入场动画；关闭后快速重开时传 false，避免闪烁。 */
  entering?: boolean | undefined;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (cardRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`[data-project-more="${project.id}"]`)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, project.id]);

  const folders = project.rootPaths?.length
    ? project.rootPaths
    : project.rootPath
      ? [project.rootPath]
      : [];
  const chatCount = project.chatCount ?? 0;

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const cardWidth = Math.min(352, Math.max(240, viewportWidth - 24));
  const compactViewport = viewportWidth < 760;

  const left = compactViewport
    ? Math.max(12, Math.min(anchorRect.left, viewportWidth - cardWidth - 12))
    : Math.max(12, Math.min(anchorRect.right + 8, viewportWidth - cardWidth - 12));
  const top = compactViewport
    ? Math.max(12, Math.min(anchorRect.bottom + 6, viewportHeight - 250))
    : Math.max(12, Math.min(anchorRect.top - 6, viewportHeight - 260));

  const cardNode = (
    <div
      ref={cardRef}
      className={`${styles.card} ${entering && !closing ? styles.cardEntering : ""} ${closing ? styles.cardClosing : ""}`}
      role={pinnedMode ? "dialog" : "tooltip"}
      aria-label={project.name}
      data-project-hover-card={project.id}
      style={{ top: `${top}px`, left: `${left}px`, width: `${cardWidth}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <IconFolder className={styles.icon} aria-hidden="true" />
          <strong className={styles.title}>{project.name}</strong>
        </div>
        {canPin && (
          <button
            type="button"
            className={`${styles.pinButton} ${project.pinned ? styles.pinButtonActive : ""}`}
            aria-label={project.pinned ? locale.unpinProject : locale.pinProject}
            aria-pressed={Boolean(project.pinned)}
            title={project.pinned ? locale.unpinProject : locale.pinProject}
            onClick={onTogglePin}
          >
            {project.pinned ? <IconPinFilled aria-hidden="true" /> : <IconPin aria-hidden="true" />}
          </button>
        )}
      </div>

      <div className={styles.metaRow}>
        <IconMessageCircle className={styles.icon} aria-hidden="true" />
        <span>{`${chatCount} ${locale.chatsCountSuffix}`}</span>
      </div>

      {folders.length > 0 && (
        <>
          <hr className={styles.divider} />
          <div className={styles.folders}>
            {folders.map((folderPath) => (
              <div key={folderPath} className={styles.folderGroup}>
                <div className={styles.metaRow}>
                  <IconFolderShare className={styles.icon} aria-hidden="true" />
                  <span className={styles.folderName}>{getFolderName(folderPath)}</span>
                </div>
                <div className={styles.metaRow}>
                  <IconFolder className={styles.icon} aria-hidden="true" />
                  <span className={styles.folderPath}>{folderPath}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {canEdit && (
        <>
          <hr className={styles.divider} />
          <button
            type="button"
            className={styles.editButton}
            onClick={() => {
              onClose();
              onEdit();
            }}
          >
            <IconSettings className={styles.icon} aria-hidden="true" />
            <span>{locale.editProject}</span>
          </button>
        </>
      )}
    </div>
  );

  if (typeof document === "undefined") return cardNode;
  return createPortal(cardNode, document.querySelector("[data-device]") ?? document.body);
}
