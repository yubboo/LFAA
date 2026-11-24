// Cordis MCP 服务：串行提交配置、独立管理连接，并随连接生命周期注销工具。
import { createHash } from "node:crypto";
import { Service, type Context } from "@deepseek-ai/cordis";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ToolsService } from "@lfaa/tools";
import type { McpServerSummary, McpStatus, McpToolSummary } from "../contract";
import { ConfigStore } from "./config-store";
import { createConnection, discoverTools, type RemoteTool } from "./connection";
import { McpConfigError, parseImport, parseServer, type ServerConfig } from "./server-config";

interface Connection {
  client: Client;
  controller: AbortController;
  tools: McpToolSummary[];
  unregister: (() => void)[];
  status: McpStatus;
}

function toolName(server: string, name: string): string {
  const normalize = (part: string) => part.replace(/[^a-zA-Z0-9-]+/gu, "_").replace(/^_|_$/gu, "");
  const plain = "mcp__" + server + "__" + name;
  const safe = /^[a-zA-Z0-9-]+(?:_[a-zA-Z0-9-]+)*$/u;
  if (safe.test(server) && safe.test(name) && plain.length <= 64) return plain;
  const digest = createHash("sha256").update(JSON.stringify([server, name])).digest("hex").slice(0, 16);
  return "mcp__" + normalize(server).slice(0, 17) + "__" + normalize(name).slice(0, 22) + "_" + digest;
}

export class McpService extends Service {
  private readonly configs = new Map<string, ServerConfig>();
  private readonly connections = new Map<string, Connection>();
  private pending: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private loadFailed = false;

  private readonly registry: ToolsService;

  constructor(ctx: Context, private readonly store: ConfigStore) {
    super(ctx, "mcp");
    this.registry = ctx.tools;
  }

  async start(): Promise<void> {
    try {
      const configs = await this.store.load();
      if (this.disposed) return;
      for (const cfg of configs) this.configs.set(cfg.id, cfg);
      for (const cfg of configs) if (cfg.enabled) this.connect(cfg);
    } catch {
      this.loadFailed = true;
    }
  }

  list(): McpServerSummary[] {
    if (this.loadFailed) throw new Error("MCP configuration could not be read.");
    return [...this.configs.values()].map(({ id, transport, enabled, projectId, trust }) => {
      const connection = this.connections.get(id);
      return { id, transport, enabled, projectId, trust, status: connection?.status ?? "disabled", tools: connection?.tools ?? [] };
    });
  }

  save(id: string, payload: unknown, create: boolean): Promise<void> {
    return this.mutate(() => {
      const previous = this.configs.get(id);
      if (create === Boolean(previous)) throw new McpConfigError(create ? "Server name already exists." : "Server not found.");
      return [parseServer(id, payload, previous)];
    });
  }

  import(payload: unknown): Promise<void> {
    return this.mutate(() => {
      const configs = parseImport(payload);
      if (configs.some(({ id }) => this.configs.has(id))) throw new McpConfigError("An imported server name already exists.");
      return configs;
    });
  }

  remove(id: string): Promise<void> {
    return this.mutate(() => { this.require(id); return []; }, id);
  }

  /** 使用临时连接测试握手和工具发现，不改变启用状态或注册表。 */
  async test(id: string): Promise<number> {
    const config = this.require(id);
    const existing = this.connections.get(id);
    if (existing?.status === "connected") {
      try {
        return (await discoverTools(existing.client, existing.controller.signal)).length;
      } catch (cause) {
        throw new McpConfigError("Connection test failed. Check the server configuration and try again.", { cause });
      }
    }
    const { client, connect } = createConnection(config);
    const controller = new AbortController();
    this.tests.add(controller);
    const cancel = () => { void client.close().catch(() => undefined); };
    controller.signal.addEventListener("abort", cancel, { once: true });
    try {
      return (await connect(controller.signal).then(() => discoverTools(client, controller.signal))).length;
    } catch (cause) {
      throw new McpConfigError("Connection test failed. Check the server configuration and try again.", { cause });
    } finally {
      this.tests.delete(controller);
      await client.close().catch(() => undefined);
    }
  }

