// 渲染左二聊天会话行悬停时右侧弹出的液态玻璃信息卡片：标题、所属项目、更新时间与未读状态。
import { createPortal } from "react-dom";
import { IconClock, IconFolder } from "@tabler/icons-react";
import type { WorkbenchChatSessionSummary, WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { SessionAnchorRect } from "./session-menu-store";
import styles from "./SessionHoverCard.module.css";

function formatUpdatedTime(ts: number, isZh: boolean): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (isZh) {
    return `更新于 ${d.getMonth() + 1}月${d.getDate()}日, ${hh}:${mm}`;
  }
  return `Updated ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${hh}:${mm}`;
}

/** 在侧栏行附近预览会话名称、归属和时间，避免切换当前会话。 */
export function SessionHoverCard({
  isZh,
  session,
  projects,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: {
  isZh: boolean;
  session: WorkbenchChatSessionSummary;
  projects: WorkbenchProjectItem[];
  anchorRect: SessionAnchorRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const project = session.projectId ? projects.find((p) => p.id === session.projectId) : undefined;
  const scopeLabel = project
    ? project.name
    : (isZh ? "Outside of 项目" : "Outside project");
  const timeLabel = formatUpdatedTime(session.updatedAt, isZh);

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const cardWidth = Math.min(280, Math.max(210, viewportWidth - 24));
  const left = Math.max(12, Math.min(anchorRect.right + 10, viewportWidth - cardWidth - 12));
  const top = Math.max(12, Math.min(anchorRect.top - 4, viewportHeight - 150));

  const cardNode = (
    <div
      className={styles.card}
      role="tooltip"
      aria-label={session.title}
      data-session-hover-card={session.id}
      style={{ top: `${top}px`, left: `${left}px`, width: `${cardWidth}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <strong className={styles.title}>{session.title}</strong>

      <div className={styles.metaRow}>
        <IconFolder aria-hidden="true" />
        <span>{scopeLabel}</span>
      </div>

      <div className={styles.metaRow}>
        <IconClock aria-hidden="true" />
        <span>{timeLabel}</span>
      </div>

      {session.unread && (
        <div className={styles.unreadRow}>
          <span className={styles.unreadDot} aria-hidden="true" />
          <span>{isZh ? "未读" : "Unread"}</span>
        </div>
      )}
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(cardNode, document.body);
  }
  return cardNode;
}
