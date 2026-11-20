// @lfaa/tool-schedule：持久化定时任务（一次性或重复），提供创建、查看、取消与到期领取工具。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";

/** 重复规则：固定间隔，或每天固定时刻。 */
export type ScheduleRepeat =
  | { kind: "interval"; ms: number }
  | { kind: "daily"; at: string };

/** 一条定时任务。 */
export interface ScheduleItem {
  id: string;
  title: string;
  prompt: string;
  dueAt: number;
  repeat?: ScheduleRepeat;
  createdAt: number;
  lastTriggeredAt?: number;
}

/** 默认存储文件：~/.lfaa/schedules.json。 */
export function defaultScheduleStore(): string {
  return join(homedir(), ".lfaa", "schedules.json");
}

/** 相对时间写法：+30s / +15m / +2h / +1d。 */
const RELATIVE = /^\+(\d+)([smhd])$/u;

/** 解析到期时间：相对量或 ISO 时间；无法解析或已过期都报错。 */
export function parseDueAt(raw: string, now = Date.now()): number {
  const text = raw.trim();
  if (!text) throw new Error("到期时间不能为空，可用 +30m 或 2026-11-21T09:00:00+08:00。");
  const relative = RELATIVE.exec(text);
  if (relative) {
    const amount = Number(relative[1]);
    const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[relative[2] as "s" | "m" | "h" | "d"];
    const due = now + amount * unitMs;
    if (amount <= 0) throw new Error("相对时间必须大于 0。");
    return due;
  }
  const due = Date.parse(text);
  if (!Number.isFinite(due)) throw new Error(`无法解析到期时间：${text}`);
  return due;
}

/** 计算下一次到期时间；一次性任务返回 undefined。 */
export function nextDue(item: Pick<ScheduleItem, "dueAt" | "repeat">, now = Date.now()): number | undefined {
  if (!item.repeat) return undefined;
  if (item.repeat.kind === "interval") {
    const step = Math.max(1_000, item.repeat.ms);
    let next = item.dueAt + step;
    while (next <= now) next += step;
    return next;
  }
  const [hour, minute] = item.repeat.at.split(":").map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return undefined;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour!, minute!, 0, 0);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.getTime();
}

/** 从列表里取出到期项并推进状态：重复任务移到下一次，一次性任务移除。 */
export function takeDue(
  items: readonly ScheduleItem[],
  now = Date.now(),
): { due: ScheduleItem[]; rest: ScheduleItem[] } {
  const due: ScheduleItem[] = [];
  const rest: ScheduleItem[] = [];
  for (const item of items) {
    if (item.dueAt > now) {
      rest.push(item);
      continue;
    }
    due.push({ ...item, lastTriggeredAt: now });
    const next = nextDue(item, now);
    if (next !== undefined) rest.push({ ...item, dueAt: next, lastTriggeredAt: now });
  }
  return { due, rest };
}

/** 一行摘要。 */
export function describeSchedule(item: ScheduleItem, now = Date.now()): string {
  const repeat = item.repeat?.kind === "interval"
    ? `每 ${Math.round(item.repeat.ms / 60_000)} 分钟`
    : item.repeat?.kind === "daily" ? `每天 ${item.repeat.at}` : "一次性";
  const overdue = item.dueAt <= now ? "（已到期）" : "";
  return `${item.id} · ${item.title} · ${new Date(item.dueAt).toLocaleString("zh-CN")}${overdue} · ${repeat}`;
}

/** 读写存储，写入串行化避免并发覆盖。 */
export class ScheduleStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async read(): Promise<ScheduleItem[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      const items = (parsed as { items?: unknown }).items;
      if (!Array.isArray(items)) return [];
      return items.filter((item): item is ScheduleItem => typeof item === "object" && item !== null
        && typeof (item as ScheduleItem).id === "string"
        && typeof (item as ScheduleItem).title === "string"
        && typeof (item as ScheduleItem).dueAt === "number");
    } catch {
      return [];
    }
  }

  mutate<T>(task: (items: ScheduleItem[]) => { items: ScheduleItem[]; result: T }): Promise<T> {
    const run = async () => {
      const items = await this.read();
      const { items: next, result } = task(items);
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, JSON.stringify({ version: 1, items: next }, null, 2), "utf8");
      return result;
    };
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }
}

/** 构造一条任务；供工具与测试共用。 */
export function buildSchedule(input: {
  title: string;
  prompt: string;
  dueAt: number;
  repeat?: ScheduleRepeat | undefined;
  id?: string;
  now?: number;
}): ScheduleItem {
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (!title) throw new Error("任务标题不能为空。");
  if (!prompt) throw new Error("任务内容不能为空。");
  return {
    id: input.id ?? randomUUID(),
    title,
    prompt,
    dueAt: input.dueAt,
    ...(input.repeat ? { repeat: input.repeat } : {}),
    createdAt: input.now ?? Date.now(),
  };
}

