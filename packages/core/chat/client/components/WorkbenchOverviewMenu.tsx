// 渲染右侧工作台“概览”弹层：变更统计、子智能体与后台任务摘要及快捷入口。
import {
  IconCheck,
  IconChevronRight,
  IconCircleX,
  IconFile,
  IconFileDiff,
  IconFolder,
  IconLoader2,
  IconPlayerStop,
  IconPuzzle,
  IconRobot,
  IconTerminal2,
} from "@tabler/icons-react";
import type { AgentStepItem } from "../chat-types";
import activityStyles from "./StepTraceList.module.css";
import type { RightJobItem } from "./RightTerminalPane";
import type { RightSubagentItem } from "./RightSubagentsPane";
import styles from "./RightWorkbenchActions.module.css";

/** 概览使用当前会话任务的实际状态，逐项详情仍通过原来的工作台入口打开。 */
function overviewActivity(items: readonly (RightJobItem | RightSubagentItem)[], loaded: boolean, isZh: boolean): string {
  if (!loaded) return isZh ? "等待读取" : "Waiting for data";
  if (!items.length) return isZh ? "暂无" : "None yet";
  const running = items.filter(({ status }) => status === "running").length;
  const done = items.filter(({ status }) => status === "done").length;
  const failed = items.filter(({ status }) => status === "error").length;
  const stopped = items.length - running - done - failed;
  return [
    running ? (isZh ? `${running} 项运行中` : `${running} running`) : "",
    done ? (isZh ? `${done} 项完成` : `${done} completed`) : "",
    failed ? (isZh ? `${failed} 项失败` : `${failed} failed`) : "",
    stopped ? (isZh ? `${stopped} 项已停止` : `${stopped} stopped`) : "",
  ].filter(Boolean).join(" · ");
}

