// @lfaa/commands：斜杠命令注册 seam。插件向 Host 注册命令，聊天输入栏通过 /api/commands 发现并执行。
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type { IncomingMessage, ServerResponse } from "node:http";

/** 命令种类：prompt 展开成一段提示词交给输入框；message 只回执一条说明。 */
export type CommandKind = "prompt" | "message";

/** 一条已注册命令的公开视图（不含执行器）。 */
export interface CommandView {
  name: string;
  title: string;
  description: string;
  argsHint?: string;
  kind: CommandKind;
  source: string;
}

/** 注册命令的入参。 */
export interface CommandRegistration {
  name: string;
  title: string;
  description: string;
  argsHint?: string;
  kind: CommandKind;
  /** 命令来源标识（插件包名），用于界面分组与卸载清理。 */
  source: string;
  /** 执行器：args 为用户在命令后输入的内容；返回提示词或回执。 */
  execute(args: string): Promise<{ prompt?: string; message?: string }>;
}

/** 命令名合法化：去掉前导 /、仅保留小写字母数字与连字符。 */
export function normalizeCommandName(raw: string): string {
  return raw.trim().replace(/^\//u, "").toLowerCase().replace(/[^a-z0-9-]/gu, "");
}

/** 命令注册表：支持重复注册覆盖、按来源卸载与稳定排序。 */
export class CommandRegistry {
  private readonly commands = new Map<string, CommandRegistration>();

  register(registration: CommandRegistration): () => void {
    const name = normalizeCommandName(registration.name);
    if (!name) throw new Error("命令名不能为空。");
    const entry = { ...registration, name };
    this.commands.set(name, entry);
    return () => {
      if (this.commands.get(name) === entry) this.commands.delete(name);
    };
  }

  /** 注销某个来源注册的全部命令（插件卸载时调用）。 */
  unregisterSource(source: string): void {
    for (const [name, entry] of this.commands) {
      if (entry.source === source) this.commands.delete(name);
    }
  }

  list(): CommandView[] {
    return [...this.commands.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ execute: _execute, ...view }) => view);
  }

  get(name: string): CommandRegistration | undefined {
    return this.commands.get(normalizeCommandName(name));
  }

  /** 执行命令；未知命令返回 undefined，执行器异常向上抛出。 */
  async run(name: string, args = ""): Promise<{ prompt?: string; message?: string } | undefined> {
    const command = this.get(name);
    if (!command) return undefined;
    return command.execute(args.trim());
  }
}

/** 内置命令：帮助与总结为 prompt 命令，便于走通注册-发现-执行链路。 */
export function registerBuiltinCommands(registry: CommandRegistry): void {
  registry.register({
    name: "summarize",
    title: "总结会话",
    description: "把当前会话的关键结论整理成要点。",
    kind: "prompt",
    source: "@lfaa/commands",
    execute: async () => ({
      prompt: "请把当前会话到目前为止的关键结论整理成要点：先列出已完成事项，再列出未完成项与风险，最后给出下一步建议。",
    }),
  });
  registry.register({
    name: "explain",
    title: "解释上一条",
    description: "要求模型用更简单的语言解释最近一次回答。",
    kind: "prompt",
    source: "@lfaa/commands",
    execute: async (args) => ({
      prompt: `请用更简单、更具体的语言解释你最近一次回答的核心结论${args ? `，重点说明：${args}` : ""}。`,
    }),
  });
}

/** Host 侧命令服务，挂载为 `ctx.commands`。 */
export class CommandsService extends Service {
  readonly registry = new CommandRegistry();

  constructor(ctx: Context) {
    super(ctx, "commands");
    registerBuiltinCommands(this.registry);
  }

  register(registration: CommandRegistration): () => void {
    return this.registry.register(registration);
  }

  list(): CommandView[] {
    return this.registry.list();
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

/** 处理 /api/commands：GET 列出命令、POST /run 执行命令。 */
export function createCommandsHttpHandler(service: CommandsService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "/", "http://127.0.0.1");
    if (!urlObj.pathname.startsWith("/api/commands")) return false;
    const method = (req.method ?? "GET").toUpperCase();
    try {
      if (urlObj.pathname === "/api/commands" && method === "GET") {
        sendJson(res, 200, { commands: service.list() });
        return true;
      }
      if (urlObj.pathname === "/api/commands/run" && method === "POST") {
        const body = await readJsonBody(req);
        const name = typeof body.name === "string" ? body.name : "";
        if (!normalizeCommandName(name)) throw new Error("缺少命令名。");
        const args = typeof body.args === "string" ? body.args : "";
        const result = await service.registry.run(name, args);
        if (!result) {
          sendJson(res, 404, { error: `未知命令：/${normalizeCommandName(name)}` });
          return true;
        }
        sendJson(res, 200, { ok: true, ...result });
        return true;
      }
      res.setHeader("Allow", "GET, POST");
      sendJson(res, 405, { error: "命令接口只支持 GET 与 POST /api/commands/run。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}

/** 为 Host 上下文注册命令服务。 */
export function commandsPlugin(ctx: Context): void {
  new CommandsService(ctx);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    commands: CommandsService;
  }
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default commandsPlugin;