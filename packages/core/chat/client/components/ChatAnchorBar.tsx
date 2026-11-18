// 中央聊天区左侧「导航刻度锚点条」：按对话轮次展示刻度线、悬停波浪放大、预览浮卡、书签标记与点击平滑跳转。
import { useEffect, useRef, useState } from "react";
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react";
import type { ChatMessageItem } from "../chat-types";
import styles from "./ChatAnchorBar.module.css";

const PREVIEW_CLOSE_DELAY_MS = 300;

/** 记录成对消息的轮次坐标和跳转目标，供刻度、预览和书签共用。 */
export interface ChatTurnAnchor {
  index: number;
  anchorMsgId: string;
  userTitle: string;
  assistantPreview: string;
  timestamp: number;
}

function stripMarkdownPreview(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/gu, "[代码]")
    .replace(/[#>*_`]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function formatClock(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 从消息时间线提取可导航轮次，并为预览和跳转生成稳定标识。 */
export function buildTurnAnchors(messages: ChatMessageItem[]): ChatTurnAnchor[] {
  const turns: ChatTurnAnchor[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (!msg || msg.role !== "user") continue;
    const next = messages[i + 1]?.role === "assistant" ? messages[i + 1] : undefined;
    turns.push({
      index: turns.length,
      anchorMsgId: msg.id,
      userTitle: stripMarkdownPreview(msg.content) || "(无内容)",
      assistantPreview: next ? stripMarkdownPreview(next.content) : "",
      timestamp: msg.createdAt,
    });
  }
  return turns;
}

/** 根据消息滚动位置更新当前刻度，点击刻度或预览可跳到对应轮次。 */
export function ChatAnchorBar({
  turns,
  activeTurnIndex,
  onJumpToTurn,
}: {
  turns: ChatTurnAnchor[];
  activeTurnIndex: number;
  onJumpToTurn: (anchorMsgId: string, index: number) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set());
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  if (turns.length === 0) return null;

  // 移入刻度或聚焦时取消挂起的关闭，切换刻度也不会被旧计时器打断。
  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const showPreview = (index: number) => {
    cancelClose();
    setHoveredIdx(index);
  };

  // 给离开导航区的指针留一点回移时间，同时保留键盘正在操作的卡片。
  const scheduleClose = (rail: HTMLElement) => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      if (!rail.querySelector(":focus-visible")) setHoveredIdx(null);
    }, PREVIEW_CLOSE_DELAY_MS);
  };

  const toggleBookmark = (msgId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  return (
    <nav
      className={styles.rail}
      aria-label="对话轮次导航刻度"
      onMouseEnter={cancelClose}
      onMouseLeave={(event) => scheduleClose(event.currentTarget)}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget) || event.currentTarget.matches(":hover")) return;
        cancelClose();
        setHoveredIdx(null);
      }}
    >
      <div className={styles.ticks}>
        {turns.map((turn, idx) => {
          const isActive = idx === activeTurnIndex;
          const isHovered = idx === hoveredIdx;
          const isBookmarked = bookmarkedIds.has(turn.anchorMsgId);
          const dist = hoveredIdx === null ? 99 : Math.abs(idx - hoveredIdx);
          const scaleClass =
            dist === 0
              ? styles.tickDist0
              : dist === 1
                ? styles.tickDist1
                : dist === 2
                  ? styles.tickDist2
                  : "";

          return (
            <div
              key={turn.anchorMsgId}
              className={styles.tickSlot}
              onMouseEnter={() => showPreview(idx)}
            >
              <button
                type="button"
                className={`${styles.tickBtn} ${scaleClass} ${isActive ? styles.tickActive : ""} ${isBookmarked ? styles.tickBookmarked : ""}`}
                aria-label={`第 ${idx + 1} 轮：${turn.userTitle.slice(0, 24)}`}
                aria-current={isActive ? "true" : undefined}
                onFocus={() => showPreview(idx)}
                onClick={() => onJumpToTurn(turn.anchorMsgId, idx)}
              />

              {isHovered && (
                <div className={styles.previewCard}>
                  {/* 卡片内容和书签使用并列的按钮，避免书签点击触发跳转。 */}
                  <button
                    type="button"
                    className={styles.previewJump}
                    aria-label={`跳转到第 ${idx + 1} 轮：${turn.userTitle}`}
                    onClick={() => onJumpToTurn(turn.anchorMsgId, idx)}
                  >
                    <span className={styles.previewTitle}>{turn.userTitle}</span>
                    {turn.assistantPreview && (
                      <span className={styles.previewBody}>{turn.assistantPreview}</span>
                    )}
                    <span className={styles.previewFooter}>
                      <span>{`${idx + 1} of ${turns.length}`}</span>
                      <span>{formatClock(turn.timestamp)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.bookmarkBtn} ${isBookmarked ? styles.bookmarkBtnOn : ""}`}
                    aria-label={isBookmarked ? "取消书签" : "添加书签"}
                    onClick={() => toggleBookmark(turn.anchorMsgId)}
                  >
                    {isBookmarked ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} stroke={1.8} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