/** 展示项目变更与任务概览；数据刷新与选中跳转仍由父组件负责。 */
export function WorkbenchOverviewMenu({
  isZh,
  projectName,
  projectId,
  changedFiles,
  diffError,
  diffSummary,
  foreground,
  jobs,
  subagents,
  jobsLoaded,
  subagentsLoaded,
  showAllJobs,
  showAllSubs,
  onToggleShowAllJobs,
  onToggleShowAllSubs,
  onTriggerReview,
  onTriggerFiles,
  onTriggerTerminal,
  onTriggerSubagents,
  onStopJob,
  onOpenExtensions,
  onCloseMenu,
}: {
  isZh: boolean;
  projectName?: string | undefined;
  projectId: string | null;
  changedFiles: number | null;
  diffError: boolean;
  diffSummary: { added: number; removed: number } | null;
  foreground: AgentStepItem | undefined;
  jobs: readonly RightJobItem[];
  subagents: readonly RightSubagentItem[];
  jobsLoaded: boolean;
  subagentsLoaded: boolean;
  showAllJobs: boolean;
  showAllSubs: boolean;
  onToggleShowAllJobs: () => void;
  onToggleShowAllSubs: () => void;
  onTriggerReview: () => void;
  onTriggerFiles: () => void;
  onTriggerTerminal: (jobId?: string) => void;
  onTriggerSubagents: (subagentId?: string) => void;
  onStopJob: (jobId: string) => void;
  onOpenExtensions?: (() => void) | undefined;
  onCloseMenu: () => void;
}) {
  const numberLocale = isZh ? "zh-CN" : "en";
  const visibleSubs = showAllSubs ? subagents : subagents.slice(0, 2);
  const visibleJobs = showAllJobs ? jobs : jobs.slice(0, 2);
  const changeLabel = !projectId ? (isZh ? "未绑定项目" : "No linked project")
    : diffError ? (isZh ? "Git 统计不可用" : "Git statistics unavailable")
      : changedFiles === null ? (isZh ? "正在读取变更…" : "Loading changes…")
        : (isZh ? `${changedFiles.toLocaleString(numberLocale)} 个变更文件`
          : `${changedFiles.toLocaleString(numberLocale)} changed ${changedFiles === 1 ? "file" : "files"}`);

  return (
    <div className={`${styles.popover} ${styles.overviewPopover}`} role="dialog" aria-label={isZh ? "工作台概览" : "Workbench overview"}>
      <div className={styles.overviewHeader}>
        <IconFolder size={15} aria-hidden="true" />
        <h2 className={styles.overviewTitle} title={projectName}>{projectName || (isZh ? "工作台概览" : "Workbench overview")}</h2>
      </div>
      <button type="button" className={`${styles.menuItem} ${styles.overviewChanges}`} onClick={onTriggerReview}>
        <IconFileDiff size={16} aria-hidden="true" />
        <strong>{isZh ? "变更" : "Changes"}</strong>
        <span className={styles.overviewMeta}>{changeLabel}</span>
        {!diffError && diffSummary && (
          <span className={styles.diffDelta} title={isZh ? "已跟踪文件相对 HEAD 的差异；不含未跟踪文件" : "Tracked changes relative to HEAD; untracked files excluded"}>
            <em className={styles.diffPlus}>+{diffSummary.added.toLocaleString(numberLocale)}</em>
            <em className={styles.diffMinus}>−{diffSummary.removed.toLocaleString(numberLocale)}</em>
          </span>
        )}
        <IconChevronRight size={13} className={styles.trailingIcon} aria-hidden="true" />
      </button>
      {foreground?.commandTrace && (
        <div className={styles.overviewSectionHead} title={foreground.commandTrace.command}>
          <span className={activityStyles.liveDot} aria-hidden="true" />
          <span className={styles.itemEllipsis}>{isZh ? "前台命令" : "Foreground command"} · {foreground.commandTrace.command}</span>
        </div>
      )}
      <div className={styles.divider} />
      <button type="button" className={`${styles.menuItem} ${styles.overviewGroup}`} onClick={() => onTriggerSubagents()}>
        <IconRobot size={16} aria-hidden="true" />
        <span className={styles.overviewLabel}>
          <strong>{isZh ? "子智能体" : "Subagents"}</strong>
          <span className={styles.overviewMeta}>{overviewActivity(subagents, subagentsLoaded, isZh)}</span>
        </span>
        <IconChevronRight size={13} className={styles.trailingIcon} aria-hidden="true" />
      </button>
      {visibleSubs.map((sub) => {
        const Icon = sub.status === "running" ? IconLoader2 : sub.status === "done" ? IconCheck : IconCircleX;
        return (
          <button key={sub.id} type="button" className={`${styles.menuItem} ${styles.overviewDetail}`} title={sub.role} onClick={() => onTriggerSubagents(sub.id)}>
            <Icon size={13} className={styles.statusIcon} data-status={sub.status} aria-hidden="true" />
            <span className={styles.itemEllipsis}>{sub.role}</span>
          </button>
        );
      })}
      {subagents.length > 2 && (
        <button type="button" className={styles.viewAllLink} onClick={onToggleShowAllSubs}>
          {showAllSubs ? (isZh ? "收起" : "Show less") : (isZh ? "查看全部" : "View all")}
        </button>
      )}

      <div className={styles.divider} />
      <button type="button" className={`${styles.menuItem} ${styles.overviewGroup}`} onClick={() => onTriggerTerminal()}>
        <IconTerminal2 size={16} aria-hidden="true" />
        <span className={styles.overviewLabel}>
          <strong>{isZh ? "后台任务" : "Background tasks"}</strong>
          <span className={styles.overviewMeta}>{overviewActivity(jobs, jobsLoaded, isZh)}</span>
        </span>
        <IconChevronRight size={13} className={styles.trailingIcon} aria-hidden="true" />
      </button>
      {visibleJobs.map((job) => {
        const Icon = job.status === "running" ? IconLoader2 : job.status === "done" ? IconCheck : IconCircleX;
        return (
          <div key={job.id} className={styles.jobRowWrap}>
            <button type="button" className={`${styles.menuItem} ${styles.overviewDetail}`} title={job.title} onClick={() => onTriggerTerminal(job.id)}>
              <Icon size={13} className={styles.statusIcon} data-status={job.status} aria-hidden="true" />
              <span className={styles.itemEllipsis}>{job.title}</span>
            </button>
            {job.status === "running" && (
              <button
                type="button"
                className={styles.stopJobBtn}
                title={isZh ? "停止任务" : "Stop job"}
                onClick={() => onStopJob(job.id)}
              >
                <IconPlayerStop size={12} />
              </button>
            )}
          </div>
        );
      })}
      {jobs.length > 2 && (
        <button type="button" className={styles.viewAllLink} onClick={onToggleShowAllJobs}>
          {showAllJobs ? (isZh ? "收起" : "Show less") : (isZh ? "查看全部" : "View all")}
        </button>
      )}
      <div className={styles.overviewShortcuts} aria-label={isZh ? "工作台快捷操作" : "Workbench shortcuts"}>
        <button type="button" className={styles.menuItem} onClick={onTriggerFiles}>
          <IconFile size={15} aria-hidden="true" />
          <span>{isZh ? "文件" : "Files"}</span>
        </button>
        <button type="button" className={styles.menuItem} onClick={() => onTriggerTerminal()}>
          <IconTerminal2 size={15} aria-hidden="true" />
          <span>{isZh ? "终端" : "Terminal"}</span>
        </button>
        {onOpenExtensions && (
          <button type="button" className={styles.menuItem} onClick={() => { onOpenExtensions(); onCloseMenu(); }}>
            <IconPuzzle size={15} aria-hidden="true" />
            <span>{isZh ? "扩展" : "Extensions"}</span>
          </button>
        )}
      </div>
    </div>
  );
}