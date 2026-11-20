// @lfaa/attachment-local：会话附件本机存储。附件字节保存到 ~/.lfaa/attachments/<session>/，元数据存会话索引。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { IncomingMessage, ServerResponse } from "node:http";

/** 一条附件元数据（不含字节内容）。 */
export interface AttachmentItem {
  id: string;
  sessionId: string;
  name: string;
  mime: string;
  size: number;
  storedName: string;
  createdAt: number;
}

/** 写入附件的入参：内容用 base64 传输。 */
export interface AttachmentPutInput {
  sessionId: string;
  name: string;
  mime?: string;
  contentBase64: string;
}

/** 服务配置：测试可指向临时目录。 */
export interface AttachmentPluginConfig {
  rootDir?: string;
  maxBytes?: number;
}

/** 单附件上限：默认 10 MiB。 */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_NAME_CHARS = 120;

/** 默认存储根目录：~/.lfaa/attachments。 */
export function defaultAttachmentRoot(): string {
  return join(homedir(), ".lfaa", "attachments");
}

/** 会话目录名：只保留安全字符，避免路径穿越。 */
export function safeSessionDir(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 64) || "default";
}

/** 附件原始文件名：去目录、去控制字符并限长。 */
export function safeAttachmentName(name: string): string {
  const base = basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]+/gu, "_").trim();
  return (base || "attachment").slice(0, MAX_NAME_CHARS);
}

/** 文本类 MIME 判定：用于工具读取时决定是否直接内联正文。 */
export function isTextMime(mime: string): boolean {
  return mime.startsWith("text/") || mime === "application/json" || mime === "application/xml" || mime.endsWith("+json") || mime.endsWith("+xml");
}

/** 附件存储：每个会话一个目录 + index.json；写入串行化，文件名带随机 id 前缀避免覆盖。 */
export class AttachmentStore {
  private readonly rootDir: string;
  private readonly maxBytes: number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(rootDir?: string, maxBytes = DEFAULT_MAX_BYTES) {
    this.rootDir = rootDir ? resolve(rootDir) : defaultAttachmentRoot();
    this.maxBytes = maxBytes;
  }

  private sessionDir(sessionId: string): string {
    return join(this.rootDir, safeSessionDir(sessionId));
  }

  private indexPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "index.json");
  }

  async list(sessionId: string): Promise<AttachmentItem[]> {
    const items = await this.readIndex(sessionId);
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  async get(sessionId: string, id: string): Promise<{ item: AttachmentItem; contentBase64: string } | undefined> {
    const item = (await this.readIndex(sessionId)).find((entry) => entry.id === id);
    if (!item) return undefined;
    const bytes = await readFile(join(this.sessionDir(sessionId), item.storedName)).catch(() => null);
    if (!bytes) return undefined;
    return { item, contentBase64: bytes.toString("base64") };
  }

  /** 保存附件并返回元数据；base64 非法、超限或名称为空都报错。 */
  async put(input: AttachmentPutInput): Promise<AttachmentItem> {
    if (!input.sessionId.trim()) throw new Error("缺少 sessionId。");
    const name = safeAttachmentName(input.name.trim());
    if (!name) throw new Error("附件名不能为空。");
    let bytes: Buffer;
    try {
      bytes = Buffer.from(input.contentBase64 ?? "", "base64");
    } catch {
      throw new Error("附件内容是非法 base64。");
    }
    if (bytes.length === 0) throw new Error("附件内容为空。");
    if (bytes.length > this.maxBytes) {
      throw new Error(`附件超过 ${Math.round(this.maxBytes / 1024 / 1024)} MiB 上限。`);
    }
    const mime = typeof input.mime === "string" && input.mime.trim() ? input.mime.trim().slice(0, 120) : "application/octet-stream";
    const id = randomUUID();
    const storedName = `${id}-${name}`;
    return this.mutate(input.sessionId, async (items) => {
      const dir = this.sessionDir(input.sessionId);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, storedName), bytes);
      const item: AttachmentItem = {
        id,
        sessionId: input.sessionId,
        name,
        mime,
        size: bytes.length,
        storedName,
        createdAt: Date.now(),
      };
      return { items: [...items, item], result: item };
    });
  }

  /** 删除一条附件；返回是否命中。 */
  async remove(sessionId: string, id: string): Promise<boolean> {
    return this.mutate(sessionId, async (items) => {
      const target = items.find((entry) => entry.id === id);
      if (target) {
        await rm(join(this.sessionDir(sessionId), target.storedName), { force: true }).catch(() => {});
      }
      const next = items.filter((entry) => entry.id !== id);
      return { items: next, result: next.length !== items.length };
    });
  }

  /** 清空一个会话的全部附件（会话删除时调用）。 */
  async removeSession(sessionId: string): Promise<void> {
    await rm(this.sessionDir(sessionId), { recursive: true, force: true }).catch(() => {});
  }

  private async readIndex(sessionId: string): Promise<AttachmentItem[]> {
    try {
      const raw = await readFile(this.indexPath(sessionId), "utf8");
      const parsed = JSON.parse(raw) as { items?: unknown };
      return Array.isArray(parsed.items) ? parsed.items as AttachmentItem[] : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(sessionId: string, items: AttachmentItem[]): Promise<void> {
    const dir = this.sessionDir(sessionId);
    await mkdir(dir, { recursive: true });
    const target = this.indexPath(sessionId);
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, items }, null, 2), "utf8");
    await rename(tmp, target);
  }

  /** 串行读取-修改-写回，避免并发写丢索引条目。 */
  private mutate<T>(
    sessionId: string,
    task: (items: AttachmentItem[]) => Promise<{ items: AttachmentItem[]; result: T }>,
  ): Promise<T> {
    const run = async () => {
      const items = await this.readIndex(sessionId);
      const { items: next, result } = await task(items);
      await this.writeIndex(sessionId, next);
      return result;
    };
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }
}

