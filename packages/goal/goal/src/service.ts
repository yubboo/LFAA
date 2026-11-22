// @lfaa/goal：会话目标服务。目标与进展持久化在 ~/.lfaa/goals.json，供目标工具与界面读取。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";

/** 目标状态：进行中、已完成、受阻。 */
export type GoalStatus = "active" | "complete" | "blocked";

/** 进展日志的一条记录。 */
export interface GoalLogEntry {
  at: number;
  note: string;
  status?: GoalStatus;
}

/** 一个长期目标。 */
export interface GoalItem {
  id: string;
  title: string;
  objective: string;
  status: GoalStatus;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
  progress: { done: number; total: number };
  log: GoalLogEntry[];
  /** 已自动续跑的轮次。 */
  rounds: number;
  /** 自动续跑轮数上限（1–50，默认 10）。 */
  maxRounds: number;
  /** 用户是否允许自动续跑；暂停后保持 true 以外的值，不改变目标状态。 */
  autoContinue: boolean;
  /** 最近一次自动续跑的时间。 */
  lastContinuedAt?: number;
}

/** 新建目标的入参。 */
export interface GoalCreateInput {
  title: string;
  objective: string;
  sessionId?: string;
  total?: number;
  /** 自动续跑轮数上限；缺省 10。 */
  maxRounds?: number;
  /** 是否允许自动续跑；缺省 true。 */
  autoContinue?: boolean;
}

/** 更新目标的入参；note 会追加到进展日志。 */
export interface GoalUpdateInput {
  title?: string;
  objective?: string;
  status?: GoalStatus;
  note?: string;
  done?: number;
  total?: number;
  /** 暂停/恢复自动续跑；不影响目标状态。 */
  autoContinue?: boolean;
  /** 调整自动续跑轮数上限，超过已用轮次时仍可继续。 */
  maxRounds?: number;
}

/** 目标服务存储配置，测试可指向临时文件。 */
export interface GoalPluginConfig {
  storeFilePath?: string;
}

const STATUSES: readonly GoalStatus[] = ["active", "complete", "blocked"];
const DEFAULT_MAX_ROUNDS = 10;
const MAX_MAX_ROUNDS = 50;

/** 归一化自动续跑上限：非法值回落默认，限制在 1–50。 */
export function normalizeMaxRounds(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_ROUNDS;
  return Math.min(MAX_MAX_ROUNDS, Math.max(1, Math.floor(value)));
}

/** 兼容旧 goals.json：补齐自动续跑字段，避免历史目标因缺字段被当成暂停。 */
function normalizeStoredGoal(goal: GoalItem): GoalItem {
  return {
    ...goal,
    rounds: Number.isFinite(goal.rounds) && goal.rounds > 0 ? Math.floor(goal.rounds) : 0,
    maxRounds: normalizeMaxRounds(goal.maxRounds),
    autoContinue: goal.autoContinue !== false,
  };
}

/** 解析状态字符串，非法值返回 undefined（保留原状态）。 */
export function normalizeGoalStatus(raw: unknown): GoalStatus | undefined {
  return typeof raw === "string" && (STATUSES as readonly string[]).includes(raw) ? (raw as GoalStatus) : undefined;
}

/** 归一化进度，负数与非法值归零，done 不超过 total。 */
export function normalizeProgress(done: number, total: number): { done: number; total: number } {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const safeDone = Number.isFinite(done) && done > 0 ? Math.floor(done) : 0;
  return { done: safeTotal > 0 ? Math.min(safeDone, safeTotal) : safeDone, total: safeTotal };
}

/** 一行摘要，供工具结果与日志复用。 */
export function summarizeGoal(goal: GoalItem): string {
  const progress = goal.progress.total > 0 ? `${goal.progress.done}/${goal.progress.total}` : "未设进度";
  return `[${goal.status}] ${goal.title}（${progress}）`;
}

const DEFAULT_STORE = () => join(homedir(), ".lfaa", "goals.json");

/** 目标服务：进程内缓存 + 文件持久化，写入串行化避免并发覆盖。 */
export class GoalService extends Service {
  private readonly storeFilePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(ctx: Context, config: GoalPluginConfig = {}) {
    super(ctx, "goal");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_STORE();
  }

