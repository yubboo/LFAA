// @lfaa/crew Host 侧 Cordis 服务：注册 run_crew 工具，把任务图交给串行执行器并汇总交付。
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/memory";
import "@lfaa/subagent";
import "@lfaa/tools";
import type { SubagentService, SubagentSummaryItem } from "@lfaa/subagent";
import type { ToolExecutionContext } from "@lfaa/tools";
import { runCrew } from "./crew-runner";
import { checkTaskGraph } from "./task-graph";
import type { CrewRunSpec, CrewTaskSpec } from "./types";

export * from "./types";
export { buildGuardrail, checkDelivery } from "./guardrail";
export { checkTaskGraph, orderTasks } from "./task-graph";
export { runCrew } from "./crew-runner";

/** 单任务步数上限，防止模型在任务里无限打转。 */
const MAX_TASK_STEPS = 40;

/** 把工具参数里的任务数组收敛成契约类型，非法字段在任务图校验阶段报错。 */
function normalizeTasks(raw: unknown): CrewTaskSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id.trim() : "",
      ...(typeof item.title === "string" ? { title: item.title.trim() } : {}),
      description: typeof item.description === "string" ? item.description : "",
      expectedOutput: typeof item.expectedOutput === "string" ? item.expectedOutput : "",
      ...(Array.isArray(item.dependsOn)
        ? { dependsOn: item.dependsOn.filter((value): value is string => typeof value === "string") }
        : {}),
      ...(typeof item.maxSteps === "number" && Number.isFinite(item.maxSteps)
        ? { maxSteps: Math.min(MAX_TASK_STEPS, Math.max(1, Math.round(item.maxSteps))) }
        : {}),
    }));
}

/** 把执行结果压成父 Agent 可读的摘要 + 最终交付。 */
function formatRunOutput(result: Awaited<ReturnType<typeof runCrew>>): string {
  const lines = result.tasks.map((task) => {
    const reason = task.validation.ok ? "" : `（${task.validation.reason ?? "未通过验收"}）`;
    return `- [${task.status}] ${task.taskId} ${task.title}${reason}`;
  });
  return [
    `任务流水线 ${result.runId}：${result.ok ? "全部完成" : "存在失败或跳过"}`,
    ...lines,
    "",
    "最终交付：",
    result.finalOutput || "（没有可交付内容）",
  ].join("\n");
}

/** Host 侧任务编排服务，挂载于 Cordis `crew` 属性。 */
export class CrewService extends Service {
  static inject = ["tools", "memory"];

  private unregisterTools: (() => void) | null = null;

  constructor(ctx: Context) {
    super(ctx, "crew");
    this.unregisterTools = this.registerTool();
    ctx.effect(() => () => {
      this.unregisterTools?.();
      this.unregisterTools = null;
    });
  }

  /** 取子智能体服务；它属于可选模块，未装配时给出可读错误而不是启动期崩溃。 */
  private resolveSubagent(): SubagentService | undefined {
    return (this.ctx as { get?: (name: string) => unknown }).get?.("subagent") as SubagentService | undefined;
  }

  /** 用同一个子智能体执行路径跑一个任务，只读、不递归派发。 */
  private async runTask(
    subagent: SubagentService,
    execCtx: ToolExecutionContext,
    invocation: { taskId: string; role: string; prompt: string; maxSteps: number },
  ): Promise<{ subagentId?: string; output: string }> {
    const item: SubagentSummaryItem = await subagent.invoke({
      sessionId: execCtx.sessionId,
      role: invocation.role,
      prompt: invocation.prompt,
      kind: "general",
      mode: "read",
      workspaceRoots: execCtx.workspaceRoots,
      maxSteps: invocation.maxSteps,
      parentRunId: execCtx.runId,
      ...(execCtx.parentProfileId ? { parentProfileId: execCtx.parentProfileId } : {}),
      ...(execCtx.signal ? { parentSignal: execCtx.signal } : {}),
      ...(execCtx.allowsTool ? { allowsTool: execCtx.allowsTool } : {}),
      ...(execCtx.onSubagentActivity ? { onSubagentActivity: execCtx.onSubagentActivity } : {}),
    });
    if (item.status !== "done") {
      throw new Error(item.error ?? `子任务 ${invocation.taskId} 未完成（状态 ${item.status}）`);
    }
    return { subagentId: item.id, output: item.output };
  }

  private registerTool(): () => void {
    return this.ctx.tools.registerTool({
      moduleName: "@lfaa/crew",
      name: "run_crew",
      title: "多智能体任务流水线",
      description: "把一个目标拆成有依赖的任务，按顺序交给多个只读子智能体接力完成：上游交付通过验收后才会作为下游输入，最后一个任务的交付物就是最终结果。适合调研→撰写→核对这类必须接力的工作；讨论和头脑风暴仍用群聊。验收规则是字面匹配：expectedOutput 里的「必须包含：X」要求 X 原样出现在交付文字中，不要写「类型名称」这类元描述，要写期望真实出现的词。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string", description: "整条流水线要达成的用户目标" },
          tasks: {
            type: "array",
            description: "任务列表，最多 6 个；每个任务只做一件事",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "任务唯一 id，如 research / draft / review" },
                title: { type: "string", description: "展示名，工作台标签会用它" },
                description: { type: "string", description: "怎么做：本任务的过程与范围" },
                expectedOutput: { type: "string", description: "交付什么：格式与具体内容。写「必须包含：X」时 X 按字面匹配，必须是期望文字里真实出现的词；需要长度下限写「不少于 N 字」；需要 JSON 时写明 JSON" },
                dependsOn: { type: "array", items: { type: "string" }, description: "依赖的上游任务 id" },
                maxSteps: { type: "number", description: "本任务步数上限，默认 20，最大 40" },
              },
              required: ["id", "description", "expectedOutput"],
            },
          },
        },
        required: ["goal", "tasks"],
      },
      execute: async (args, execCtx) => {
        const goal = typeof args.goal === "string" ? args.goal.trim() : "";
        if (!goal) return { ok: false, output: "缺少 crew 目标。", summary: "参数缺失" };
        const tasks = normalizeTasks(args.tasks);
        const spec: CrewRunSpec = { goal, tasks };
        const check = checkTaskGraph(tasks);
        if (!check.ok) {
          return { ok: false, output: `任务图不合法：${check.issues.join("；")}`, summary: "任务图校验失败" };
        }
        const subagent = this.resolveSubagent();
        if (!subagent) {
          return { ok: false, output: "当前模式未装配子智能体服务，无法执行任务流水线。", summary: "缺少子智能体服务" };
        }
        const result = await runCrew({
          memory: this.ctx.memory,
          sessionId: execCtx.sessionId,
          runTask: (invocation) => this.runTask(subagent, execCtx, invocation),
          ...(execCtx.signal ? { signal: execCtx.signal } : {}),
        }, spec);
        return {
          ok: result.ok,
          output: formatRunOutput(result),
          summary: result.ok ? `流水线完成 ${result.tasks.length} 个任务` : "流水线存在失败任务",
          metadata: {
            crewRunId: result.runId,
            tasks: result.tasks.map((task) => ({
              id: task.taskId,
              status: task.status,
              subagentId: task.subagentId,
            })),
          },
        };
      },
    });
  }
}

/** 注册任务编排服务。 */
export function crewPlugin(context: Context): void {
  new CrewService(context);
}

// Cordis 按插件声明的 inject 等待依赖就绪后再构建服务，漏写会在访问 ctx.tools 时直接报错。
crewPlugin.inject = ["tools", "memory"] as const;

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default crewPlugin;