  private readonly tests = new Set<AbortController>();

  reconnect(id: string): void {
    const config = this.require(id);
    if (!config.enabled) throw new McpConfigError("Enable the server before reconnecting.");
    this.connect(config);
  }

  dispose(): void {
    this.disposed = true;
    for (const test of this.tests) test.abort();
    for (const id of this.connections.keys()) this.disconnect(id);
  }

  private require(id: string): ServerConfig {
    const config = this.configs.get(id);
    if (!config) throw new McpConfigError("Server not found.");
    return config;
  }

  private mutate(change: () => ServerConfig[], removeId?: string): Promise<void> {
    const work = this.pending.then(async () => {
      if (this.disposed || this.loadFailed) throw new Error("MCP configuration is unavailable.");
      const changed = change();
      const next = new Map(this.configs);
      if (removeId !== undefined) next.delete(removeId);
      for (const cfg of changed) next.set(cfg.id, cfg);
      await this.store.save([...next.values()]);
      if (this.disposed) return;
      if (removeId !== undefined) {
        this.configs.delete(removeId);
        this.disconnect(removeId);
      }
      for (const cfg of changed) {
        this.configs.set(cfg.id, cfg);
        if (cfg.enabled) this.connect(cfg);
        else this.disconnect(cfg.id);
      }
    });
    this.pending = work.catch(() => undefined);
    return work;
  }

  private disconnect(id: string): void {
    const connection = this.connections.get(id);
    if (!connection) return;
    this.connections.delete(id);
    delete connection.client.onclose;
    connection.controller.abort();
    for (const unregister of connection.unregister) unregister();
    void connection.client.close().catch(() => undefined);
  }

  private connect(cfg: ServerConfig): void {
    this.disconnect(cfg.id);
    const { client, connect } = createConnection(cfg);
    const connection: Connection = { client, controller: new AbortController(), tools: [], unregister: [], status: "connecting" };
    this.connections.set(cfg.id, connection);
    const fail = () => {
      if (this.connections.get(cfg.id) !== connection) return;
      this.disconnect(cfg.id);
      connection.status = "error";
      connection.tools = [];
      connection.unregister = [];
      this.connections.set(cfg.id, connection);
    };
    client.onclose = fail;
    void connect(connection.controller.signal).then(() => discoverTools(client, connection.controller.signal)).then((tools) => {
      if (connection.controller.signal.aborted) return;
      for (const tool of tools) this.register(cfg, connection, tool);
      connection.status = "connected";
    }).catch(fail);
  }

  private register(cfg: ServerConfig, connection: Connection, tool: RemoteTool): void {
    const name = toolName(cfg.id, tool.name);
    const title = tool.title ?? tool.name;
    const trust = Object.hasOwn(cfg.toolTrust, tool.name) ? cfg.toolTrust[tool.name] : undefined;
    connection.tools.push({ name: tool.name, title, trust: trust ?? "inherit" });
    connection.unregister.push(this.registry.registerTool({
      moduleName: "@lfaa/mcp", name, title,
      description: tool.description ?? title,
      permissionLevel: "exec",
      approval: (trust ?? cfg.trust) === "trusted" ? "trusted" : "always",
      ...(cfg.projectId ? { projectId: cfg.projectId } : {}),
      parameters: tool.inputSchema,
      execute: async (args, context) => {
        const signal = AbortSignal.any([context.signal, connection.controller.signal]);
        try {
          const result = await connection.client.callTool({ name: tool.name, arguments: args }, undefined, { signal, timeout: 60_000 });
          const ok = result.isError !== true;
          return { ok, output: JSON.stringify(result), summary: ok ? title : "MCP tool reported an error." };
        } catch {
          return { ok: false, output: "MCP tool call failed or was cancelled.", summary: "MCP tool call failed." };
        }
      },
    }));
  }
}
