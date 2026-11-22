// @lfaa/handoff：会话交接服务。交接单持久化在 ~/.lfaa/handoffs.json，供交接工具与界面读取。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";

/** 交接状态：待接手、已接手、已取消。 */
export type HandoffStatus = "pending" | "accepted" | "cancelled";

/** 一条会话交接：来源、可选目标会话、摘要、下一步与接受后的目标 id。 */
export interface HandoffItem {
  id: string;
  projectId: string | null;
  fromSessionId: string;
  toSessionId?: string;
  title: string;
  summary: string;
  nextSteps: string[];
  status: HandoffStatus;
  createdAt: number;
  updatedAt: number;
  acceptedAt?: number;
  acceptedBySessionId?: string;
  goalId?: string;
}

export interface HandoffCreateInput {
  fromSessionId: string;
  projectId: string | null;
  title: string;
  summary: string;
  nextSteps?: string[];
  toSessionId?: string;
}

export interface HandoffListFilter {
  sessionId?: string;
  direction?: "incoming" | "outgoing" | "all";
  status?: HandoffStatus;
  /** 不传表示不按项目过滤；null 表示只匹配未绑定项目的交接。 */
  projectId?: string | null;
}

export interface HandoffPluginConfig {
  storeFilePath?: string;
}

const STATUSES: readonly HandoffStatus[] = ["pending", "accepted", "cancelled"];
const MAX_TITLE = 120;
const MAX_SUMMARY = 4000;
const MAX_STEPS = 20;

/** 解析状态字符串，非法值返回 undefined。 */
export function normalizeHandoffStatus(raw: unknown): HandoffStatus | undefined {
  return typeof raw === "string" && (STATUSES as readonly string[]).includes(raw) ? (raw as HandoffStatus) : undefined;
}

/** 校验并归一交接文本：标题/摘要必填，下一步去空去重并限制条数。 */
export function normalizeHandoffText(input: { title: string; summary: string; nextSteps?: readonly string[] }): {
  title: string;
  summary: string;
  nextSteps: string[];
} {
  const title = input.title.trim().slice(0, MAX_TITLE);
  const summary = input.summary.trim().slice(0, MAX_SUMMARY);
  if (!title) throw new Error("交接标题不能为空。");
  if (!summary) throw new Error("交接摘要不能为空。");
  const nextSteps = [...new Set((input.nextSteps ?? []).map((step) => step.trim()).filter(Boolean))].slice(0, MAX_STEPS);
  return { title, summary, nextSteps };
}

/** 兼容旧 handoffs.json：补齐数组与状态，跳过损坏条目。 */
function normalizeStoredHandoff(item: HandoffItem): HandoffItem {
  return {
    ...item,
    status: normalizeHandoffStatus(item.status) ?? "pending",
    nextSteps: Array.isArray(item.nextSteps) ? item.nextSteps.filter((step): step is string => typeof step === "string") : [],
  };
}

/** 交接摘要 + 下一步组成接手方的 goal 描述，工具与 HTTP 共用。 */
export function buildHandoffObjective(item: Pick<HandoffItem, "summary" | "nextSteps">): string {
  return [
    item.summary,
    ...(item.nextSteps.length > 0 ? ["", "下一步：", ...item.nextSteps.map((step) => `- ${step}`)] : []),
  ].join("\n");
}

const DEFAULT_STORE = () => join(homedir(), ".lfaa", "handoffs.json");

/** 交接服务：进程内缓存 + 文件持久化，写入串行化避免并发覆盖。 */
export class HandoffService extends Service {
  private readonly storeFilePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(ctx: Context, config: HandoffPluginConfig = {}) {
    super(ctx, "handoff");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_STORE();
  }

