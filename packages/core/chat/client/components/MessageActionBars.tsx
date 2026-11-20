// 消息操作栏与文件变更汇总卡片：提供用户消息复制/编辑、助手消息复制/评价/朗读/分支与记忆引用菜单及已编辑文件折叠卡片。
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowRight,
  IconBrain,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconDots,
  IconFileDiff,
  IconGitBranch,
  IconPencil,
  IconPlayerStop,
  IconThumbUp,
  IconVolume,
} from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { AgentStepItem } from "../chat-types";
import { collectEditedFiles } from "../file-activity";
import { timelineMessages } from "../locales";
import { useMessageFeedback } from "../useMessageFeedback";
import styles from "./MessageActionBars.module.css";

const WEEKDAYS_ZH = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** 按界面语言格式化消息气泡的时间标签。 */
export function formatMessageTimestamp(ts: number, isZh: boolean): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (isZh) {
    return `${WEEKDAYS_ZH[d.getDay()]} ${hh}:${mm}`;
  }
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${hh}:${mm}`;
}

/** 按界面语言格式化时间线中跨日分隔使用的日期。 */
export function formatDayDivider(ts: number, isZh: boolean): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((todayStart - targetStart) / 86_400_000);
  if (isZh) {
    if (diffDays === 0) return `今天 ${hh}:${mm}`;
    if (diffDays === 1) return `昨天 ${hh}:${mm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
  }
  if (diffDays === 0) return `Today ${hh}:${mm}`;
  if (diffDays === 1) return `Yesterday ${hh}:${mm}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${hh}:${mm}`;
}

function copyText(text: string, onDone: () => void): void {
  void navigator.clipboard?.writeText(text).then(onDone).catch(() => {});
}

