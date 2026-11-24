// 思维链专属浏览器子智能体卡片：运行中实时显示「正在使用内置浏览器 · 思考中/动作 (Xs)」，支持展开逐条查看浏览器步骤并一键打开右栏。
import { memo } from "react";
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconCheck,
  IconChevronRight,
  IconWorld,
} from "@tabler/icons-react";
import type { AgentStepItem } from "../store/chat-types";
import { formatDuration } from "./StepTraceList";
import styles from "./Browser-Subagent-Card.module.css";

/** 判定某条子智能体步骤是否为浏览器专属子智能体（兼容历史仅有 detail 文本的旧会话）。 */
export function isBrowserSubagentStep(step: AgentStepItem): boolean {
  if (!step.subagent) return false;
  if (step.subagent.kind === "browser") return true;
  if (step.subagent.steps?.some((item) => item.name.startsWith("browser_"))) return true;
  return Boolean(step.detail && /\bbrowser_[a-z_]+\b/u.test(step.detail));
}

export const BrowserSubagentCard = memo(function BrowserSubagentCard({
  step,
  isZh,
  live,
  now,
  onOpenBrowser,
}: {
  step: AgentStepItem;
  isZh: boolean;
  live: boolean;
  now?: number | undefined;
  onOpenBrowser?: (() => void) | undefined;
}) {
  const sub = step.subagent;
  if (!sub) return null;

  const isRunning = live && sub.status === "running";
  const isError = sub.status === "error" || sub.status === "stopped";
  const browserLabel = sub.browserLabel || (isZh ? "内置浏览器" : "Built-in Browser");
  const childSteps = sub.steps ?? [];
  const stepCount = childSteps.length;
  const elapsedMs = isRunning && now !== undefined
    ? Math.max(0, now - (step.startedAt ?? step.timestamp))
    : step.startedAt !== undefined && step.timestamp >= step.startedAt
      ? step.timestamp - step.startedAt
      : undefined;
  const elapsedText = elapsedMs !== undefined && elapsedMs >= 1000
    ? formatDuration(elapsedMs, isZh)
    : undefined;

  const liveActionText = sub.liveAction?.trim() || (isZh ? "思考中" : "Thinking");
  const headline = isRunning
    ? (isZh ? `正在使用${browserLabel}` : `Using ${browserLabel}`)
    : isError
      ? (isZh ? `${browserLabel}子智能体已中断` : `${browserLabel} subagent stopped`)
      : (isZh ? `已使用${browserLabel}` : `Used ${browserLabel}`);
  const metaText = isRunning
    ? `${liveActionText}${elapsedText ? ` (${elapsedText})` : ""}…`
    : `${sub.role}${elapsedText ? ` · ${elapsedText}` : ""}`;
  const countText = stepCount > 0
    ? (isZh ? `${stepCount} 浏览器步骤` : `${stepCount} browser ${stepCount === 1 ? "step" : "steps"}`)
    : undefined;

  return (
    <details className={styles.card} data-live={isRunning ? "true" : undefined} open={isRunning || undefined}>
      <summary className={styles.summary}>
        <span
          className={styles.browserBadge}
          data-status={isRunning ? "running" : isError ? "error" : "done"}
          aria-hidden="true"
        >
          {isRunning ? (
            <span className={styles.browserBadgeInner} />
          ) : isError ? (
            <IconAlertCircle size={13} />
          ) : (
            <IconWorld size={13} />
          )}
        </span>
        <span className={styles.summaryMain}>
          <span className={styles.summaryTitle}>{headline}</span>
          <span className={styles.summaryMeta}>· {metaText}</span>
        </span>
        {countText && <span className={styles.stepCount}>{countText}</span>}
        <IconChevronRight size={14} className={styles.chevron} aria-hidden="true" />
      </summary>

      <div className={styles.body}>
        <div className={styles.bodyHeader}>
          <div className={styles.headerLeft}>
            <span>{isZh ? "子智能体" : "Subagent"}</span>
            <span className={styles.roleTag}>{sub.role}</span>
            <span className={styles.envPill}>
              <IconWorld size={11} aria-hidden="true" />
              {browserLabel}
            </span>
          </div>
          {onOpenBrowser && (
            <button
              type="button"
              className={styles.openBrowserBtn}
              onClick={onOpenBrowser}
            >
              <span>{isZh ? "查看浏览器" : "Open browser"}</span>
              <IconArrowUpRight size={12} aria-hidden="true" />
            </button>
          )}
        </div>

        {(childSteps.length > 0 || isRunning) && (
          <ul className={styles.stepList}>
            {childSteps.map((item) => {
              const itemDone = item.status === "done";
              const itemErr = item.status === "error";
              return (
                <li key={item.id} className={styles.stepItem}>
                  <span
                    className={styles.stepIcon}
                    data-status={itemDone ? "done" : itemErr ? "error" : "running"}
                    aria-hidden="true"
                  >
                    {itemDone ? (
                      <IconCheck size={10} />
                    ) : itemErr ? (
                      <IconAlertCircle size={10} />
                    ) : (
                      <span className={styles.browserBadgeInner} />
                    )}
                  </span>
                  <span className={styles.stepText} title={item.target ? `${item.label ?? item.name} · ${item.target}` : (item.label ?? item.name)}>
                    <span>{item.label ?? item.name}</span>
                    {item.target && <span className={styles.stepTarget}>{item.target}</span>}
                  </span>
                </li>
              );
            })}
            {isRunning && (
              <li className={styles.liveRow}>
                <IconWorld size={12} aria-hidden="true" />
                <span>{liveActionText}{elapsedText ? ` (${elapsedText})` : ""}…</span>
              </li>
            )}
          </ul>
        )}

        {!isRunning && step.resultPreview && (
          <div className={styles.resultBox}>{step.resultPreview}</div>
        )}
      </div>
    </details>
  );
});
