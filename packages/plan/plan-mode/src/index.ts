// @lfaa/plan-mode：计划模式。开启后写/执行类工具被中间件拦截，只留下只读探查，先给计划再动手。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { ToolPermissionLevel } from "@lfaa/tools";

/** 被拦截的工具权限级别，默认写与执行。 */
export type BlockedLevel = Extract<ToolPermissionLevel, "write" | "exec">;

/** 计划模式配置。 */
export interface PlanModeConfig {
  blockedLevels?: BlockedLevel[];
}

/** 会话的计划意图：进入时记下目标，退出后清空。 */
export interface PlanIntent {
  objective: string;
  enteredAt: number;
}

const DEFAULT_BLOCKED: BlockedLevel[] = ["write", "exec"];

/** 计划模式服务：按会话记录是否处于计划模式与进入意图。 */
export class PlanModeService {
  private readonly intents = new Map<string, PlanIntent>();

  enter(sessionId: string, objective = ""): PlanIntent {
    const intent: PlanIntent = { objective: objective.trim(), enteredAt: Date.now() };
    this.intents.set(sessionId, intent);
    return intent;
  }

  exit(sessionId: string): PlanIntent | undefined {
    const intent = this.intents.get(sessionId);
    this.intents.delete(sessionId);
    return intent;
  }

  isPlanning(sessionId: string): boolean {
    return this.intents.has(sessionId);
  }

  getIntent(sessionId: string): PlanIntent | undefined {
    return this.intents.get(sessionId);
  }

  listSessions(): string[] {
    return [...this.intents.keys()];
  }

  clear(): void {
    this.intents.clear();
  }
}

/** 计划模式下的统一拦截文案：告诉模型怎么退出，而不是让它反复重试同一工具。 */
export function blockedMessage(toolName: string, objective = ""): string {
  const target = objective ? `（计划目标：${objective}）` : "";
  return `当前处于计划模式${target}，工具 ${toolName} 属于写/执行类，已被拦截。请先输出完整计划，再调用 plan_mode_exit 退出计划模式后执行。`;
}

const STATUS_TOOL = {
  name: "plan_mode_status",
  title: "查看计划模式",
  description: "查看当前会话是否处于计划模式，以及进入时记录的目标。",
  permissionLevel: "read" as const,
  parameters: { type: "object" as const, properties: {} },
};

/** 安装计划模式：中间件 + 三个只读工具；返回服务以便测试断言。 */
export function installPlanMode(ctx: Context, config: PlanModeConfig = {}): PlanModeService {
  const service = new PlanModeService();
  const blocked = new Set(config.blockedLevels ?? DEFAULT_BLOCKED);

  ctx.effect(() => () => service.clear());
  ctx.effect(() => ctx.tools.useToolMiddleware({
    id: "@lfaa/plan-mode",
    aroundExecute: (next, info) => {
      if (!service.isPlanning(info.context.sessionId)) return next();
      const level = ctx.tools.getTool(info.name)?.permissionLevel ?? "read";
      if (!blocked.has(level as BlockedLevel)) return next();
      return Promise.resolve({
        ok: false,
        output: blockedMessage(info.name, service.getIntent(info.context.sessionId)?.objective ?? ""),
        summary: "计划模式拦截",
        metadata: { planModeBlocked: true, tool: info.name },
      });
    },
  }));

  ctx.effect(() => {
    const disposers = [
      ctx.tools.registerTool({
        moduleName: "@lfaa/plan-mode",
        name: "plan_mode_enter",
        title: "进入计划模式",
        description: "进入计划模式：接下来只允许只读工具，写文件和执行命令都会被拦截。先给出完整计划，再用 plan_mode_exit 退出。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            objective: { type: "string", description: "本次计划要达成的目标（一句话）" },
          },
        },
        execute: async (args, execCtx) => {
          const intent = service.enter(execCtx.sessionId, typeof args.objective === "string" ? args.objective : "");
          return {
            ok: true,
            output: `已进入计划模式${intent.objective ? `：${intent.objective}` : ""}。现在只能使用只读工具；给出计划后调用 plan_mode_exit 退出。`,
            summary: "进入计划模式",
            metadata: { planMode: true },
          };
        },
      }),
      ctx.tools.registerTool({
        moduleName: "@lfaa/plan-mode",
        name: "plan_mode_exit",
        title: "退出计划模式",
        description: "退出计划模式，恢复写与执行类工具。提交计划后用这个结束计划阶段。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: { plan: { type: "string", description: "最终计划摘要，便于后续对照执行" } },
        },
        execute: async (args, execCtx) => {
          const intent = service.exit(execCtx.sessionId);
          const plan = typeof args.plan === "string" ? args.plan.trim() : "";
          return {
            ok: true,
            output: `已退出计划模式。${plan ? `计划：${plan}` : intent?.objective ? `计划目标：${intent.objective}` : ""}现在可以执行写与命令工具。`,
            summary: "退出计划模式",
            metadata: { planMode: false },
          };
        },
      }),
      ctx.tools.registerTool({
        moduleName: "@lfaa/plan-mode",
        ...STATUS_TOOL,
        execute: async (_args, execCtx) => {
          const intent = service.getIntent(execCtx.sessionId);
          if (!intent) return { ok: true, output: "当前不在计划模式。", summary: "计划模式：关闭" };
          return {
            ok: true,
            output: `当前处于计划模式${intent.objective ? `，目标：${intent.objective}` : ""}（进入于 ${new Date(intent.enteredAt).toLocaleString("zh-CN")}）。`,
            summary: "计划模式：开启",
          };
        },
      }),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  });

  return service;
}

const planModeCore: Plugin.Object<PlanModeConfig> = {
  name: "lfaa-plan-mode",
  inject: ["tools"],
  apply(ctx, config) {
    installPlanMode(ctx, config ?? {});
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default planModeCore;