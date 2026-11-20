// @lfaa/message-feedback：消息反馈服务。赞/踩与备注持久化在 ~/.lfaa/feedback.json，供聊天界面记录与回读。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type { IncomingMessage, ServerResponse } from "node:http";

/** 反馈类型：赞或踩。 */
export type FeedbackRating = "up" | "down";

/** 一条消息反馈；同一会话同一消息只保留最新一条。 */
export interface FeedbackRecord {
  id: string;
  sessionId: string;
  messageId: string;
  rating: FeedbackRating;
  comment?: string;
  createdAt: number;
  updatedAt: number;
}

/** 写入反馈的入参。 */
export interface FeedbackUpsertInput {
  sessionId: string;
  messageId: string;
  rating: FeedbackRating;
  comment?: string;
}

/** 服务配置：测试可指向临时文件。 */
export interface FeedbackPluginConfig {
  storeFilePath?: string;
}

const RATINGS: readonly FeedbackRating[] = ["up", "down"];
const MAX_COMMENT_CHARS = 2_000;

/** 解析反馈类型；非法值返回 undefined。 */
export function normalizeFeedbackRating(raw: unknown): FeedbackRating | undefined {
  return typeof raw === "string" && (RATINGS as readonly string[]).includes(raw) ? (raw as FeedbackRating) : undefined;
}

/** 默认存储文件：~/.lfaa/feedback.json。 */
export function defaultFeedbackStore(): string {
  return join(homedir(), ".lfaa", "feedback.json");
}

/** 校验并归一化一条反馈入参；字段缺失或越界直接报错。 */
export function normalizeFeedbackInput(raw: unknown): FeedbackUpsertInput {
  if (typeof raw !== "object" || raw === null) throw new Error("反馈内容必须是 JSON 对象。");
  const body = raw as Record<string, unknown>;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  const rating = normalizeFeedbackRating(body.rating);
  if (!sessionId) throw new Error("缺少 sessionId。");
  if (!messageId) throw new Error("缺少 messageId。");
  if (!rating) throw new Error('rating 只支持 "up" 或 "down"。');
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (comment.length > MAX_COMMENT_CHARS) throw new Error(`备注不能超过 ${MAX_COMMENT_CHARS} 个字符。`);
  return {
    sessionId,
    messageId,
    rating,
    ...(comment ? { comment } : {}),
  };
}

/** 反馈持久化：串行写入并按会话+消息做 upsert。 */
export class FeedbackStore {
  private readonly storeFilePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(storeFilePath?: string) {
    this.storeFilePath = storeFilePath ? resolve(storeFilePath) : defaultFeedbackStore();
  }

  async list(sessionId?: string): Promise<FeedbackRecord[]> {
    const items = await this.readAll();
    return items
      .filter((item) => (sessionId ? item.sessionId === sessionId : true))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(sessionId: string, messageId: string): Promise<FeedbackRecord | undefined> {
    return (await this.readAll()).find((item) => item.sessionId === sessionId && item.messageId === messageId);
  }

  /** 写入或更新一条反馈；返回落盘后的记录。 */
  async upsert(input: FeedbackUpsertInput): Promise<FeedbackRecord> {
    return this.mutate((items) => {
      const now = Date.now();
      const existing = items.find((item) => item.sessionId === input.sessionId && item.messageId === input.messageId);
      const next: FeedbackRecord = {
        id: existing?.id ?? randomUUID(),
        sessionId: input.sessionId,
        messageId: input.messageId,
        rating: input.rating,
        ...(input.comment ? { comment: input.comment } : {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const list = existing
        ? items.map((item) => (item.id === existing.id ? next : item))
        : [...items, next];
      return { items: list, result: next };
    });
  }

  /** 删除一条反馈；返回是否命中。 */
  async remove(sessionId: string, messageId: string): Promise<boolean> {
    return this.mutate((items) => {
      const next = items.filter((item) => !(item.sessionId === sessionId && item.messageId === messageId));
      return { items: next, result: next.length !== items.length };
    });
  }

  private async readAll(): Promise<FeedbackRecord[]> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as { feedback?: unknown };
      return Array.isArray(parsed.feedback) ? parsed.feedback as FeedbackRecord[] : [];
    } catch {
      return [];
    }
  }

  private async writeAll(items: FeedbackRecord[]): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    const target = this.storeFilePath;
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, feedback: items }, null, 2), "utf8");
    await rename(tmp, target);
  }

  /** 串行执行写操作，保证并发写入不丢条目。 */
  private mutate<T>(task: (items: FeedbackRecord[]) => { items: FeedbackRecord[]; result: T }): Promise<T> {
    const run = async () => {
      const items = await this.readAll();
      const { items: next, result } = task(items);
      await this.writeAll(next);
      return result;
    };
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }
}

/** Host 侧反馈服务，挂载为 `ctx.feedback`。 */
export class FeedbackService extends Service {
  private readonly store: FeedbackStore;

  constructor(ctx: Context, config: FeedbackPluginConfig = {}) {
    super(ctx, "feedback");
    this.store = new FeedbackStore(config.storeFilePath);
  }

  list(sessionId?: string): Promise<FeedbackRecord[]> {
    return this.store.list(sessionId);
  }

  get(sessionId: string, messageId: string): Promise<FeedbackRecord | undefined> {
    return this.store.get(sessionId, messageId);
  }

  upsert(input: FeedbackUpsertInput): Promise<FeedbackRecord> {
    return this.store.upsert(input);
  }

  remove(sessionId: string, messageId: string): Promise<boolean> {
    return this.store.remove(sessionId, messageId);
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

/** 处理 /api/feedback：GET 按会话列出、POST upsert、DELETE 撤销。 */
export function createFeedbackHttpHandler(service: FeedbackService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (urlObj.pathname !== "/api/feedback") return false;
    const method = (req.method ?? "GET").toUpperCase();
    try {
      if (method === "GET") {
        const sessionId = urlObj.searchParams.get("sessionId")?.trim() || undefined;
        sendJson(res, 200, { feedback: await service.list(sessionId) });
        return true;
      }
      if (method === "POST") {
        const input = normalizeFeedbackInput(await readJsonBody(req));
        sendJson(res, 200, { record: await service.upsert(input) });
        return true;
      }
      if (method === "DELETE") {
        const sessionId = urlObj.searchParams.get("sessionId")?.trim() ?? "";
        const messageId = urlObj.searchParams.get("messageId")?.trim() ?? "";
        if (!sessionId || !messageId) throw new Error("缺少 sessionId 或 messageId。");
        sendJson(res, 200, { removed: await service.remove(sessionId, messageId) });
        return true;
      }
      res.setHeader("Allow", "GET, POST, DELETE");
      sendJson(res, 405, { error: "反馈接口只支持 GET、POST、DELETE。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}

/** 为 Host 上下文注册反馈服务。 */
export function feedbackPlugin(ctx: Context, config: FeedbackPluginConfig = {}): void {
  new FeedbackService(ctx, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    feedback: FeedbackService;
  }
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default feedbackPlugin;