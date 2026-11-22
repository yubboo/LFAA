// 输入框上方的任务卡：渲染当前清单、递增步骤序号、各状态数量与折叠；没有清单时不占位。
import { useState } from "react";
import { IconChevronDown, IconChevronUp, IconListCheck, IconPlayerPause } from "@tabler/icons-react";
import { countSessionTodos, type SessionTodo, type SessionTodoCounts } from "./session-todos";
import styles from "./TodoDock.module.css";

/** 清单超过该条数时折叠余项，避免长期任务把输入区顶走。 */
export const TODO_DOCK_VISIBLE_LIMIT = 12;

/** 组装「已完成 · 进行中 · 待处理」摘要，零值项省略；中文按 DSH 习惯把数量放在状态前。 */
function progressText(counts: SessionTodoCounts, isZh: boolean, paused: boolean): string {
  const parts: string[] = [];
  if (counts.completed > 0) parts.push(isZh ? `${counts.completed} 已完成` : `${counts.completed} done`);
  if (counts.inProgress > 0) {
    const activeLabel = paused ? (isZh ? "已暂停" : "paused") : (isZh ? "进行中" : "active");
    parts.push(`${counts.inProgress} ${activeLabel}`);
  }
  if (counts.pending > 0) parts.push(isZh ? `${counts.pending} 待处理` : `${counts.pending} pending`);
  return parts.join(" · ");
}

/** 单条任务的读屏状态文案；暂停态把「进行中」改成「已暂停」，与顶部摘要保持一致。 */
function statusLabel(status: SessionTodo["status"], isZh: boolean, paused: boolean): string {
  if (status === "completed") return isZh ? "已完成" : "done";
  if (status === "in_progress") {
    if (paused) return isZh ? "已暂停" : "paused";
    return isZh ? "进行中" : "active";
  }
  return isZh ? "待处理" : "pending";
}

/** 任务卡：默认展开，可折叠；条目按「1. 2. 3.」递增序号排列并带状态点，超过上限时可展开全部。 */
export function TodoDock({ todos, isZh, defaultCollapsed = false, paused = false }: {
  todos: readonly SessionTodo[];
  isZh: boolean;
  /** 轨迹视图等空间紧张处默认收起，只留摘要行。 */
  defaultCollapsed?: boolean;
  /** Agent 运行已中断：进行中行停转，显示暂停图标与「已暂停」。 */
  paused?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  if (todos.length === 0) return null;

  const counts = countSessionTodos(todos);
  const visible = showAll ? todos : todos.slice(0, TODO_DOCK_VISIBLE_LIMIT);
  const hidden = todos.length - Math.min(todos.length, TODO_DOCK_VISIBLE_LIMIT);
  const title = isZh ? "任务" : "Tasks";

  return (
    <section className={styles.root} data-testid="todo-dock" aria-label={title}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <IconListCheck size={15} className={styles.lead} aria-hidden="true" />
        <span className={styles.title}>{title}</span>
        <span className={styles.progress}>{progressText(counts, isZh, paused)}</span>
        {collapsed
          ? <IconChevronDown size={14} className={styles.chevron} aria-hidden="true" />
          : <IconChevronUp size={14} className={styles.chevron} aria-hidden="true" />}
      </button>
      {!collapsed && (
        <ol className={styles.list}>
          {visible.map((item, index) => {
            const step = index + 1;
            // 状态点只靠颜色区分不够：进行中换成旋转环，暂停态换成静态暂停图标，其余保持圆点。
            const marker = item.status === "in_progress"
              ? (paused
                ? <IconPlayerPause size={11} className={styles.pauseIcon} aria-hidden="true" />
                : <span className={styles.spinner} aria-hidden="true" />)
              : <span className={styles.dot} data-status={item.status} aria-hidden="true" />;
            const body = (
              <>
                <span className={styles.marker}>{marker}</span>
                <span className={styles.index} data-status={item.status} data-step={step} aria-hidden="true">{step}.</span>
                <span className={styles.content}>{item.content}</span>
                <span className={styles.srOnly}>{statusLabel(item.status, isZh, paused)}</span>
              </>
            );
            return (
              <li key={`${item.id}-${index}`} className={styles.item} data-status={item.status}>
                {body}
              </li>
            );
          })}
          {hidden > 0 && (
            <li className={styles.more}>
              <button
                type="button"
                className={styles.moreBtn}
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll
                  ? (isZh ? "收起多余条目" : "Show less")
                  : (isZh ? `展开全部 ${todos.length} 条` : `Show all ${todos.length}`)}
              </button>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}