/** 展示用户消息上的复制与编辑动作，具体执行由会话视图处理。 */
export function UserMessageActions({
  isZh,
  content,
  createdAt,
  onEdit,
}: {
  isZh: boolean;
  content: string;
  createdAt: number;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={styles.userActions}>
      <span className={styles.timestamp}>{formatMessageTimestamp(createdAt, isZh)}</span>
      <HoverTip label={copied ? (isZh ? "已复制" : "Copied") : (isZh ? "复制消息" : "Copy message")}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={isZh ? "复制消息" : "Copy message"}
          onClick={() => {
            copyText(content, () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? <IconCheck size={14} stroke={2} /> : <IconCopy size={14} stroke={1.8} />}
        </button>
      </HoverTip>
      <HoverTip label={isZh ? "编辑消息" : "Edit message"}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={isZh ? "编辑消息" : "Edit message"}
          onClick={onEdit}
        >
          <IconPencil size={14} stroke={1.8} />
        </button>
      </HoverTip>
    </div>
  );
}

/** 集中展示助手回复上的复制、反馈、朗读和延伸操作。 */
export function AssistantMessageActions({
  isZh,
  content,
  createdAt,
  model,
  memoryRefCount,
  sessionId,
  messageId,
  onBranchToNewChat,
}: {
  isZh: boolean;
  content: string;
  createdAt: number;
  model?: string | undefined;
  memoryRefCount: number;
  sessionId: string;
  messageId: string;
  onBranchToNewChat: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { liked, toggleLiked } = useMessageFeedback(sessionId, messageId);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [moreOpen]);

  useEffect(() => () => {
    if (speaking && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [speaking]);

  const toggleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = isZh ? "zh-CN" : "en-US";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={styles.assistantFooter}>
      <HoverTip label={copied ? (isZh ? "已复制" : "Copied") : (isZh ? "复制回复" : "Copy reply")}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={isZh ? "复制回复" : "Copy reply"}
          onClick={() => {
            copyText(content, () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? <IconCheck size={14} stroke={2} /> : <IconCopy size={14} stroke={1.8} />}
        </button>
      </HoverTip>

      <HoverTip label={liked ? (isZh ? "已点赞" : "Helpful") : (isZh ? "评价回复" : "Rate reply")}>
        <button
          type="button"
          className={`${styles.iconBtn} ${liked ? styles.iconBtnActive : ""}`}
          aria-label={isZh ? "评价回复" : "Rate reply"}
          aria-pressed={liked}
          onClick={() => void toggleLiked()}
        >
          <IconThumbUp size={14} stroke={1.8} />
        </button>
      </HoverTip>

      <HoverTip label={speaking ? (isZh ? "停止朗读" : "Stop reading") : (isZh ? "朗读" : "Read aloud")}>
        <button
          type="button"
          className={`${styles.iconBtn} ${speaking ? styles.iconBtnActive : ""}`}
          aria-label={isZh ? "朗读" : "Read aloud"}
          aria-pressed={speaking}
          onClick={toggleSpeak}
        >
          {speaking ? <IconPlayerStop size={14} stroke={1.8} /> : <IconVolume size={14} stroke={1.8} />}
        </button>
      </HoverTip>

      <div ref={moreRef} className={styles.moreAnchor}>
        <HoverTip label={isZh ? "更多操作" : "More actions"} disabled={moreOpen}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={isZh ? "更多操作" : "More actions"}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((prev) => !prev)}
          >
            <IconDots size={14} stroke={1.8} />
          </button>
        </HoverTip>
        {moreOpen && (
          <div className={styles.morePopover} role="menu">
            <button
              type="button"
              className={styles.moreMenuItem}
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                onBranchToNewChat();
              }}
            >
              <IconGitBranch size={14} stroke={1.8} />
              <span>{isZh ? "分支到新聊天" : "Branch to new chat"}</span>
            </button>
            <div className={styles.moreInfoRow}>
              <IconBrain size={14} stroke={1.8} />
              <span>
                {isZh
                  ? `${memoryRefCount} 条记忆引用`
                  : `${memoryRefCount} memory ${memoryRefCount === 1 ? "reference" : "references"}`}
              </span>
            </div>
          </div>
        )}
      </div>

      <span className={styles.timestamp}>{formatMessageTimestamp(createdAt, isZh)}</span>
      {model && <span className={styles.modelTag}>{model}</span>}
    </div>
  );
}

/** 把回复对应的文件改动折叠为可展开列表，便于查看具体变更。 */
export function EditedFilesCard({
  isZh,
  steps,
  onViewChanges,
  onOpenFile,
  selectedFileStepId,
}: {
  isZh: boolean;
  steps: AgentStepItem[];
  onViewChanges?: (() => void) | undefined;
  onOpenFile: (stepId: string) => void;
  selectedFileStepId?: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const editedFiles = useMemo(() => collectEditedFiles(steps), [steps]);

  if (editedFiles.length === 0) return null;

  const totalAdded = editedFiles.reduce((acc, f) => acc + f.added, 0);
  const totalRemoved = editedFiles.reduce((acc, f) => acc + f.removed, 0);
  const visibleFiles = expanded ? editedFiles : editedFiles.slice(0, 3);
  const hiddenCount = editedFiles.length - 3;

  return (
    <div className={styles.filesCard}>
      <div className={styles.filesHeader}>
        <div className={styles.filesHeaderLeft}>
          <span className={styles.filesBadgeIcon} aria-hidden="true">
            <IconFileDiff size={15} stroke={1.8} />
          </span>
          <div className={styles.filesTitleGroup}>
            <span className={styles.filesTitle}>
              {timelineMessages[isZh ? "zh" : "en"].files(editedFiles.length)}
            </span>
            {(totalAdded > 0 || totalRemoved > 0) && (
              <span className={styles.diffStats}>
                <span className={styles.diffAdd}>{`+${totalAdded}`}</span>
                <span className={styles.diffDel}>{`-${totalRemoved}`}</span>
              </span>
            )}
          </div>
        </div>
        <div className={styles.filesHeaderRight}>
          {onViewChanges && (
            <button
              type="button"
              className={styles.filesViewBtn}
              onClick={onViewChanges}
            >
              {isZh ? "查看变更" : "View changes"}
            </button>
          )}
        </div>
      </div>
      <div className={styles.filesList}>
        {visibleFiles.map((item) => {
          const normalized = item.path.replace(/\\/g, "/");
          const parts = normalized.split("/");
          const fileName = parts.pop() ?? normalized;
          const dir = parts.length > 0 ? `${parts.join("/")}/` : "";
          return (
            <button
              type="button"
              key={item.path}
              className={styles.fileRow}
              title={item.path}
              aria-pressed={selectedFileStepId === item.stepId}
              onClick={() => onOpenFile(item.stepId)}
            >
              <span className={styles.filePath}>
                {dir && <span className={styles.fileDir}>{dir}</span>}
                <span className={styles.fileName}>{fileName}</span>
              </span>
              {(item.added > 0 || item.removed > 0) && (
                <span className={styles.diffStats}>
                  <span className={styles.diffAdd}>{`+${item.added}`}</span>
                  <span className={styles.diffDel}>{`-${item.removed}`}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          className={styles.filesFooterToggle}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span>
            {expanded
              ? (isZh ? "收起文件" : "Show less")
              : (isZh ? `再显示 ${hiddenCount} 个文件` : `Show ${hiddenCount} more`)}
          </span>
          {expanded ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
        </button>
      )}
    </div>
  );
}

/** 展示可继续发送的建议问题，将选中的文本交给调用方。 */

/** 模型/回答给出的后续建议：编号后由用户自行选择，点击即作为下一条消息发送。 */
export function FollowUpSuggestions({
  isZh,
  suggestions,
  onSelect,
}: {
  isZh: boolean;
  suggestions: string[];
  onSelect: (question: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={styles.followUpList} role="list">
      {suggestions.map((question, index) => (
        <button
          key={`${index}-${question}`}
          type="button"
          className={styles.followUpBtn}
          role="listitem"
          onClick={() => onSelect(question)}
        >
          <span className={styles.followUpIndex}>{index + 1}</span>
          <span className={styles.followUpText}>{question}</span>
          {index === 0 && <span className={styles.followUpRecommended}>{isZh ? "推荐" : "Recommended"}</span>}
          <IconArrowRight size={14} stroke={1.8} className={styles.followUpArrow} />
        </button>
      ))}
    </div>
  );
}
