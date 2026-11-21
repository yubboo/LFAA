// 任务清单条目的归一化：读取历史会话与工具入参共用同一套校验，避免两处规则漂移。
import type { TodoItem, TodoStatus } from "./types";

/** 合法状态集合，供运行时收窄使用。 */
export const TODO_STATUSES: readonly TodoStatus[] = ["pending", "in_progress", "completed"];

/** 判断任意值是否是合法状态。 */
export function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === "string" && (TODO_STATUSES as readonly string[]).includes(value);
}

/**
 * 把磁盘上或模型给的任意值收窄成任务清单。
 * 规则：内容去首尾空白后必须非空；同内容只保留第一条；id 缺省时用内容兜底。
 * 返回 undefined 表示输入不是数组（调用方据此判定“没有清单”而不是“空清单”）。
 */
export function normalizeTodoList(raw: unknown): TodoItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const todos: TodoItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (!content || seen.has(content)) continue;
    seen.add(content);
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : content;
    todos.push({ id, content, status: isTodoStatus(record.status) ? record.status : "pending" });
  }
  return todos;
}