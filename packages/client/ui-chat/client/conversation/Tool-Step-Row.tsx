// 工具链单行组件：按真实工具类型、文件彩标与执行状态呈现动作、目标参数、耗时与状态，已完成文件行委托 FileActivityRow 呈现。
import { memo } from "react";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import {
  IconAlertCircle,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFileSearch,
  IconFolder,
  IconPencil,
  IconRobot,
  IconSearch,
  IconSparkles,
  IconTerminal2,
  IconTool,
  IconWorld,
} from "@tabler/icons-react";
import { getActivityKind, getActivityLabel } from "./activity-label";
import { BrowserSubagentCard, isBrowserSubagentStep } from "./Browser-Subagent-Card";
import { FileActivityRow } from "./File-Activity-Row";
import { ActivityPathTip } from "./Activity-Path-Tip";
import { SubagentDispatchRow } from "./Subagent-Dispatch-Row";
import type { AgentStepItem } from "../store/chat-types";
import {
  fileActivityTools,
  getActivityArgumentPath,
  getOpenableActivityFilePath,
} from "../shared/file-activity";
import { timelineMessages, type ChatLocaleMessages } from "../locales";
import styles from "./StepTraceList.module.css";
import detailStyles from "./Tool-Step-Row.module.css";

export interface FileActivityActions {
  onOpenFile: (stepId: string) => void;
  onOpenTrace?: ((stepId: string) => void) | undefined;
  onOpenBrowser?: (() => void) | undefined;
  onOpenSubagent?: ((subagentId: string, role?: string) => void) | undefined;
  selectedFileStepId?: string | undefined;
}

const SEARCH_TOOL_RE = /(?:^|_)(?:grep|glob|search|find)(?:_|$)/u;
const WEB_TOOL_RE = /(?:^|_)(?:browser|fetch|web|http|url)(?:_|$)/u;

/** 根据步骤的实际类型与工具语义动态匹配图标，不局限于少量写死名称。 */
function resolveToolIcon(step: AgentStepItem, kind: ReturnType<typeof getActivityKind>) {
  const name = step.toolName ?? "";
  if (kind === "command") return IconTerminal2;
  if (kind === "subagent") return IconRobot;
  if (kind === "skill") return IconSparkles;
  if (kind === "file") return IconPencil;
  if (name === "list_dir" || name.includes("directory") || name.includes("list_")) return IconFolder;
  if (SEARCH_TOOL_RE.test(name)) return IconSearch;
  if (WEB_TOOL_RE.test(name)) return IconWorld;
  if (kind === "read") return IconFileSearch;
  return IconTool;
}

/** 格式化步骤耗时：短于 1 秒显示毫秒，1 秒以上按小数/整数秒展示。 */
function formatStepElapsed(step: AgentStepItem, isZh: boolean): string | undefined {
  if (step.startedAt === undefined || (step.status !== "done" && step.status !== "error")) return undefined;
  const ms = Math.max(0, step.timestamp - step.startedAt);
  if (ms < 100) return undefined;
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(ms < 10_000 ? 1 : 0);
  return isZh ? `${sec}s` : `${sec}s`;
}

