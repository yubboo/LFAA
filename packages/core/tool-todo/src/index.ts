// @lfaa/tool-todo 插件入口：向工具注册表贡献任务清单的写入与读取能力，清单作为会话状态落盘。
import type { Plugin } from "@deepseek-ai/cordis";
import type { TodoItem } from "@lfaa/session";
import "@lfaa/memory";
import "@lfaa/tools";

/** 单条待办的状态取值。 */
export type { TodoItem, TodoStatus } from "@lfaa/session";
/** 兼容旧调用方的状态别名。 */
export { TODO_STATUSES as STATUSES } from "@lfaa/session";

/** 各状态计数，供工具摘要与会话面板复用。 */
export interface TodoCounts {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

/** 统计各状态数量。 */
export function summarize(todos: readonly TodoItem[]): TodoCounts {
  const completed = todos.filter((item) => item.status === "completed").length;
  const inProgress = todos.filter((item) => item.status === "in_progress").length;
  return { total: todos.length, completed, inProgress, pending: todos.length - completed - inProgress };
}

/** 模型入参校验失败时抛出的可读错误，由工具层转成 ok:false 结果。 */
export class TodoInputError extends Error {}

/**
 * 把模型传入的清单校验成规范列表。
 * 规则与 DSH 对齐：内容非空、同内容不可重复、同一时刻最多一条 in_progress；
 * id 缺省时用内容兜底，保证同一条任务跨轮次仍然是同一个标识。
 * 整表替换：返回值就是会话的下一个完整清单，未提及的条目会被丢弃。
 */
export function normalizeIncomingTodos(raw: unknown, allowParallelInProgress = false): TodoItem[] {
  if (!Array.isArray(raw)) throw new TodoInputError("todos 必须是数组。");
  const seen = new Set<string>();
  const todos: TodoItem[] = [];
  let active = 0;
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) throw new TodoInputError("每条任务必须是对象。");
    const record = entry as Record<string, unknown>;
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (!content) throw new TodoInputError("任务内容 content 不能为空。");
    if (seen.has(content)) throw new TodoInputError(`任务内容重复：${content}`);
    seen.add(content);
    const rawStatus = record.status;
    if (rawStatus !== "pending" && rawStatus !== "in_progress" && rawStatus !== "completed") {
      throw new TodoInputError(`任务状态非法：${String(rawStatus)}，只能是 pending / in_progress / completed。`);
    }
    if (rawStatus === "in_progress") active += 1;
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : content;
    todos.push({ id, content, status: rawStatus });
  }
  if (todos.length === 0) throw new TodoInputError("任务清单不能为空。");
  if (!allowParallelInProgress && active > 1) {
    throw new TodoInputError(`同一时刻只能有一条任务处于 in_progress，当前有 ${active} 条。`);
  }
  return todos;
}

/** 待办工具插件：清单写入会话记录，插件卸载不丢数据。 */
const todoPlugin: Plugin.Object<void> = {
  name: "lfaa-tool-todo",
  inject: ["tools", "memory"],
  apply(ctx) {
    ctx.effect(() => {
      const cleanupWrite = ctx.tools.registerTool({
        moduleName: "@lfaa/tool-todo",
        name: "todo_write",
        title: "更新任务清单",
        description: [
          "记录并更新任务清单，用来规划多步任务并展示进度；单步的小任务不需要调用。",
          "开始前先为每个具体步骤建一条任务，之后每次传入完整清单（整表替换，未提及的条目会被删除）。",
          "同一时刻只保留一条 in_progress；每完成一项就立刻把它标成 completed，不要攒到最后统一改。",
        ].join(""),
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              description: "完整任务列表，会替换此前的清单。",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string", description: "任务标识，同一任务的 id 保持不变；缺省时用内容代替。" },
                  content: { type: "string", description: "任务内容，一句简短的祈使句。" },
                  status: { type: "string", enum: ["pending", "in_progress", "completed"], description: "任务状态" },
                },
                required: ["content", "status"],
              },
            },
          },
          required: ["todos"],
        },
        execute: async (args, execCtx) => {
          let todos: TodoItem[];
          try {
            todos = normalizeIncomingTodos(args.todos);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            return { ok: false, output: `任务清单参数无效：${reason}`, summary: "参数无效" };
          }

          const session = await ctx.memory.getSession(execCtx.sessionId);
          if (!session) {
            return { ok: false, output: "找不到当前会话，无法保存任务清单。", summary: "会话不存在" };
          }
          await ctx.memory.updateSession(execCtx.sessionId, { todos });
          const counts = summarize(todos);
          return {
            ok: true,
            output: JSON.stringify({ todos, counts }, null, 2),
            summary: `任务清单已更新：共 ${counts.total} 条（完成 ${counts.completed} / 进行中 ${counts.inProgress} / 待处理 ${counts.pending}）`,
            metadata: { todos, counts },
          };
        },
      });

      const cleanupRead = ctx.tools.registerTool({
        moduleName: "@lfaa/tool-todo",
        name: "todo_read",
        title: "读取任务清单",
        description: "读取当前会话的任务清单与完成进度。",
        permissionLevel: "read",
        parameters: { type: "object", properties: {} },
        execute: async (_args, execCtx) => {
          const session = await ctx.memory.getSession(execCtx.sessionId);
          const todos = session?.todos ?? [];
          const counts = summarize(todos);
          return {
            ok: true,
            output: JSON.stringify({ counts, todos }, null, 2),
            summary: todos.length === 0
              ? "任务清单为空"
              : `共 ${counts.total} 条，完成 ${counts.completed} 条，进行中 ${counts.inProgress} 条`,
            metadata: { todos, counts },
          };
        },
      });

      return () => {
        cleanupWrite();
        cleanupRead();
      };
    });
  },
};

export default todoPlugin;