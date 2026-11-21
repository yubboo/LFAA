// 输入区排队消息面板：显示排队条数，支持编辑、删除、上移、立即插话发送与清空；并提供运行中提示。
import { useState } from "react";
import {
  IconArrowUp,
  IconChevronDown,
  IconPencil,
  IconSend,
  IconTrash,
} from "@tabler/icons-react";
import type { QueuedMessage } from "../chat-queue";
import styles from "./ComposerQueuePanel.module.css";

/** 排队消息面板：默认展开少量消息，支持逐条编辑与调整顺序。 */
export function ComposerQueuePanel({
  isZh,
  queue,
  onEdit,
  onRemove,
  onMove,
  onSendNow,
  onClear,
  onFlush,
}: {
  isZh: boolean;
  queue: QueuedMessage[];
  onEdit: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number) => void;
  onSendNow: (index: number) => void;
  onClear: () => void;
  onFlush: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (queue.length === 0) return null;

  const commit = (index: number) => {
    onEdit(index, draft);
    setEditingId(null);
    setDraft("");
  };

  return (
    <details className={styles.panel} open={queue.length <= 3}>
      <summary className={styles.summary}>
        <IconChevronDown size={13} stroke={2} className={styles.chevron} aria-hidden="true" />
        <span className={styles.count}>
          {isZh ? `${queue.length} 条排队消息` : `${queue.length} queued`}
        </span>
        <span className={styles.shortcut}>
          {isZh ? "Ctrl+Enter 插话发送全部" : "Ctrl+Enter to steer all"}
        </span>
        <button
          type="button"
          className={styles.clear}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClear();
          }}
        >
          {isZh ? "清空" : "Clear"}
        </button>
        <button
          type="button"
          className={styles.flush}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onFlush();
          }}
        >
          {isZh ? "全部插话" : "Steer all"}
        </button>
      </summary>
      <ul className={styles.list} role="list">
        {queue.map((item, index) => (
          <li key={item.id} className={styles.item} role="listitem">
            <span className={styles.index} aria-hidden="true">{index + 1}</span>
            {editingId === item.id ? (
              <input
                className={styles.editInput}
                value={draft}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    commit(index);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setEditingId(null);
                    setDraft("");
                  }
                }}
                onBlur={() => commit(index)}
              />
            ) : (
              <span className={styles.text} title={item.text}>{item.text}</span>
            )}
            <span className={styles.actions}>
              <button
                type="button"
                className={styles.actionBtn}
                aria-label={isZh ? "编辑排队消息" : "Edit queued message"}
                title={isZh ? "编辑" : "Edit"}
                onClick={() => {
                  setEditingId(item.id);
                  setDraft(item.text);
                }}
              >
                <IconPencil size={13} stroke={1.8} />
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                aria-label={isZh ? "删除排队消息" : "Remove queued message"}
                title={isZh ? "删除" : "Remove"}
                onClick={() => onRemove(index)}
              >
                <IconTrash size={13} stroke={1.8} />
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                aria-label={isZh ? "立即发送这条排队消息" : "Send this queued message now"}
                title={isZh ? "立即插话发送" : "Steer now"}
                onClick={() => onSendNow(index)}
              >
                <IconSend size={13} stroke={1.8} />
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                aria-label={isZh ? "上移排队消息" : "Move queued message up"}
                title={isZh ? "上移" : "Move up"}
                disabled={index === 0}
                onClick={() => onMove(index)}
              >
                <IconArrowUp size={13} stroke={1.8} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** 运行中 / 有排队时的行为提示，让用户知道 Enter 与 Ctrl+Enter 的区别。 */
export function ComposerFollowUpHint({
  isZh,
  followUpMode,
  running,
  queuedCount,
}: {
  isZh: boolean;
  followUpMode: "queue" | "steer";
  running: boolean;
  queuedCount: number;
}) {
  if (!running && queuedCount === 0) return null;
  const modeText = followUpMode === "queue"
    ? (isZh ? "Enter 排队，当前运行结束后依次发送" : "Enter queues; sends after the run finishes")
    : (isZh ? "Enter 立即插话，追加到当前生成（不打断）" : "Enter steers now, appended to the running turn");
  return (
    <p className={styles.hint} role="note">
      {modeText}
      {" · "}
      {isZh ? "Ctrl+Enter 相反操作" : "Ctrl+Enter for the opposite"}
    </p>
  );
}