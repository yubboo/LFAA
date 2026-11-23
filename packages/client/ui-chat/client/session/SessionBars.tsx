// 输入区上方的会话固定条：未完成的任务卡与进行中的目标栏，按视图与状态决定是否占位。
import type { ChatGoalItem } from "../store/chat-types";
import { GoalBar } from "./GoalBar";
import { TodoDock } from "./TodoDock";
import { hasOpenSessionTodos, type SessionTodo } from "./session-todos";

/** 轨迹视图自带任务卡；对话视图只在还有未完成任务时显示，全部完成后不再占位。 */
export function SessionBars({ view, todos, paused, goal, isZh, className, onEditGoal, onToggleGoalAuto }: {
  view: "chat" | "trace";
  todos: readonly SessionTodo[] | null;
  paused: boolean;
  goal: ChatGoalItem | null | undefined;
  isZh: boolean;
  /** 外层与输入框共用同一列宽，样式由调用方提供，避免跨文件取 CSS。 */
  className?: string | undefined;
  onEditGoal: (objective: string) => Promise<boolean>;
  /** 暂停/恢复目标自动续跑。 */
  onToggleGoalAuto: (next: boolean) => Promise<boolean>;
}) {
  const todoList = view === "chat" && todos !== null && hasOpenSessionTodos(todos) ? todos : null;
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