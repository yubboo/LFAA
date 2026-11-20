// @lfaa/subagent Host 侧 Cordis 服务：注册多 Agent 协作工具并托管隔离子运行生命周期。
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/llm";
import "@lfaa/memory";
import "@lfaa/rules";
import "@lfaa/tools";
import { SubagentCoordinator } from "./subagent-service";
import type { InvokeSubagentInput, SubagentPluginConfig, SubagentSummaryItem } from "./types";

export * from "./types";
export { createSubagentHttpHandler } from "./http-handler";

/** Host 侧子智能体协作服务，挂载于 Cordis `subagent` 属性。 */
export class SubagentService extends Service {
  static inject = ["llm", "tools", "memory", "rules"];

  private readonly coordinator: SubagentCoordinator;
  private unregisterTools: (() => void) | null = null;

  constructor(ctx: Context, config: SubagentPluginConfig = {}) {
    super(ctx, "subagent");
    this.coordinator = new SubagentCoordinator(ctx, config);
    this.unregisterTools = this.registerAgentTools();
    ctx.effect(() => () => {
      this.unregisterTools?.();
      this.unregisterTools = null;
      this.coordinator.disposeAll();
    });
  }

  private registerAgentTools(): () => void {
    const cleanups = [
      this.ctx.tools.registerTool({
        moduleName: "@lfaa/subagent",
        name: "invoke_subagent",
        title: "派发子智能体",
        description: "创建一个独立隔离的子智能体执行子任务（支持只读调研或写入修改，设 wait=false 可并发派发多个后用 list_subagents 回收）。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            role: { type: "string", description: "子智能体角色名称，如 Code Researcher / Browser Verifier" },
            prompt: { type: "string", description: "清晰具体的任务目标与交付要求" },
            mode: { type: "string", enum: ["read", "write"], description: "read 仅只读探索（默认），write 允许读写与命令" },
            wait: { type: "boolean", description: "是否阻塞等待完成后返回，默认 true；并行派发时设为 false" },
          },
          required: ["role", "prompt"],
        },
        execute: async (args, execCtx) => {
          const item = await this.coordinator.invoke({
            sessionId: execCtx.sessionId,
            role: typeof args.role === "string" ? args.role : "子助手",
            prompt: typeof args.prompt === "string" ? args.prompt : "",
            mode: args.mode === "write" ? "write" : "read",
            workspaceRoots: execCtx.workspaceRoots,
            parentSignal: execCtx.signal,
            onSubagentActivity: execCtx.onSubagentActivity,
            parentRunId: execCtx.runId,
            parentProfileId: execCtx.parentProfileId,
            ...(execCtx.allowsTool ? { allowsTool: execCtx.allowsTool } : {}),
            ...(execCtx.parentApproval ? { parentApproval: execCtx.parentApproval } : {}),
            wait: args.wait !== false,
          });
          return {
            ok: item.status === "running" || item.status === "done",
            output: JSON.stringify({
              subagentId: item.id,
              role: item.role,
              status: item.status,
              output: item.output,
              ...(item.error ? { error: item.error } : {}),
            }, null, 2),
            summary: `${item.role} (${item.status})`,
          };
        },
      }),
      this.ctx.tools.registerTool({
        moduleName: "@lfaa/subagent",
        name: "message_subagent",
        title: "向子智能体发送后续指令",
        description: "延续既有子智能体的上下文继续提问或下达补充任务。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            subagentId: { type: "string", description: "子智能体 ID" },
            message: { type: "string", description: "补充任务说明" },
            wait: { type: "boolean", description: "是否等待回复，默认 true" },
          },
          required: ["subagentId", "message"],
        },
        execute: async (args, execCtx) => {
          const id = typeof args.subagentId === "string" ? args.subagentId.trim() : "";
          const msg = typeof args.message === "string" ? args.message : "";
          const item = await this.coordinator.message(id, execCtx.sessionId, msg, args.wait !== false, execCtx);
          return {
            ok: item.status !== "error",
            output: JSON.stringify({ subagentId: item.id, status: item.status, output: item.output }, null, 2),
            summary: `已协作 ${item.role}`,
          };
        },
      }),
      this.ctx.tools.registerTool({
        moduleName: "@lfaa/subagent",
        name: "list_subagents",
        title: "查询或等待子智能体",
        description: "列出当前会话派发的所有子智能体状态；传入 waitForIds 可阻塞等待指定并发子智能体全部完成并汇总结果。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            waitForIds: { type: "array", items: { type: "string" }, description: "可选：等待完成的 subagentId 列表" },
          },
        },
        execute: async (args, execCtx) => {
          const waitForIds = Array.isArray(args.waitForIds)
            ? args.waitForIds.filter((id): id is string => typeof id === "string")
            : [];
          const items = waitForIds.length > 0
            ? await this.coordinator.waitFor(waitForIds, execCtx.sessionId)
            : this.coordinator.list(execCtx.sessionId);
          return {
            ok: true,
            output: JSON.stringify(items.map(({ steps: _s, ...summary }) => summary), null, 2),
            summary: `共 ${items.length} 个子智能体`,
          };
        },
      }),
      this.ctx.tools.registerTool({
        moduleName: "@lfaa/subagent",
        name: "stop_subagent",
        title: "停止子智能体",
        description: "中止当前会话指定的运行中子智能体。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: { subagentId: { type: "string", description: "要中止的子智能体 ID" } },
          required: ["subagentId"],
        },
        execute: async (args, execCtx) => {
          const id = typeof args.subagentId === "string" ? args.subagentId.trim() : "";
          const item = this.coordinator.stop(id, execCtx.sessionId);
          if (!item) return { ok: false, output: `找不到子智能体：${id}`, summary: "不存在" };
          return { ok: true, output: JSON.stringify({ subagentId: item.id, status: item.status }), summary: `已停止 ${item.role}` };
        },
      }),
    ];
    return () => {
      for (const off of cleanups) off();
    };
  }

  protected stop(): void {
    this.unregisterTools?.();
    this.unregisterTools = null;
    this.coordinator.disposeAll();
  }

  invokeSubagent(input: InvokeSubagentInput): Promise<SubagentSummaryItem> {
    return this.coordinator.invoke(input);
  }

  getSubagent(id: string, sessionId?: string): SubagentSummaryItem | null {
    return this.coordinator.get(id, sessionId);
  }

  listSubagents(sessionId?: string): SubagentSummaryItem[] {
    return this.coordinator.list(sessionId);
  }

  stopSubagent(id: string, sessionId?: string): SubagentSummaryItem | null {
    return this.coordinator.stop(id, sessionId);
  }
}

export function subagentPlugin(ctx: Context, config: SubagentPluginConfig = {}): void {
  new SubagentService(ctx, config);
}

subagentPlugin.inject = ["llm", "tools", "memory", "rules"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    subagent: SubagentService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default subagentPlugin;
