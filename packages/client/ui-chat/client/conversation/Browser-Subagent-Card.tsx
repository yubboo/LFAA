// 思维链专属浏览器子智能体卡片：运行中实时显示「正在使用内置浏览器 · 思考中/动作 (Xs)」，支持展开逐条查看浏览器步骤并一键打开右栏。
// 步骤列表复用共享限高滚动视口：超过阈值后原地滚动并实时贴底，长任务不再把整张卡片无限拉长。
import { memo, useState } from "react";
import { ScrollArea } from "@lfaa/ui-primitives/client";
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconCheck,
  IconChevronRight,
  IconWorld,
} from "@tabler/icons-react";
import type { AgentStepItem } from "../store/chat-types";
import { BrowserEvidence } from "./Browser-Evidence";
import { formatDuration } from "./StepTraceList";
import { useBoundedScroll } from "./useBoundedScroll";
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
  const childSteps = sub?.steps ?? [];
  const isRunning = Boolean(live && sub?.status === "running");
  // 展开态交给原生 details 维护，同时同步给共享滚动视口：收起时不测量，运行中重新展开后恢复贴底。
  const [open, setOpen] = useState(isRunning);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string>();
  const goalLine = step.detail
    ?.split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !/\((?:done|running|error)\)$/u.test(line));
  const goalSummary = goalLine && goalLine.length > 100 ? `${goalLine.slice(0, 99)}…` : goalLine;
  // 步骤数量、末尾步骤与实时动作组成内容指纹：追加步骤时同步贴底，用户上滚阅读后不再抢滚动条。
  const stepFingerprint = `${childSteps.length}:${childSteps[childSteps.length - 1]?.id ?? ""}:${sub?.liveAction ?? ""}`;
  const { viewportRef, contentRef, edges, handleWheel, handleScroll, resumeFollowing } = useBoundedScroll(
    open,
    childSteps.length > 0 || isRunning,
    stepFingerprint,
    isRunning,
  );
  if (!sub) return null;

  const isError = sub.status === "error" || sub.status === "stopped";
  const browserLabel = sub.browserLabel || (isZh ? "内置浏览器" : "Built-in Browser");
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
    <details
      className={styles.card}
      data-live={isRunning ? "true" : undefined}
      open={isRunning || undefined}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        setOpen(nextOpen);
        if (!nextOpen) setActiveEvidenceId(undefined);
        if (nextOpen && isRunning) resumeFollowing();
      }}
    >
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

        {goalSummary && (
          <div className={styles.goalBar} title={goalLine}>
            <span className={styles.goalTag}>{isZh ? "目标" : "Goal"}</span>
            <span className={styles.goalText}>{goalSummary}</span>
          </div>
        )}

        {(childSteps.length > 0 || isRunning) && (
          <ScrollArea
            ref={viewportRef}
            className={styles.stepScroll}
            role={edges.scrollable ? "region" : undefined}
            aria-label={edges.scrollable ? (isZh ? `${browserLabel}执行步骤` : `${browserLabel} steps`) : undefined}
            tabIndex={edges.scrollable ? 0 : undefined}
            data-scrollable={edges.scrollable ? "true" : undefined}
            data-fade-top={edges.fadeTop ? "true" : undefined}
            data-fade-bottom={edges.fadeBottom ? "true" : undefined}
            onWheel={handleWheel}
            onScroll={handleScroll}
          >
            <div ref={contentRef}>
              <ul className={styles.stepList}>
                {childSteps.map((item) => {
                  const itemErr = item.status === "error" || item.browserVerdict === "needs_fix";
                  const itemDone = item.status === "done" && !itemErr && item.browserVerdict !== "unverified";
                  const itemUnverified = !itemErr && item.browserVerdict === "unverified";
                  const stepTitle = [item.label ?? item.name, item.target, item.resultSummary].filter(Boolean).join(" · ");
                  const evidence = item.browserEvidence;
                  const expanded = Boolean(evidence && activeEvidenceId === evidence.id);
                  return (
                    <li key={item.id} className={styles.stepEntry}>
                      <div className={styles.stepItem}>
                        <span
                          className={styles.stepIcon}
                          data-status={itemDone ? "done" : itemErr ? "error" : itemUnverified ? "unverified" : "running"}
                          aria-hidden="true"
                        >
                          {itemDone ? (
                            <IconCheck size={10} />
                          ) : itemErr || itemUnverified ? (
                            <IconAlertCircle size={10} />
                          ) : (
                            <span className={styles.browserBadgeInner} />
                          )}
                        </span>
                        <span className={styles.stepText} title={stepTitle}>
                          <span>{item.label ?? item.name}</span>
                          {item.target && <span className={styles.stepTarget}>{item.target}</span>}
                          {item.resultSummary && <span className={styles.stepTarget}>· {item.resultSummary}</span>}
                        </span>
                      </div>
                      {evidence && (
                        <div className={styles.stepEvidenceWrap}>
                          <button
                            type="button"
                            className={styles.inlineThumbBtn}
                            data-selected={expanded ? "true" : undefined}
                            aria-pressed={expanded}
                            aria-label={expanded
                              ? (isZh ? "收起截图预览" : "Collapse screenshot")
                              : (isZh ? "展开实时验收截图" : "Expand verification screenshot")}
                            onClick={() => setActiveEvidenceId((cur) => (cur === evidence.id ? undefined : evidence.id))}
                          >
                            <BrowserEvidence id={evidence.id} sessionId={evidence.sessionId} isZh={isZh} compact={!expanded} />
                          </button>
                        </div>
                      )}
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
            </div>
          </ScrollArea>
        )}

        {!isRunning && step.resultPreview && (
          <div className={styles.resultBox}>{step.resultPreview}</div>
        )}
      </div>
    </details>
  );
});
