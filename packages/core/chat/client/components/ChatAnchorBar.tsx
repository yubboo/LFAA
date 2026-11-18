// 中央聊天区左侧「导航刻度锚点条」：按对话轮次展示刻度线、悬停波浪放大、预览浮卡、书签标记与点击平滑跳转。
import { useMemo, useState } from "react";
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react";
import type { ChatMessageItem } from "../chat-types";
import styles from "./ChatAnchorBar.module.css";

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

  const hoveredTurn = useMemo(
    () => (hoveredIdx !== null ? turns[hoveredIdx] ?? null : null),
    [hoveredIdx, turns],
  );

  if (turns.length === 0) return null;

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
      onMouseLeave={() => setHoveredIdx(null)}
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
              onMouseEnter={() => setHoveredIdx(idx)}
            >
              <button
                type="button"
                className={`${styles.tickBtn} ${scaleClass} ${isActive ? styles.tickActive : ""} ${isBookmarked ? styles.tickBookmarked : ""}`}
                aria-label={`第 ${idx + 1} 轮：${turn.userTitle.slice(0, 24)}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onJumpToTurn(turn.anchorMsgId, idx)}
              />

              {isHovered && hoveredTurn && (
                <div className={styles.previewCard} role="tooltip">
                  <div className={styles.previewHeader}>
                    <span className={styles.previewTitle}>{hoveredTurn.userTitle}</span>
                    <button
                      type="button"
                      className={`${styles.bookmarkBtn} ${isBookmarked ? styles.bookmarkBtnOn : ""}`}
                      aria-label={isBookmarked ? "取消书签" : "添加书签"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleBookmark(hoveredTurn.anchorMsgId);
                      }}
                    >
                      {isBookmarked ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} stroke={1.8} />}
                    </button>
                  </div>
                  {hoveredTurn.assistantPreview && (
                    <p className={styles.previewBody}>{hoveredTurn.assistantPreview}</p>
                  )}
                  <div className={styles.previewFooter}>
                    <span>{`${idx + 1} of ${turns.length}`}</span>
                    <span>{formatClock(hoveredTurn.timestamp)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