/** 解析重复规则参数；非法返回 undefined。 */
export function parseRepeat(raw: unknown): ScheduleRepeat | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  if (record.kind === "interval" && typeof record.minutes === "number" && record.minutes > 0) {
    return { kind: "interval", ms: Math.round(record.minutes * 60_000) };
  }
  if (record.kind === "daily" && typeof record.at === "string" && /^\d{1,2}:\d{2}$/u.test(record.at)) {
    return { kind: "daily", at: record.at };
  }
  return undefined;
}

/** 插件配置：存储路径可注入，便于测试。 */
export interface ScheduleConfig {
  storeFilePath?: string;
}

const scheduleCore: Plugin.Object<ScheduleConfig> = {
  name: "lfaa-tool-schedule",
  inject: ["tools"],
  apply(ctx, config) {
    const store = new ScheduleStore(config?.storeFilePath ?? defaultScheduleStore());

    ctx.effect(() => {
      const disposers = [
        ctx.tools.registerTool({
          moduleName: "@lfaa/tool-schedule",
          name: "schedule_create",
          title: "创建定时任务",
          description: "登记一个提醒/后续任务。dueAt 支持 +30m、+2h、+1d 或 ISO 时间；repeat 可设 {kind:'interval',minutes} 或 {kind:'daily',at:'09:00'}。",
          permissionLevel: "read",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "任务名" },
              prompt: { type: "string", description: "到期时要做的事/提醒内容" },
              dueAt: { type: "string", description: "到期时间：+30m / +2h / +1d / ISO" },
              repeat: { type: "object", description: "可选重复规则：{kind:'interval',minutes} 或 {kind:'daily',at:'HH:mm'}" },
            },
            required: ["title", "prompt", "dueAt"],
          },
          execute: async (args) => {
            const dueAt = parseDueAt(String(args.dueAt ?? ""));
            const item = buildSchedule({
              title: String(args.title ?? ""),
              prompt: String(args.prompt ?? ""),
              dueAt,
              repeat: parseRepeat(args.repeat),
            });
            await store.mutate((items) => ({ items: [...items, item], result: item }));
            return {
              ok: true,
              output: `已创建定时任务：${describeSchedule(item)}`,
              summary: `定时任务：${item.title}`,
              metadata: { scheduleId: item.id, dueAt: item.dueAt },
            };
          },
        }),
        ctx.tools.registerTool({
          moduleName: "@lfaa/tool-schedule",
          name: "schedule_list",
          title: "查看定时任务",
          description: "列出已登记的定时任务（按到期时间排序）。",
          permissionLevel: "read",
          parameters: { type: "object", properties: {} },
          execute: async () => {
            const items = (await store.read()).sort((a, b) => a.dueAt - b.dueAt);
            if (items.length === 0) return { ok: true, output: "还没有定时任务。", summary: "没有任务" };
            return {
              ok: true,
              output: items.map((item) => describeSchedule(item)).join("\n"),
              summary: `${items.length} 个定时任务`,
            };
          },
        }),
        ctx.tools.registerTool({
          moduleName: "@lfaa/tool-schedule",
          name: "schedule_cancel",
          title: "取消定时任务",
          description: "按 id 取消一个定时任务。",
          permissionLevel: "read",
          parameters: {
            type: "object",
            properties: { id: { type: "string", description: "任务 id" } },
            required: ["id"],
          },
          execute: async (args) => {
            const id = String(args.id ?? "");
            const removed = await store.mutate((items) => {
              const next = items.filter((item) => item.id !== id);
              return { items: next, result: items.length - next.length > 0 };
            });
            return removed
              ? { ok: true, output: `已取消定时任务 ${id}。`, summary: "已取消" }
              : { ok: false, output: `找不到定时任务：${id}`, summary: "未找到任务" };
          },
        }),
        ctx.tools.registerTool({
          moduleName: "@lfaa/tool-schedule",
          name: "schedule_due",
          title: "领取到期任务",
          description: "取出已到期或已过的任务，并把重复任务推进到下一次、一次性任务移除。",
          permissionLevel: "read",
          parameters: { type: "object", properties: {} },
          execute: async () => {
            let due: ScheduleItem[] = [];
            await store.mutate((items) => {
              const taken = takeDue(items);
              due = taken.due;
              return { items: taken.rest, result: taken.due.length };
            });
            if (due.length === 0) return { ok: true, output: "当前没有到期任务。", summary: "没有到期任务" };
            return {
              ok: true,
              output: due.map((item) => `· ${item.title}：${item.prompt}`).join("\n"),
              summary: `${due.length} 个到期任务`,
              metadata: { dueIds: due.map((item) => item.id) },
            };
          },
        }),
      ];
      return () => {
        for (const dispose of disposers) dispose();
      };
    });
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default scheduleCore;