/** 若参数预览是完整 JSON 则做缩进美化，残缺流式片段保留原文。 */
function formatArgsPreview(raw?: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

/** 从步骤里动态提取行内展示的目标参数（路径、关键词、目录、URL 等），避免重复拼接主标签。 */
function resolveInlineTarget(step: AgentStepItem, primaryLabel: string): string | undefined {
  const target = step.toolTarget?.trim()
    || getActivityArgumentPath(step)?.trim()
    || (step.toolName === "list_dir" ? "." : undefined);
  if (!target) return undefined;
  if (primaryLabel.includes(target)) return undefined;
  return target;
}

/** 判断进行态或目录工具行是否应给目标参数附带彩色文件或目录图标。 */
function resolveInlineGlyphKind(step: AgentStepItem): "file" | "directory" | null {
  const name = step.toolName;
  if (!name) return null;
  if (name === "list_dir") return "directory";
  if (name === "read_file" || fileActivityTools.has(name)) return "file";
  return null;
}

/** 渲染单条工具/命令/文件活动行，保持同级左对齐、彩标文件芯片与行尾固定展开位。 */
export const ToolStepRow = memo(function ToolStepRow({
  step,
  locale,
  live,
  now,
  onOpenFile,
  onOpenTrace,
  onOpenBrowser,
  onOpenSubagent,
  selectedFileStepId,
}: {
  step: AgentStepItem;
  locale: ChatLocaleMessages;
  /** 当前回复是否仍在流式运行：只有运行中的行才允许播放渐变动效。 */
  live: boolean;
  /** 外部共享时钟，供浏览器子智能体实时显示已用秒数。 */
  now?: number | undefined;
} & FileActivityActions) {
  if (isBrowserSubagentStep(step)) {
    return (
      <BrowserSubagentCard
        step={step}
        isZh={locale.isZh}
        live={live}
        now={now}
        onOpenBrowser={onOpenBrowser}
      />
    );
  }
  if (step.subagent) {
    return (
      <SubagentDispatchRow
        step={step}
        isZh={locale.isZh}
        live={live}
        onOpenSubagent={onOpenSubagent}
      />
    );
  }
  const labels = timelineMessages[locale.isZh ? "zh" : "en"];
  const elapsed = formatStepElapsed(step, locale.isZh);
  const openablePath = getOpenableActivityFilePath(step);
  if (openablePath && step.status === "done") {
    return (
      <FileActivityRow
        step={step}
        path={openablePath}
        elapsed={elapsed}
        locale={locale}
        selected={selectedFileStepId === step.id}
        onOpenFile={onOpenFile}
      />
    );
  }

  const command = step.commandTrace;
  const kind = getActivityKind(step);
  const isCommand = kind === "command";
  const active = step.status === "preparing" || step.status === "running";
  // 只有仍在运行中的步骤才标记为活动行，结束后即使事件残留运行状态也不再渐变。
  const liveRow = live && active;
  const hasDetails = Boolean(
    onOpenTrace || active || command || step.argsPreview || step.resultPreview || step.detail || step.toolTarget || step.argumentChars !== undefined,
  );
  const Icon = resolveToolIcon(step, kind);
  // 动态构建主标签与目标参数：命令显示命令行；常规/自定义工具按场景区分动作名与目标参数。
  const primaryLabel = command?.command ?? getActivityLabel(step, locale.isZh, false);
  const inlineTarget = isCommand ? undefined : resolveInlineTarget(step, primaryLabel);
  const inlineGlyphKind = inlineTarget ? resolveInlineGlyphKind(step) : null;
  const StatusIcon = step.status === "done" ? IconCheck : step.status === "error" ? IconAlertCircle : IconClock;
  const statusLabel = step.status === "done" ? locale.statusDone
    : step.status === "error" ? locale.statusError
      : step.status === "preparing" ? labels.preparing
        : step.status === "waiting_approval" ? locale.statusWaitingApproval : locale.statusRunning;
  // 状态标记统一放在行尾：运行中是圆环，完成后是强调色对勾，避免前后位置不一致。
  const status = (
    <span key={step.status} className={styles.activityStatus} data-status={step.status} title={statusLabel}>
      {active ? <span className={styles.liveDot} aria-hidden="true" /> : <StatusIcon size={13} aria-hidden="true" />}
      <span className={active ? undefined : styles.srOnly}>{statusLabel}</span>
    </span>
  );
  const row = (
    <>
      {/* 图标先落在统一的 1.15rem 槽位里，与文件活动行气泡位同宽，保证同级行动词起点一致。 */}
      <span className={styles.iconSlot} data-icon-slot="true" aria-hidden="true">
        <Icon size={isCommand ? 15 : 14} className={styles.icon} />
      </span>
      <span className={inlineGlyphKind ? `${styles.activityTitle} ${styles.activityTitleTip}` : styles.activityTitle}>
        <span className={inlineTarget ? styles.toolVerb : undefined} data-activity-verb="true">{primaryLabel}</span>
        {inlineTarget && (
          inlineGlyphKind ? (
            <ActivityPathTip path={inlineTarget} text={inlineTarget} kind={inlineGlyphKind} className={detailStyles.inlineTargetAnchor}>
              <span className={`${styles.toolTarget} ${detailStyles.inlineTargetWithGlyph}`}>
                <span className={detailStyles.inlineGlyphSlot}>
                  <FileTypeIcon name={inlineTarget} kind={inlineGlyphKind} size={14} className={detailStyles.inlineFileGlyph ?? ""} />
                </span>
                <span className={detailStyles.inlineTargetText}>{inlineTarget}</span>
              </span>
            </ActivityPathTip>
          ) : (
            <span className={styles.toolTarget}>{inlineTarget}</span>
          )
        )}
      </span>
      {step.status === "preparing" && step.argumentChars !== undefined && (
        <span className={styles.stepElapsed}>{labels.receivedArgs(step.argumentChars)}</span>
      )}
      {elapsed && <span className={styles.stepElapsed}>{elapsed}</span>}
      {status}
      {(hasDetails || onOpenTrace) && <IconChevronRight size={13} className={styles.chevron} aria-hidden="true" />}
    </>
  );

  if (!hasDetails) {
    return (
      <div className={styles.activityRow} data-kind={kind} data-status={step.status} data-live={liveRow ? "true" : undefined}>
        {row}
      </div>
    );
  }

  const formattedArgs = formatArgsPreview(step.argsPreview);
  const showCommandResult = Boolean(command && (step.status === "done" || step.status === "error"));
  const showTraceLink = Boolean(onOpenTrace && kind !== "read" && kind !== "file");

  return (
    <details className={styles.activityDisclosure}>
      <summary className={styles.activityRow} data-kind={kind} data-status={step.status} data-live={liveRow ? "true" : undefined}>
        {row}
      </summary>
      <div className={detailStyles.activityDetail} data-kind={isCommand ? "command" : undefined} data-status={step.status} data-live={liveRow ? "true" : undefined}>
        {command ? (
          <>
            <div className={detailStyles.terminalHeader}>
              {step.status === "running" && <span className={styles.liveDot} aria-hidden="true" />}
              <span className={`${styles.activityTitle} ${detailStyles.terminalTitle}`}>{step.status === "running" ? labels.runningCommand : labels.command}</span>
              {elapsed && <span className={styles.stepElapsed}>{elapsed}</span>}
            </div>
            <pre>{`$ ${command.command}`}</pre>
            {command.output && <pre className={detailStyles.output}>{command.output}</pre>}
          </>
        ) : (
          <>
            {(step.toolName || elapsed) && (
              <div className={detailStyles.detailMeta}>
                {step.toolName && <code className={detailStyles.detailToolBadge}>{step.toolName}</code>}
                {step.toolTarget && <span className={detailStyles.detailTarget}>{step.toolTarget}</span>}
                {elapsed && <span className={styles.stepElapsed}>{elapsed}</span>}
              </div>
            )}
            {step.argumentChars !== undefined && <div className={detailStyles.detailHint}>{labels.receivedArgs(step.argumentChars)}</div>}
            {step.status === "preparing" && step.argumentChars === undefined && <div className={detailStyles.detailHint}>{labels.awaitingArgs}</div>}
            {formattedArgs && (
              <div className={detailStyles.detailSection}>
                <div className={detailStyles.detailLabel}>{locale.isZh ? "调用参数" : "Arguments"}</div>
                <pre className={detailStyles.output}>{formattedArgs}</pre>
              </div>
            )}
            {step.resultPreview && (
              <div className={detailStyles.detailSection}>
                <div className={detailStyles.detailLabel}>{locale.isZh ? "执行结果" : "Output"}</div>
                <pre className={detailStyles.output}>{step.resultPreview}</pre>
              </div>
            )}
          </>
        )}
        {step.detail && <pre className={detailStyles.output}>{step.detail}</pre>}
        {(showTraceLink || showCommandResult) && (
          <div className={detailStyles.detailFooter}>
            {showTraceLink && onOpenTrace && (
              <button type="button" className={detailStyles.traceLink} onClick={() => onOpenTrace(step.id)}>
                {locale.isZh ? "查看" : "View"}
              </button>
            )}
            {showCommandResult && command && (
              <div className={detailStyles.commandResult} data-status={step.status}>
                <StatusIcon size={13} aria-hidden="true" />
                {step.status === "done" ? labels.commandSucceeded : labels.commandFailed}
                {command.exitCode !== undefined && <span>{labels.exitCode} {command.exitCode}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
});
