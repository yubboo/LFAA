// 已完成文件活动行：以左侧语义图标与动词（已创建/已编辑/已删除/已分析）、彩色文件类型图标芯片、悬停精准路径与真实行号呈现，点击后在右栏展开对应源码。
import { memo } from "react";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import {
  IconArrowUpRight,
  IconFileMinus,
  IconFilePlus,
  IconFileSearch,
  IconPencil,
} from "@tabler/icons-react";
import type { AgentStepItem } from "../store/chat-types";
import {
  formatReadLineRange,
  getActivityReadRange,
  getDisplayFileName,
  getFileActivityKind,
  normalizeDisplayPath,
} from "../shared/file-activity";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import styles from "./StepTraceList.module.css";
import rowStyles from "./File-Activity-Row.module.css";

/** 根据真实文件动作返回左侧语义图标。 */
function resolveFileKindIcon(kind: ReturnType<typeof getFileActivityKind>) {
  if (kind === "created") return IconFilePlus;
  if (kind === "deleted") return IconFileMinus;
  if (kind === "analyzed") return IconFileSearch;
  return IconPencil;
}

/** 渲染单条已完成的文件活动行（创建/编辑/删除/分析），支持悬停显示精准路径与点击右栏展开预览。 */
export const FileActivityRow = memo(function FileActivityRow({
  step,
  path,
  elapsed,
  locale,
  selected,
  onOpenFile,
}: {
  step: AgentStepItem;
  path: string;
  elapsed?: string | undefined;
  locale: ChatLocaleMessages;
  selected: boolean;
  onOpenFile: (stepId: string) => void;
}) {
  const labels = timelineMessages[locale.isZh ? "zh" : "en"];
  const kind = getFileActivityKind(step);
  const Icon = resolveFileKindIcon(kind);
  const fullPath = normalizeDisplayPath(path);
  const displayName = getDisplayFileName(fullPath);
  const lineRangeText = formatReadLineRange(getActivityReadRange(step));
  const hoverPathText = lineRangeText ? `${fullPath} ${lineRangeText}` : fullPath;

  return (
    <button
      type="button"
      className={`${styles.activityRow} ${styles.fileActivity} ${rowStyles.fileRow}`}
      data-kind={kind}
      aria-pressed={selected}
      title={fullPath}
      onClick={() => onOpenFile(step.id)}
    >
      <span className={`${styles.icon} ${rowStyles.actionIconWrap}`} data-icon-slot="true" aria-hidden="true">
        <Icon size={15} className={rowStyles.actionIcon} />
      </span>
      <span className={`${styles.toolVerb} ${rowStyles.fileVerb}`} data-activity-verb="true">{labels.fileKinds[kind]}</span>
      <span className={rowStyles.fileTargetSlot}>
        <span className={rowStyles.fileChipWrap}>
          <span className={rowStyles.fileChip}>
            <FileTypeIcon name={fullPath} kind="file" size={15} className={rowStyles.fileGlyph ?? ""} />
            <span className={rowStyles.fileLabel}>{displayName}</span>
            {lineRangeText && <span className={rowStyles.lineRange}>{lineRangeText}</span>}
          </span>
          <span className={rowStyles.pathTip} role="tooltip">
            <FileTypeIcon name={fullPath} kind="file" size={13} className={rowStyles.pathTipGlyph ?? ""} />
            <span className={rowStyles.pathTipText}>{hoverPathText}</span>
          </span>
        </span>
      </span>
      <span className={`${styles.lineCounts} ${rowStyles.countsReveal}`}>
        {!!step.addedLines && <span data-change="add">+{step.addedLines}</span>}
        {!!step.removedLines && <span data-change="remove">−{step.removedLines}</span>}
      </span>
      {elapsed && <span className={styles.stepElapsed}>{elapsed}</span>}
      <IconArrowUpRight size={13} className={`${styles.chevron} ${rowStyles.openArrow}`} aria-hidden="true" />
    </button>
  );
});
