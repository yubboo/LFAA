// @lfaa/tool-todo 插件入口：向工具注册表贡献待办清单的读取与写入能力，按会话隔离存储。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";

/** 单条待办的状态取值。 */
export type TodoStatus = "pending" | "in_progress" | "completed";

/** 一条待办事项。 */
export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
}

const STATUSES: readonly TodoStatus[] = ["pending", "in_progress", "completed"];

/** 解析模型传入的状态字符串，非法值归为 pending。 */
export function normalizeStatus(raw: unknown): TodoStatus {
  return typeof raw === "string" && (STATUSES as readonly string[]).includes(raw)
    ? (raw as TodoStatus)
    : "pending";
}

/** 合并写入：同 id 覆盖，新项追加，未提及的项保留。 */
export function mergeTodos(current: readonly TodoItem[], incoming: readonly TodoItem[]): TodoItem[] {
  const next = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) next.set(item.id, item);
  return [...next.values()];
}

/** 统计各状态数量，供摘要展示。 */
export function summarize(todos: readonly TodoItem[]): { total: number; completed: number; active: number } {
  const completed = todos.filter((item) => item.status === "completed").length;
  return { total: todos.length, completed, active: todos.length - completed };
}

/** 待办工具插件：内存态按会话保存，插件卸载时清空。 */
const todoPlugin: Plugin.Object<void> = {
  name: "lfaa-tool-todo",
  inject: ["tools"],
  apply(ctx) {
    const store = new Map<string, TodoItem[]>();

    ctx.effect(() => {
      const cleanupWrite = ctx.tools.registerTool({
        name: "todo_write",
        title: "更新任务清单",
        description: "创建或更新当前会话的任务清单。传入完整列表，同 id 覆盖、新 id 追加。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              description: "任务列表",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "任务标识，同 id 视为同一条" },
                  content: { type: "string", description: "任务内容" },
                  status: { type: "string", enum: [...STATUSES], description: "任务状态" },
                },
                required: ["id", "content"],
              },
            },
          },
          required: ["todos"],
        },
        execute: async (args, execCtx) => {
          const raw = Array.isArray(args.todos) ? args.todos : [];
          const incoming: TodoItem[] = raw.map((entry: unknown) => {
            const record = (entry ?? {}) as Record<string, unknown>;
            return {
              id: String(record.id ?? ""),
              content: String(record.content ?? ""),
              status: normalizeStatus(record.status),
            };
          }).filter((item) => item.id.length > 0 && item.content.length > 0);

          if (incoming.length === 0) {
            return { ok: false, output: "任务清单不能为空，且每项都需要 id 与 content。", summary: "参数无效" };
          }

          const merged = mergeTodos(store.get(execCtx.sessionId) ?? [], incoming);
          store.set(execCtx.sessionId, merged);
          const stats = summarize(merged);
          return {
            ok: true,
            output: JSON.stringify(merged, null, 2),
            summary: `任务清单已更新：共 ${stats.total} 条，完成 ${stats.completed} 条`,
          };
        },
      });

      const cleanupRead = ctx.tools.registerTool({
        name: "todo_read",
        title: "读取任务清单",
        description: "读取当前会话的任务清单与完成进度。",
        permissionLevel: "read",
        parameters: { type: "object", properties: {} },
        execute: async (_args, execCtx) => {
          const todos = store.get(execCtx.sessionId) ?? [];
          const stats = summarize(todos);
          return {
            ok: true,
            output: JSON.stringify({ stats, todos }, null, 2),
            summary: todos.length === 0
              ? "任务清单为空"
              : `共 ${stats.total} 条，完成 ${stats.completed} 条，进行中 ${stats.active} 条`,
          };
        },
      });

      return () => {
        cleanupWrite();
        cleanupRead();
        store.clear();
      };
    });
  },
};

export default todoPlugin;