/** Host 侧附件服务，挂载为 `ctx.attachment`。 */
export class AttachmentService extends Service {
  readonly store: AttachmentStore;

  constructor(ctx: Context, config: AttachmentPluginConfig = {}) {
    super(ctx, "attachment");
    this.store = new AttachmentStore(config.rootDir, config.maxBytes ?? DEFAULT_MAX_BYTES);
  }

  list(sessionId: string): Promise<AttachmentItem[]> {
    return this.store.list(sessionId);
  }

  put(input: AttachmentPutInput): Promise<AttachmentItem> {
    return this.store.put(input);
  }

  get(sessionId: string, id: string) {
    return this.store.get(sessionId, id);
  }

  remove(sessionId: string, id: string): Promise<boolean> {
    return this.store.remove(sessionId, id);
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
}

/** 处理 /api/attachments：GET 列出、GET /:id 取内容、POST 上传、DELETE 删除。 */
export function createAttachmentHttpHandler(service: AttachmentService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!urlObj.pathname.startsWith("/api/attachments")) return false;
    const method = (req.method ?? "GET").toUpperCase();
    try {
      const sessionId = urlObj.searchParams.get("sessionId")?.trim() ?? "";
      const id = urlObj.pathname.startsWith("/api/attachments/")
        ? decodeURIComponent(urlObj.pathname.slice("/api/attachments/".length))
        : "";
      if (method === "GET" && !id) {
        if (!sessionId) throw new Error("缺少 sessionId。");
        sendJson(res, 200, { items: await service.list(sessionId) });
        return true;
      }
      if (method === "GET" && id) {
        if (!sessionId) throw new Error("缺少 sessionId。");
        const found = await service.get(sessionId, id);
        if (!found) { sendJson(res, 404, { error: "附件不存在。" }); return true; }
        sendJson(res, 200, { item: found.item, contentBase64: found.contentBase64 });
        return true;
      }
      if (method === "POST") {
        const body = await readJsonBody(req);
        const item = await service.put({
          sessionId: String(body.sessionId ?? ""),
          name: String(body.name ?? ""),
          ...(typeof body.mime === "string" ? { mime: body.mime } : {}),
          contentBase64: String(body.contentBase64 ?? ""),
        });
        sendJson(res, 200, { item });
        return true;
      }
      if (method === "DELETE" && id) {
        if (!sessionId) throw new Error("缺少 sessionId。");
        sendJson(res, 200, { removed: await service.remove(sessionId, id) });
        return true;
      }
      res.setHeader("Allow", "GET, POST, DELETE");
      sendJson(res, 405, { error: "附件接口只支持 GET、POST、DELETE。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}

/** 为 Host 上下文注册附件服务与只读工具（附件内容由工具按会话读取）。 */
export function attachmentPlugin(ctx: Context, config: AttachmentPluginConfig = {}): void {
  const service = new AttachmentService(ctx, config);
  ctx.effect(() => {
    const disposers = [
      ctx.tools.registerTool({
        moduleName: "@lfaa/attachment-local",
        name: "list_attachments",
        title: "列出会话附件",
        description: "列出当前会话已上传的附件（名称、类型、大小、id）。",
        permissionLevel: "read",
        parameters: { type: "object", properties: {} },
        execute: async (_args, context) => {
          const items = await service.list(context.sessionId);
          if (items.length === 0) return { ok: true, output: "当前会话没有附件。", summary: "没有附件" };
          return {
            ok: true,
            output: items.map((item) => `· ${item.name}（${item.mime}, ${item.size} B, id=${item.id}）`).join("\n"),
            summary: `${items.length} 个附件`,
            metadata: { attachmentIds: items.map((item) => item.id) },
          };
        },
      }),
      ctx.tools.registerTool({
        moduleName: "@lfaa/attachment-local",
        name: "read_attachment",
        title: "读取会话附件",
        description: "按 id 读取当前会话的附件：文本类直接返回正文，二进制返回类型与大小说明。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: { id: { type: "string", description: "附件 id（来自 list_attachments 或消息中的附件标记）" } },
          required: ["id"],
        },
        execute: async (args, context) => {
          const id = String(args.id ?? "").trim();
          if (!id) return { ok: false, output: "缺少附件 id。", summary: "缺少 id" };
          const found = await service.get(context.sessionId, id);
          if (!found) return { ok: false, output: `找不到附件：${id}`, summary: "未找到附件" };
          const { item, contentBase64 } = found;
          if (!isTextMime(item.mime)) {
            return {
              ok: true,
              output: `附件「${item.name}」是 ${item.mime}（${item.size} B），二进制内容不能直接内联。`,
              summary: `二进制附件：${item.name}`,
              metadata: { attachmentId: item.id, mime: item.mime, size: item.size },
            };
          }
          const text = Buffer.from(contentBase64, "base64").toString("utf8");
          const clipped = text.slice(0, 20_000);
          return {
            ok: true,
            output: clipped + (text.length > clipped.length ? `\n…（已截断，原文 ${text.length} 字符）` : ""),
            summary: `附件正文：${item.name}`,
            metadata: { attachmentId: item.id, chars: text.length, truncated: text.length > clipped.length },
          };
        },
      }),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  });
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    attachment: AttachmentService;
  }
}

/** 插件需要工具注册表才能注册读取工具。 */
attachmentPlugin.inject = ["tools"] as const;

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default attachmentPlugin;