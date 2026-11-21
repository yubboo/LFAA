// 输入框上方的任务卡：渲染当前清单、各状态数量与折叠；没有清单时不占位。
import { useState } from "react";
import { IconChevronDown, IconChevronUp, IconListCheck } from "@tabler/icons-react";
import { countSessionTodos, type SessionTodo, type SessionTodoCounts } from "../session-todos";
import styles from "./TodoDock.module.css";

/** 清单超过该条数时折叠余项，避免长期任务把输入区顶走。 */
export const TODO_DOCK_VISIBLE_LIMIT = 12;

/** 组装「已完成 · 进行中 · 待处理」摘要，零值项省略。 */
function progressText(counts: SessionTodoCounts, isZh: boolean): string {
  const parts: string[] = [];
  if (counts.completed > 0) parts.push(isZh ? `已完成 ${counts.completed}` : `${counts.completed} done`);
  if (counts.inProgress > 0) parts.push(isZh ? `进行中 ${counts.inProgress}` : `${counts.inProgress} active`);
  if (counts.pending > 0) parts.push(isZh ? `待处理 ${counts.pending}` : `${counts.pending} pending`);
  return parts.join(" · ");
}

/** 任务卡：默认展开，可折叠；条目按状态显示状态点，超过上限时可展开全部。 */
export function TodoDock({ todos, isZh, defaultCollapsed = false, onToggle }: {
  todos: readonly SessionTodo[];
  isZh: boolean;
  /** 轨迹视图等空间紧张处默认收起，只留摘要行。 */
  defaultCollapsed?: boolean;
  /** 传入时每条任务可点击勾选；缺省表示只读展示。 */
  onToggle?: ((todo: SessionTodo) => void) | undefined;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  if (todos.length === 0) return null;

  const counts = countSessionTodos(todos);
  const visible = showAll ? todos : todos.slice(0, TODO_DOCK_VISIBLE_LIMIT);
  const hidden = todos.length - Math.min(todos.length, TODO_DOCK_VISIBLE_LIMIT);
  const title = isZh ? "任务清单" : "Tasks";

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
        <span className={styles.progress}>{progressText(counts, isZh)}</span>
        {collapsed
          ? <IconChevronDown size={14} className={styles.chevron} aria-hidden="true" />
          : <IconChevronUp size={14} className={styles.chevron} aria-hidden="true" />}
      </button>
      {!collapsed && (
        <ul className={styles.list}>
          {visible.map((item, index) => {
            const body = (
              <>
                <span className={styles.dot} data-status={item.status} aria-hidden="true" />
                <span className={styles.content}>{item.content}</span>
              </>
            );
            return (
              <li key={`${item.id}-${index}`} className={styles.item} data-status={item.status}>
                {onToggle ? (
                  <button
                    type="button"
                    className={styles.toggle}
                    role="checkbox"
                    aria-checked={item.status === "completed"}
                    aria-label={isZh ? `切换「${item.content}」的完成状态` : `Toggle “${item.content}”`}
                    onClick={() => onToggle(item)}
                  >
                    {body}
                  </button>
                ) : body}
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
        </ul>
      )}
    </section>
  );
}