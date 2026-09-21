/**
 * 文件：ChatWorkspace.tsx
 * 作用：Workspace / Chat 模式的线性 Agent 对话与 Run Timeline 视图。
 * 负责：用户消息、真实 Run 状态、可展开过程、最终回答流式文本与错误展示。
 * 不负责：Agent Runtime 事件产生、Provider 协议、Composer、Work Canvas。
 * 状态归属：无业务真值；只消费 Workspace Session 派生的 ChatMessageViewModel。
 * 对外接口：ChatWorkspace({ layoutMode, messages })。
 * 关联文件：../styles/ChatWorkspace.module.css、../../shared/contracts/workspace.types.ts。
 * 修改注意事项：过程信息只能来自 Runtime Event；不得伪造 reasoning / tool activity，也不得展示原始隐藏思维链。
 */
import { useEffect, useMemo, useState } from "react";
import type { AgentRunActivityViewModel, AgentRunProcessViewModel, ChatMessageViewModel } from "#workspace/contracts";
import styles from "../styles/ChatWorkspace.module.css";

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}分${String(seconds % 60).padStart(2, "0")}秒`;
}

function activityIcon(activity: AgentRunActivityViewModel): string {
  if (activity.kind === "command") return "›_";
  if (activity.kind === "file") return "▱";
  if (activity.kind === "search") return "⌕";
  if (activity.kind === "mcp" || activity.kind === "tool") return "◇";
  if (activity.kind === "review") return "✓";
  if (activity.kind === "model") return "◌";
  return "·";
}

function ActivityRow({ activity }: { activity: AgentRunActivityViewModel }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(activity.detail || activity.output);
  const stateLabel = activity.status === "running"
    ? "运行中"
    : activity.status === "completed"
      ? "已完成"
      : activity.status === "declined"
        ? "已拒绝"
        : activity.status === "interrupted"
          ? "已中断"
          : "失败";
  return (
    <div className={styles.activity} data-state={activity.status}>
      <button
        type="button"
        className={styles.activityHead}
        onClick={() => hasDetails && setOpen((value) => !value)}
        aria-expanded={hasDetails ? open : undefined}
        disabled={!hasDetails}
      >
        <span className={styles.activityIcon}>{activityIcon(activity)}</span>
        <span className={styles.activityTitle}>{activity.title}</span>
        <span className={styles.activityState}>{stateLabel}</span>
        {hasDetails ? <span className={styles.chevron}>{open ? "⌃" : "⌄"}</span> : null}
      </button>
      {open ? (
        <div className={styles.activityDetails}>
          {activity.detail ? <div>{activity.detail}</div> : null}
          {activity.output ? <pre>{activity.output}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

function RunProcessCard({ process }: { process: AgentRunProcessViewModel }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (process.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [process.status]);
  const elapsed = Math.max(0, (process.completedAt ?? now) - process.startedAt);
  const hasDetails = Boolean(process.reasoningSummary || process.plan || process.activities.length);
  const title = process.status === "running"
    ? `已处理 ${formatDuration(elapsed)}`
    : process.status === "completed"
      ? `用时 ${formatDuration(elapsed)}`
      : process.status === "cancelled"
        ? `已停止 · ${formatDuration(elapsed)}`
        : `运行失败 · ${formatDuration(elapsed)}`;
  const latestActivity = useMemo(() => [...process.activities].reverse().find((item) => item.status === "running") ?? process.activities.at(-1), [process.activities]);

  return (
    <section className={styles.runProcess} data-status={process.status} data-phase={process.phase}>
      <button type="button" className={styles.runProcessHeader} onClick={() => hasDetails && setOpen((value) => !value)} disabled={!hasDetails} aria-expanded={hasDetails ? open : undefined}>
        <span className={styles.runTime}>{title}</span>
        <span className={styles.runDivider} />
        <span className={styles.runLabel}>{process.label}</span>
        {hasDetails ? <span className={styles.chevron}>{open ? "⌃" : "⌄"}</span> : null}
      </button>

      {!open && process.status === "running" ? (
        <div className={styles.runPreview}>
          <span className={styles.runningDot} aria-hidden />
          <span>{latestActivity?.title ?? (process.reasoningSummary ? process.reasoningSummary.split(/\r?\n/u).filter(Boolean).at(-1) : process.label)}</span>
        </div>
      ) : null}

      {open ? (
        <div className={styles.runDetails}>
          {process.reasoningSummary ? (
            <details className={styles.reasoning} open={process.status === "running"}>
              <summary>思考摘要</summary>
              <div>{process.reasoningSummary}</div>
            </details>
          ) : null}
          {process.plan ? (
            <details className={styles.reasoning}>
              <summary>计划</summary>
              <div>{process.plan}</div>
            </details>
          ) : null}
          {process.activities.length ? (
            <div className={styles.activities}>
              {process.activities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function ChatWorkspace({ layoutMode, messages }: {
  layoutMode: "desktop" | "compact" | "mobile";
  messages: readonly ChatMessageViewModel[];
}) {
  return (
    <div className={styles.scroll} data-layout-mode={layoutMode} data-ui="chat-workspace">
      <div className={styles.inner}>
        {messages.length === 0 ? (
          <article className={`${styles.answer} ${styles.welcome}`}>
            <h1>聊天</h1>
            <p>直接说你想完成什么。Chat Agent 与 Work Agent 共用同一套 Agent Core；运行过程会实时显示真实状态、工具活动与流式结果。</p>
          </article>
        ) : (
          <div className={styles.timeline} role="log" aria-live="polite">
            {messages.map((message) => {
              if (message.role === "run" && message.process) return <RunProcessCard key={message.id} process={message.process} />;
              const roleClass = message.role === "user" ? styles.user : message.role === "assistant" ? styles.assistant : styles.error;
              return (
                <article key={message.id} className={`${styles.message} ${roleClass}`}>
                  <div className={styles.role}>{message.role === "user" ? "你" : message.role === "assistant" ? "LFAA" : "运行错误"}</div>
                  <div className={styles.body}>{message.text}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
