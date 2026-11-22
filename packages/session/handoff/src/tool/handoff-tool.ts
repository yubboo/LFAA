// @lfaa/tool-handoff：把交接服务包装成模型可调用的交接工具（创建 / 查看 / 接手 / 取消）。
import type { Plugin } from "@deepseek-ai/cordis";
import "@lfaa/goal";
import "@lfaa/memory";
import "@lfaa/tools";
import type { HandoffItem } from "../service";
import { buildHandoffObjective } from "../service";

/** 一行交接摘要，控制回给模型的体积。 */
export function formatHandoffLine(item: Pick<HandoffItem, "id" | "status" | "title" | "toSessionId" | "fromSessionId">): string {
  const target = item.toSessionId ? `→ ${item.toSessionId}` : "广播到同项目";
  return `${item.id} · [${item.status}] ${item.title} · 来自 ${item.fromSessionId} ${target}`;
}

const toolHandoffPlugin: Plugin.Object<void> = {
  name: "lfaa-tool-handoff",
  inject: ["handoff", "tools", "memory", "goal"],
  apply(ctx) {
    ctx.effect(() => {
      const offCreate = ctx.tools.registerTool({
        moduleName: "@lfaa/handoff",
        name: "handoff_create",
        title: "创建会话交接",
        description: "把一个长任务的摘要、下一步与目标交给另一个会话。可选 toSessionId 指定唯一接收方，缺省为同项目广播。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "交接标题" },
            summary: { type: "string", description: "已完成什么、当前卡点与注意事项" },
            nextSteps: { type: "array", items: { type: "string" }, description: "接手方要做的下一步（可选）" },
            toSessionId: { type: "string", description: "指定接收会话 id（可选，缺省为广播）" },
          },
          required: ["title", "summary"],
        },
        execute: async (args, execCtx) => {
          const session = await ctx.memory.getSession(execCtx.sessionId);
          if (!session) return { ok: false, output: "找不到当前会话。", summary: "当前会话不存在" };
          const nextSteps = Array.isArray(args.nextSteps)
            ? args.nextSteps.filter((step): step is string => typeof step === "string")
            : [];
          const item = await ctx.handoff.create({
            fromSessionId: execCtx.sessionId,
            projectId: session.projectId ?? null,
            title: String(args.title ?? ""),
            summary: String(args.summary ?? ""),
            ...(nextSteps.length > 0 ? { nextSteps } : {}),
            ...(typeof args.toSessionId === "string" && args.toSessionId.trim() ? { toSessionId: args.toSessionId.trim() } : {}),
          });
          return {
            ok: true,
            output: `${formatHandoffLine(item)}\n下一步：${item.nextSteps.join("；") || "（未填）"}`,
            summary: `已创建交接：${item.title}`,
          };
        },
      });

      const offList = ctx.tools.registerTool({
        moduleName: "@lfaa/handoff",
        name: "handoff_list",
        title: "查看待处理交接",
        description: "列出当前会话的待处理交接（默认收件），用于判断是否有任务要接手或跟进。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["incoming", "outgoing", "all"], description: "收件 / 发件 / 全部，默认 incoming" },
          },
        },
        execute: async (args, execCtx) => {
          const session = await ctx.memory.getSession(execCtx.sessionId);
          if (!session) return { ok: false, output: "找不到当前会话。", summary: "当前会话不存在" };
          const direction = args.direction === "outgoing" || args.direction === "all" ? args.direction : "incoming";
          const items = await ctx.handoff.list({
            sessionId: execCtx.sessionId,
            direction,
            status: "pending",
            projectId: session.projectId ?? null,
          });
          if (items.length === 0) {
            return { ok: true, output: "没有待处理的交接。", summary: "没有交接" };
          }
          return {
            ok: true,
            output: items.map((item) => `${formatHandoffLine(item)} · ${item.summary.slice(0, 120)}`).join("\n"),
            summary: `${items.length} 条待处理交接`,
          };
        },
      });

      const offAccept = ctx.tools.registerTool({
        moduleName: "@lfaa/handoff",
        name: "handoff_accept",
        title: "接手会话交接",
        description: "接手一条同一项目的待处理交接：创建同目标 goal 并标记交接已接受，随后由目标自动续跑。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "交接 id（来自 handoff_list）" },
          },
          required: ["id"],
        },
        execute: async (args, execCtx) => {
          const session = await ctx.memory.getSession(execCtx.sessionId);
          if (!session) return { ok: false, output: "找不到当前会话。", summary: "当前会话不存在" };
          const id = typeof args.id === "string" ? args.id.trim() : "";
          const item = id ? await ctx.handoff.get(id) : undefined;
          if (!item) return { ok: false, output: "找不到这条交接。", summary: "交接不存在" };
          if ((item.projectId ?? null) !== (session.projectId ?? null)) {
            return { ok: false, output: "只能接手同一项目的交接。", summary: "跨项目接手被拒绝" };
          }
          if (item.toSessionId && item.toSessionId !== execCtx.sessionId) {
            return { ok: false, output: "这条交接指定了其他会话接手。", summary: "目标会话不匹配" };
          }
          if (item.fromSessionId === execCtx.sessionId) {
            return { ok: false, output: "不能接手自己发出的交接。", summary: "来源会话不匹配" };
          }
          const objective = buildHandoffObjective(item);
          const goal = await ctx.goal.create({
            title: item.title,
            objective,
            sessionId: execCtx.sessionId,
            maxRounds: 10,
          });
          try {
            const accepted = await ctx.handoff.accept(id, execCtx.sessionId, goal.id);
            return {
              ok: true,
              output: `已接手「${accepted.title}」，已创建目标（id=${goal.id}）。发送任意消息或等待自动续跑即可继续。`,
              summary: `已接手交接：${accepted.title}`,
            };
          } catch (error) {
            await ctx.goal.remove(goal.id).catch(() => undefined);
            throw error;
          }
        },
      });

      const offCancel = ctx.tools.registerTool({
        moduleName: "@lfaa/handoff",
        name: "handoff_cancel",
        title: "取消会话交接",
        description: "发送方取消一条待处理交接，或指定接收方拒绝它。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "交接 id" },
          },
          required: ["id"],
        },
        execute: async (args, execCtx) => {
          const id = typeof args.id === "string" ? args.id.trim() : "";
          if (!id) return { ok: false, output: "缺少交接 id。", summary: "参数缺失" };
          const item = await ctx.handoff.cancel(id, execCtx.sessionId);
          return { ok: true, output: `已取消交接：${item.title}`, summary: `已取消：${item.title}` };
        },
      });

      return () => {
        offCancel();
        offAccept();
        offList();
        offCreate();
      };
    });
  },
};

export default toolHandoffPlugin;
export { toolHandoffPlugin };