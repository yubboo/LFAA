/**
 * 文件：tools.ts
 * 功能：把定时任务能力注册为模型可见的 AiBusinessTool（创建/列出/删除/更新）。
 * 作用：模型在 Agent Run 中可以主动调用 schedule_create / schedule_list / schedule_delete /
 *       schedule_update，把“到点提醒/周期任务”作为可选用能力，而不是硬编码流水线。
 * 边界：ownerId 取自当前 Run 的真实 userId（不可被模型参数伪造）；工具只操作当前用户的任务。
 * 关联文件：packages/core/tools/src/business-tools.ts（AiBusinessTool 合同）、domain.ts、store.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/schedule/schedule/src/tools.ts 的四个工具语义。
 */
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
// 说明：ctx.lfaaTools.registerTool 的类型由 lfaa-tools 既有全局声明提供（tool-ask-user 等已增强），
// 本包不再重复声明 lfaaTools，避免与既有增强冲突。
import {
  MAX_TITLE_LENGTH,
  normalizePrompt,
  normalizeTitle,
  ruleFromSelector,
  toToolError,
  viewFromTask
} from "./domain.js";
import {
  applyUpdateTask
} from "./update.js";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks
} from "./store.js";
import type { ScheduleView } from "./types.js";
import { bindScheduleTarget } from "./targets.js";

/** 解析模型传入的计时选择器子集（create/update 共用）。 */
function parseSelectors(args: Record<string, unknown>): {
  afterSeconds?: number;
  atMs?: number;
  everySeconds?: number;
  daily?: { time: string; timeZone: string };
  weekly?: { time: string; weekdays: number[]; timeZone: string };
  cron?: { expression: string; timeZone: string };
} {
  const out: ReturnType<typeof parseSelectors> = {};
  if (typeof args.after_seconds === "number") out.afterSeconds = args.after_seconds;
  if (typeof args.at_ms === "number") out.atMs = args.at_ms;
  if (typeof args.every_seconds === "number") out.everySeconds = args.every_seconds;
  if (isObject(args.daily)) {
    out.daily = { time: String(args.daily.time ?? ""), timeZone: String(args.daily.time_zone ?? "") };
  }
  if (isObject(args.weekly)) {
    out.weekly = {
      time: String(args.weekly.time ?? ""),
      timeZone: String(args.weekly.time_zone ?? ""),
      weekdays: Array.isArray(args.weekly.weekdays) ? args.weekly.weekdays.filter((d): d is number => typeof d === "number") : []
    };
  }
  if (isObject(args.cron)) {
    out.cron = { expression: String(args.cron.expression ?? ""), timeZone: String(args.cron.time_zone ?? "") };
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownerOf(ctx: Parameters<AiBusinessTool["execute"]>[1]): string {
  return ctx.userId;
}

const createTool: AiBusinessTool = {
  id: "schedule.create",
  name: "schedule_create",
  description: "在当前用户下创建一个到点提醒或周期任务，到点时由系统把 prompt 交付给会话。必须且只能提供一种计时：after_seconds（秒后）、at_ms（绝对时刻毫秒）、every_seconds（≥60 秒的固定周期）、daily（每天 HH:mm，带 time_zone）、weekly（每周星期几的 HH:mm）或 cron（五字段 cron + time_zone）。到点将在当前会话按当时账户权限和创建时的工具范围实际运行 prompt；仅在用户要求定时任务时创建。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      title: { type: "string", maxLength: MAX_TITLE_LENGTH },
      prompt: { type: "string" },
      after_seconds: { type: "number" },
      at_ms: { type: "number" },
      every_seconds: { type: "number" },
      daily: {
        type: "object",
        properties: { time: { type: "string" }, time_zone: { type: "string" } },
        additionalProperties: false
      },
      weekly: {
        type: "object",
        properties: {
          time: { type: "string" },
          time_zone: { type: "string" },
          weekdays: { type: "array", items: { type: "integer" } }
        },
        additionalProperties: false
      },
      cron: {
        type: "object",
        properties: { expression: { type: "string" }, time_zone: { type: "string" } },
        additionalProperties: false
      }
    },
    required: ["title", "prompt"],
    additionalProperties: false
  },
  risk: () => "write",
  approval: () => ({ scopeKey: "schedule:create", scopeSummary: "定时任务", summary: "创建定时运行（绑定当前会话和工具范围）" }),
  parse(value) {
    if (!isObject(value)) throw new Error("参数必须是对象。");
    return value;
  },
  async execute(parameters, context) {
    try {
      const title = normalizeTitle(String(parameters.title ?? ""));
      const prompt = normalizePrompt(String(parameters.prompt ?? ""));
      const rule = ruleFromSelector(parseSelectors(parameters), Date.now());
      if (!context.sessionId) throw new Error("当前 Run 缺少可交付的会话身份。");
      const task = createTask({ ownerId: ownerOf(context), title, prompt, rule });
      try { bindScheduleTarget(task.id, { userId: context.userId, appId: context.applicationId, sessionId: context.sessionId, allowedToolNames: [...(context.allowedToolNames ?? [])] }); }
      catch (error) { deleteTask(task.id); throw error; }
      context.signal.throwIfAborted();
      // 工具写入后唤醒唯一调度器，不等待旧计时器或引入第二个扫描器。
      context.onProgress("定时任务已绑定当前会话，按当前账户权限到点运行。");
      return viewFromTask(task, Date.now());
    } catch (error) {
      return toToolError(error);
    }
  }
};