  private async readAll(): Promise<GoalItem[]> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      const goals = (parsed as { goals?: unknown }).goals;
      if (!Array.isArray(goals)) return [];
      return goals.filter((item): item is GoalItem => typeof item === "object" && item !== null
        && typeof (item as GoalItem).id === "string"
        && typeof (item as GoalItem).title === "string").map(normalizeStoredGoal);
    } catch {
      return [];
    }
  }

  private async writeAll(goals: GoalItem[]): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify({ version: 1, goals }, null, 2), "utf8");
  }

  /** 串行执行写操作，保证并发写入不丢条目。 */
  private mutate<T>(task: (goals: GoalItem[]) => Promise<{ goals: GoalItem[]; result: T }> | { goals: GoalItem[]; result: T }): Promise<T> {
    const run = async () => {
      const goals = await this.readAll();
      const { goals: next, result } = await task(goals);
      await this.writeAll(next);
      return result;
    };
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }

  async list(filter: { sessionId?: string; status?: GoalStatus } = {}): Promise<GoalItem[]> {
    const goals = await this.readAll();
    return goals
      .filter((goal) => (filter.sessionId ? goal.sessionId === filter.sessionId : true))
      .filter((goal) => (filter.status ? goal.status === filter.status : true))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<GoalItem | undefined> {
    return (await this.readAll()).find((goal) => goal.id === id);
  }

  async create(input: GoalCreateInput): Promise<GoalItem> {
    const title = input.title.trim();
    const objective = input.objective.trim();
    if (!title) throw new Error("目标标题不能为空。");
    if (!objective) throw new Error("目标描述不能为空。");
    const now = Date.now();
    const goal: GoalItem = {
      id: randomUUID(),
      title,
      objective,
      status: "active",
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      createdAt: now,
      updatedAt: now,
      progress: normalizeProgress(0, input.total ?? 0),
      log: [],
      rounds: 0,
      maxRounds: normalizeMaxRounds(input.maxRounds),
      autoContinue: input.autoContinue !== false,
    };
    return this.mutate((goals) => ({ goals: [...goals, goal], result: goal }));
  }

  async update(id: string, patch: GoalUpdateInput): Promise<GoalItem> {
    return this.mutate((goals) => {
      const index = goals.findIndex((goal) => goal.id === id);
      if (index < 0) throw new Error(`目标不存在：${id}`);
      const current = goals[index] as GoalItem;
      const status = normalizeGoalStatus(patch.status) ?? current.status;
      const progress = normalizeProgress(
        patch.done ?? current.progress.done,
        patch.total ?? current.progress.total,
      );
      const log = patch.note?.trim()
        ? [...current.log, { at: Date.now(), note: patch.note.trim(), ...(normalizeGoalStatus(patch.status) ? { status } : {}) }].slice(-50)
        : current.log;
      const next: GoalItem = {
        ...current,
        ...(patch.title?.trim() ? { title: patch.title.trim() } : {}),
        ...(patch.objective?.trim() ? { objective: patch.objective.trim() } : {}),
        status,
        progress,
        log,
        updatedAt: Date.now(),
        ...(typeof patch.autoContinue === "boolean" ? { autoContinue: patch.autoContinue } : {}),
        ...(patch.maxRounds !== undefined ? { maxRounds: normalizeMaxRounds(patch.maxRounds) } : {}),
      };
      const list = goals.map((goal, position) => (position === index ? next : goal));
      return { goals: list, result: next };
    });
  }

  /** 记录一轮自动续跑：轮次 +1、刷新时间与日志；由运行调度器在成功启动新一轮后调用。 */
  async advanceRound(id: string, note?: string): Promise<GoalItem> {
    return this.mutate((goals) => {
      const index = goals.findIndex((goal) => goal.id === id);
      if (index < 0) throw new Error(`目标不存在：${id}`);
      const current = goals[index] as GoalItem;
      const rounds = current.rounds + 1;
      const now = Date.now();
      const next: GoalItem = {
        ...current,
        rounds,
        lastContinuedAt: now,
        updatedAt: now,
        log: [...current.log, { at: now, note: note?.trim() || `自动继续第 ${rounds} 轮` }].slice(-50),
      };
      return { goals: goals.map((goal, position) => (position === index ? next : goal)), result: next };
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.mutate((goals) => {
      const next = goals.filter((goal) => goal.id !== id);
      return { goals: next, result: next.length !== goals.length };
    });
  }
}

/** 为 Host 上下文注册目标服务。 */
export function goalPlugin(ctx: Context, config: GoalPluginConfig = {}): void {
  new GoalService(ctx, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    goal: GoalService;
  }
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default goalPlugin;