  private async readAll(): Promise<HandoffItem[]> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      const items = (parsed as { handoffs?: unknown }).handoffs;
      if (!Array.isArray(items)) return [];
      return items
        .filter((item): item is HandoffItem => typeof item === "object" && item !== null
          && typeof (item as HandoffItem).id === "string"
          && typeof (item as HandoffItem).fromSessionId === "string"
          && typeof (item as HandoffItem).title === "string")
        .map(normalizeStoredHandoff);
    } catch {
      return [];
    }
  }

  private async writeAll(items: HandoffItem[]): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify({ version: 1, handoffs: items }, null, 2), "utf8");
  }

  private mutate<T>(task: (items: HandoffItem[]) => Promise<{ items: HandoffItem[]; result: T }> | { items: HandoffItem[]; result: T }): Promise<T> {
    const run = async () => {
      const items = await this.readAll();
      const { items: next, result } = await task(items);
      await this.writeAll(next);
      return result;
    };
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }

  /** 按会话方向、状态与项目过滤，pending 优先、最近创建在前。 */
  async list(filter: HandoffListFilter = {}): Promise<HandoffItem[]> {
    const direction = filter.direction ?? "all";
    const items = await this.readAll();
    return items
      .filter((item) => (filter.status ? item.status === filter.status : true))
      .filter((item) => (filter.projectId === undefined ? true : (item.projectId ?? null) === (filter.projectId ?? null)))
      .filter((item) => {
        if (!filter.sessionId) return direction === "all";
        const incoming = item.toSessionId ? item.toSessionId === filter.sessionId : item.fromSessionId !== filter.sessionId;
        const outgoing = item.fromSessionId === filter.sessionId;
        if (direction === "incoming") return incoming;
        if (direction === "outgoing") return outgoing;
        return incoming || outgoing;
      })
      .sort((left, right) => Number(right.status === "pending") - Number(left.status === "pending") || right.createdAt - left.createdAt);
  }

  async get(id: string): Promise<HandoffItem | undefined> {
    return (await this.readAll()).find((item) => item.id === id);
  }

  async create(input: HandoffCreateInput): Promise<HandoffItem> {
    const text = normalizeHandoffText(input);
    const fromSessionId = input.fromSessionId.trim();
    if (!fromSessionId) throw new Error("缺少来源会话。");
    const now = Date.now();
    const item: HandoffItem = {
      id: randomUUID(),
      projectId: input.projectId ?? null,
      fromSessionId,
      ...(input.toSessionId?.trim() ? { toSessionId: input.toSessionId.trim() } : {}),
      ...text,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    return this.mutate((items) => ({ items: [...items, item], result: item }));
  }

  /** 接受交接：目标会话或广播接收方；已处理/自己的交接直接拒绝。 */
  async accept(id: string, sessionId: string, goalId: string): Promise<HandoffItem> {
    return this.mutate((items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`交接不存在：${id}`);
      const current = items[index] as HandoffItem;
      if (current.status !== "pending") throw new Error("这条交接已经处理。");
      if (current.fromSessionId === sessionId) throw new Error("不能接手自己发出的交接。");
      if (current.toSessionId && current.toSessionId !== sessionId) throw new Error("这条交接指定了其他会话接手。");
      const now = Date.now();
      const next: HandoffItem = {
        ...current,
        status: "accepted",
        acceptedAt: now,
        acceptedBySessionId: sessionId,
        goalId,
        updatedAt: now,
      };
      return { items: items.map((item, position) => (position === index ? next : item)), result: next };
    });
  }

  /** 取消交接：发送方可取消；指定接收方也可以拒绝。 */
  async cancel(id: string, sessionId: string): Promise<HandoffItem> {
    return this.mutate((items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`交接不存在：${id}`);
      const current = items[index] as HandoffItem;
      if (current.status !== "pending") throw new Error("这条交接已经处理。");
      if (current.fromSessionId !== sessionId && current.toSessionId !== sessionId) {
        throw new Error("只有发送方或指定接收方可以取消交接。");
      }
      const now = Date.now();
      const next: HandoffItem = { ...current, status: "cancelled", updatedAt: now };
      return { items: items.map((item, position) => (position === index ? next : item)), result: next };
    });
  }
}

/** 为 Host 上下文注册交接服务。 */
export function handoffPlugin(ctx: Context, config: HandoffPluginConfig = {}): void {
  new HandoffService(ctx, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    handoff: HandoffService;
  }
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default handoffPlugin;