// 从会话步骤里取最近一次任务清单，并统计各状态数量；供输入框上方的任务卡与活动行复用。
import type { AgentStepItem, ChatMessageItem } from "./chat-types";

/** 单条任务，类型直接取自步骤契约，避免客户端再复制一份。 */
export type SessionTodo = NonNullable<AgentStepItem["todos"]>[number];

/** 各状态数量。 */
export interface SessionTodoCounts {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

/** 统计清单各状态数量。 */
export function countSessionTodos(todos: readonly SessionTodo[]): SessionTodoCounts {
  const completed = todos.filter((item) => item.status === "completed").length;
  const inProgress = todos.filter((item) => item.status === "in_progress").length;
  return { total: todos.length, completed, inProgress, pending: todos.length - completed - inProgress };
}

/**
 * 取该会话最近一次的完整清单：从最后一条消息往前找，每条消息从最后一步往前找；
 * `todo_write` 是整表替换，所以最近一步的清单就是当前清单。返回 null 表示没有清单。
 */
export function latestSessionTodos(messages: readonly ChatMessageItem[]): SessionTodo[] | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const steps = messages[messageIndex]?.steps ?? [];
    for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
      const todos = steps[stepIndex]?.todos;
      if (todos && todos.length > 0) return todos;
    }
  }
  return null;
}