const listTool: AiBusinessTool = {
  id: "schedule.list",
  name: "schedule_list",
  description: "列出当前用户的活动定时任务（到点提醒/周期任务），返回 id、标题、内容与下次触发时刻。",
  applicationIds: [...APPLICATION_IDS],
  schema: { type: "object", properties: {}, additionalProperties: false },
  risk: () => "read",
  approval: () => ({ scopeKey: "schedule:list", scopeSummary: "定时任务", summary: "读取定时任务列表" }),
  parse(value) {
    if (!isObject(value)) throw new Error("参数必须是对象。");
    return value;
  },
  async execute(_parameters, context): Promise<readonly ScheduleView[]> {
    const now = Date.now();
    return listTasks(ownerOf(context))
      .filter((task) => task.status === "active" || task.status === "paused")
      .map((task) => viewFromTask(task, now));
  }
};

const deleteTool: AiBusinessTool = {
  id: "schedule.delete",
  name: "schedule_delete",
  description: "按 id 删除当前用户的一个定时任务（活动或已结束）。删除不会撤回已经排队的到点消息。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false
  },
  risk: () => "dangerous",
  approval: () => ({ scopeKey: "schedule:delete", scopeSummary: "定时任务", summary: "删除一个定时任务" }),
  parse(value) {
    if (!isObject(value) || typeof value.id !== "string" || value.id.trim().length === 0) {
      throw new Error("需要非空的 id。");
    }
    return value;
  },
  async execute(parameters, context) {
    const id = String(parameters.id);
    const task = getTask(id);
    if (task === null || task.ownerId !== ownerOf(context)) {
      return { id, deleted: false, code: "schedule_not_found" as const };
    }
    return { id, deleted: deleteTask(id) };
  }
};

const updateTool: AiBusinessTool = {
  id: "schedule.update",
  name: "schedule_update",
  description: "按 id 就地修改当前用户的一个定时任务：可只改标题、只改提示，或提供至多一种新的计时方式（every_seconds/daily/weekly/cron）。不传的字段保持原值。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      prompt: { type: "string" },
      every_seconds: { type: "number" },
      daily: {
        type: "object",
        properties: { time: { type: "string" }, time_zone: { type: "string" } },
        additionalProperties: false
      },
      weekly: {
        type: "object",
        properties: {
          time: { type: "string" },
          time_zone: { type: "string" },
          weekdays: { type: "array", items: { type: "integer" } }
        },
        additionalProperties: false
      },
      cron: {
        type: "object",
        properties: { expression: { type: "string" }, time_zone: { type: "string" } },
        additionalProperties: false
      }
    },
    required: ["id"],
    additionalProperties: false
  },
  risk: () => "write",
  approval: () => ({ scopeKey: "schedule:update", scopeSummary: "定时任务", summary: "修改一个定时任务" }),
  parse(value) {
    if (!isObject(value) || typeof value.id !== "string" || value.id.trim().length === 0) {
      throw new Error("需要非空的 id。");
    }
    return value;
  },
  async execute(parameters, context) {
    try {
      const id = String(parameters.id);
      const current = getTask(id);
      if (current === null || current.ownerId !== ownerOf(context)) {
        return { id, updated: false as const, code: "schedule_not_found" as const, message: "找不到该定时任务。" };
      }
      const updated = applyUpdateTask({
        id,
        ...(typeof parameters.title === "string" ? { title: parameters.title } : {}),
        ...(typeof parameters.prompt === "string" ? { prompt: parameters.prompt } : {}),
        selector: parseSelectors(parameters)
      }, Date.now());
      if (updated === null) return { id, updated: false as const, code: "schedule_not_found" as const, message: "该任务已结束，无法更新。" };
      return viewFromTask(updated, Date.now());
    } catch (error) {
      return toToolError(error);
    }
  }
};

const TOOLS: readonly AiBusinessTool[] = [createTool, listTool, deleteTool, updateTool];

/**
 * 在 host 上下文注册四个定时任务工具到 ctx.lfaaTools。
 * @returns 卸载函数（当前注册表为全局注册，返回空函数）。
 */
export function registerScheduleTools(ctx: Context): () => void {
  for (const tool of TOOLS) ctx.lfaaTools.registerTool(ctx, { ...tool, execute: async (parameters, context) => {
    const result = await tool.execute(parameters, context);
    if (tool.id !== "schedule.list") ctx.lfaaSchedule.requestDrive();
    return result;
  } });
  return () => { /* 全局注册表随插件生命周期管理，无需逐条卸载。 */ };
}
