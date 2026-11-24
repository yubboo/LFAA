// 输入区上方的会话固定条：未完成的任务卡与进行中的目标栏，按视图与状态决定是否占位。
import type { ChatGoalItem } from "../store/chat-types";
import { GoalBar } from "./GoalBar";
import { TodoDock } from "./TodoDock";
import { hasOpenSessionTodos, type SessionTodo } from "./session-todos";

/** 轨迹视图自带任务卡；对话视图只在还有未完成任务时显示，本轮已结束时自动结算残留的进行中条目不再永久占位。 */
export function SessionBars({ view, todos, paused, settled = false, goal, isZh, className, onEditGoal, onToggleGoalAuto }: {
  view: "chat" | "trace";
  todos: readonly SessionTodo[] | null;
  paused: boolean;
  /** 当前回复已正常结束且无运行任务：用于兜底结算模型未收尾的 in_progress 条目，避免任务卡永久转圈。 */
  settled?: boolean;
  goal: ChatGoalItem | null | undefined;
  isZh: boolean;
  /** 外层与输入框共用同一列宽，样式由调用方提供，避免跨文件取 CSS。 */
  className?: string | undefined;
  onEditGoal: (objective: string) => Promise<boolean>;
  /** 暂停/恢复目标自动续跑。 */
  onToggleGoalAuto: (next: boolean) => Promise<boolean>;
}) {
  const effectiveTodos = todos && settled
    ? todos.map((item) => (item.status === "in_progress" ? { ...item, status: "completed" as const } : item))
    : todos;
  const todoList = view === "chat" && effectiveTodos !== null && hasOpenSessionTodos(effectiveTodos) ? effectiveTodos : null;
  const activeGoal = goal && goal.status !== "complete" ? goal : null;
  if (!todoList && !activeGoal) return null;

  return (
    <>
      {todoList && (
        <div className={className}>
          <TodoDock todos={todoList} isZh={isZh} defaultCollapsed paused={paused} />
        </div>
      )}
      {activeGoal && (
        <div className={className}>
          <GoalBar goal={activeGoal} isZh={isZh} onEdit={onEditGoal} onToggleAutoContinue={onToggleGoalAuto} />
        </div>
      )}
    </>
  );
}