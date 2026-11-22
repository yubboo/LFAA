// @lfaa/tool-goal：把目标服务包装成模型可调用的目标工具（新建 / 更新 / 查看）。
import type { Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";

/** 工具结果里的目标摘要，避免把整条日志塞回上下文。 */
export function formatGoalLine(goal: {
  id: string;
  title: string;
  status: string;
  progress: { done: number; total: number };
}): string {
  const progress = goal.progress.total > 0 ? `${goal.progress.done}/${goal.progress.total}` : "未设进度";
  return `${goal.id} · [${goal.status}] ${goal.title}（${progress}）`;
}

/** 只保留最近几条进展，控制回给模型的体积。 */
export function recentNotes(notes: ReadonlyArray<{ at: number; note: string }>, limit = 5): string[] {
  return notes.slice(-Math.max(1, limit)).map((entry) => entry.note);
}

/** 把参数里的数字字段转成有限数值，非法值返回 undefined。 */
export function toCount(raw: unknown): number | undefined {
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

const toolGoalPlugin: Plugin.Object<void> = {
  name: "lfaa-tool-goal",
  inject: ["goal", "tools"],
  apply(ctx) {
    ctx.effect(() => {
      const disposeCreate = ctx.tools.registerTool({
        moduleName: "@lfaa/goal",
        name: "goal_create",
        title: "新建目标",
        description: "为本次长任务登记一个目标。后续用 goal_update 记录进展，完成后把状态改为 complete。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "简短目标名" },
            objective: { type: "string", description: "可验收的完成条件" },
            total: { type: "number", description: "可选的步骤总数" },
          },
          required: ["title", "objective"],
        },
        execute: async (args, execCtx) => {
          const total = toCount(args.total);
          const goal = await ctx.goal.create({
            title: String(args.title ?? ""),
            objective: String(args.objective ?? ""),
            sessionId: execCtx.sessionId,
            ...(total !== undefined ? { total } : {}),
          });
          return { ok: true, output: formatGoalLine(goal), summary: `已登记目标：${goal.title}` };
        },
      });

      const disposeUpdate = ctx.tools.registerTool({
        moduleName: "@lfaa/goal",
        name: "goal_update",
        title: "更新目标进展",
        description: "记录目标进展或改变状态。status 取 active / complete / blocked；受阻时用 note 写清卡在哪。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "目标 id（来自 goal_create 或 goal_list）" },
            status: { type: "string", enum: ["active", "complete", "blocked"] },
            note: { type: "string", description: "本次进展或受阻原因" },
            done: { type: "number", description: "已完成步骤数" },
            total: { type: "number", description: "步骤总数（需要修正时填）" },
          },
          required: ["id"],
        },
        execute: async (args) => {
          const done = toCount(args.done);
          const total = toCount(args.total);
          const goal = await ctx.goal.update(String(args.id ?? ""), {
            ...(typeof args.status === "string" ? { status: args.status as "active" | "complete" | "blocked" } : {}),
            ...(typeof args.note === "string" ? { note: args.note } : {}),
            ...(done !== undefined ? { done } : {}),
            ...(total !== undefined ? { total } : {}),
          });
          const notes = recentNotes(goal.log);
          return {
            ok: true,
            output: [formatGoalLine(goal), ...notes.map((note) => `· ${note}`)].join("\n"),
            summary: `目标已更新：${goal.title}`,
          };
        },
      });

      const disposeList = ctx.tools.registerTool({
        moduleName: "@lfaa/goal",
        name: "goal_list",
        title: "查看目标",
        description: "列出当前会话的目标与状态，用于继续未完成的长任务。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            includeCompleted: { type: "boolean", description: "是否包含已完成目标，默认 false" },
          },
        },
        execute: async (args, execCtx) => {
          const includeCompleted = args.includeCompleted === true;
          const goals = (await ctx.goal.list({ sessionId: execCtx.sessionId }))
            .filter((goal) => includeCompleted || goal.status !== "complete");
          if (goals.length === 0) {
            return { ok: true, output: "当前会话没有进行中的目标。", summary: "没有目标" };
          }
          return {
            ok: true,
            output: goals.map((goal) => formatGoalLine(goal)).join("\n"),
            summary: `${goals.length} 个目标`,
          };
        },
      });

      return () => {
        disposeCreate();
        disposeUpdate();
        disposeList();
      };
    });
  },
};

export default toolGoalPlugin;
export { toolGoalPlugin };