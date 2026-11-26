// 连接器聚合服务：把 MCP 服务器与 CLI 工具统一成一份列表，并把每个 CLI 动作注册成受审批约束的工具。
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Service, type Context } from "@deepseek-ai/cordis";
import "@lfaa/mcp";
import type { ToolExecutionContext, ToolsService } from "@lfaa/tools";
import type {
  CatalogEntry,
  CatalogItem,
  CatalogJob,
  CliActionConfig,
  CliConnectorConfig,
  ConnectorProbeResult,
  ConnectorStatus,
  ConnectorSummary,
  ConnectorTemplate,
  ConnectorTestResult,
} from "../contract";
import { CONNECTOR_CATALOG } from "./catalog";
import { runCatalogConnect } from "./catalog-runner";
import { ConnectorConfigError, parseCliConnector, parseConnectorImport } from "./cli-config";
import { probeExecutable, resolveExecutable, runProcess } from "./cli-exec";
import { CONNECTOR_TEMPLATES } from "./cli-templates";
import type { ConnectorStore } from "./config-store";

const TRANSPORT_NAMES = { stdio: "Stdio", http: "Streamable HTTP", sse: "SSE" } as const;

interface CliRuntime {
  status: ConnectorStatus;
  detail: string;
  unregister: Array<() => void>;
}

/** 把连接器与动作拼成稳定的工具名；超长或含非法字符时退回带摘要的短名。 */
function toolName(connectorId: string, actionId: string): string {
  const plain = `cli__${connectorId}__${actionId}`;
  if (plain.length <= 64 && /^[a-z0-9_-]+$/u.test(plain)) return plain;
  const digest = createHash("sha256").update(JSON.stringify([connectorId, actionId])).digest("hex").slice(0, 16);
  const short = (value: string, max: number) => value.replace(/[^a-z0-9_]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, max) || "x";
  return `cli__${short(connectorId, 17)}__${short(actionId, 20)}_${digest}`;
}

/** 参数表映射成工具的 JSON Schema：类型、说明、枚举、默认值与必填。 */
function actionSchema(action: CliActionConfig): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, param] of Object.entries(action.params)) {
    const schema: Record<string, unknown> = { type: param.type, description: param.description };
    if (param.enum) schema.enum = param.enum;
    if (param.default !== undefined) schema.default = param.default;
    properties[name] = schema;
    if (param.required) required.push(name);
  }
  return { type: "object", properties, ...(required.length > 0 ? { required } : {}), additionalProperties: false };
}

/** 把声明的 `${env:NAME}` 引用换成宿主环境变量；字面值原样传给子进程。 */
function resolveEnv(env: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const reference = /^\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/u.exec(value);
    if (!reference) {
      resolved[key] = value;
      continue;
    }
    const found = process.env[reference[1] ?? ""];
    if (found !== undefined) resolved[key] = found;
  }
  return resolved;
}

/** 按动作模板拼 argv：参数逐一校验，占位符只在已声明的参数里替换。 */
function buildArgv(action: CliActionConfig, args: Record<string, unknown>): string[] {
  const values: Record<string, string> = {};
  for (const [name, param] of Object.entries(action.params)) {
    const raw = args[name] ?? param.default;
    if (raw === undefined || raw === null || raw === "") {
      if (param.required) throw new ConnectorConfigError(`缺少参数 ${name}。`);
      continue;
    }
    if (param.type === "number") {
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value)) throw new ConnectorConfigError(`参数 ${name} 必须是数字。`);
      values[name] = String(value);
      continue;
    }
    if (param.type === "boolean") {
      if (typeof raw !== "boolean") throw new ConnectorConfigError(`参数 ${name} 必须是布尔值。`);
      values[name] = raw ? "true" : "false";
      continue;
    }
    const value = String(raw);
    if (param.enum && !param.enum.includes(value)) throw new ConnectorConfigError(`参数 ${name} 取值不在允许范围内。`);
    values[name] = value;
  }
  const fill = (template: string) => template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (_, name: string) => values[name] ?? "");
  const argv: string[] = [];
  for (const entry of action.argv) {
    if (typeof entry === "string") {
      argv.push(fill(entry));
      continue;
    }
    if (entry.when && values[entry.when] !== "true") continue;
    if (entry.value !== undefined) {
      const value = fill(entry.value);
      // 可选值缺失时整项省略，避免留下一个空参数。
      if (!value) continue;
      argv.push(fill(entry.arg), value);
      continue;
    }
    argv.push(fill(entry.arg));
  }
  return argv;
}

/** 连接器聚合服务：CLI 走本机进程，MCP 复用既有服务只读展示。 */
export class ConnectorService extends Service {
  private readonly configs = new Map<string, CliConnectorConfig>();
  private readonly runtimes = new Map<string, CliRuntime>();
  private readonly registry: ToolsService;
  private readonly mcp: Context["mcp"];
  private readonly store: ConnectorStore;
  private readonly catalogEntries: CatalogEntry[];
  private readonly jobs = new Map<string, CatalogJob>();
  private pending: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private loadFailed = false;

  constructor(ctx: Context, store: ConnectorStore, catalogEntries: CatalogEntry[] = CONNECTOR_CATALOG) {
    super(ctx, "connectors");
    this.store = store;
    this.registry = ctx.tools;
    this.mcp = ctx.mcp;
    this.catalogEntries = catalogEntries;
  }

  async start(): Promise<void> {
    try {
      for (const config of await this.store.load()) this.configs.set(config.id, config);
    } catch {
      this.loadFailed = true;
      return;
    }
    if (this.disposed) return;
    for (const config of this.configs.values()) {
      if (config.enabled) this.connect(config);
      else this.runtimes.set(config.id, { status: "disabled", detail: config.executable, unregister: [] });
    }
  }

  /** MCP 服务器在前、CLI 工具在后，前端按这个顺序渲染两个分组。 */
  list(): ConnectorSummary[] {
    if (this.loadFailed) throw new ConnectorConfigError("连接器配置无法读取，请检查 ~/.lfaa/connectors.json。");
    const mcp = this.mcp.list().map((server): ConnectorSummary => ({
      id: server.id,
      kind: "mcp",
      name: server.id,
      description: TRANSPORT_NAMES[server.transport],
      enabled: server.enabled,
      projectId: server.projectId,
      trust: server.trust,
      status: server.status === "connected" ? "ready"
        : server.status === "connecting" ? "connecting"
          : server.status === "error" ? "error" : "disabled",
      detail: TRANSPORT_NAMES[server.transport],
      tools: server.tools.map((tool) => ({ name: tool.name, title: tool.title, trust: tool.trust })),
      actions: [],
    }));
    const cli = [...this.configs.values()].map((config): ConnectorSummary => {
      const runtime = this.runtimes.get(config.id);
      const ready = runtime?.status === "ready";
      return {
        id: config.id,
        kind: "cli",
        name: config.name,
        description: config.description,
        enabled: config.enabled,
        projectId: config.projectId,
        trust: config.trust,
        status: runtime?.status ?? "disabled",
        detail: runtime?.detail ?? config.executable,
        // 与 MCP 一致：只有真正注册成功的动作才算工具，命令缺失时列表不应虚报数量。
        tools: ready ? config.actions.map((action) => ({
          name: toolName(config.id, action.id),
          title: action.title,
          trust: action.trust ?? "inherit" as const,
        })) : [],
        actions: config.actions.map((action) => ({
          id: action.id,
          title: action.title,
          readOnly: action.readOnly,
          ...(action.trust ? { trust: action.trust } : {}),
        })),
      };
    });
    return [...mcp, ...cli];
  }

  templates(): ConnectorTemplate[] {
    return CONNECTOR_TEMPLATES.map((template) => structuredClone(template));
  }

  /** 取单个 CLI 连接器的完整配置，供编辑弹窗回填动作与环境变量。 */
  get(id: string): CliConnectorConfig {
    return structuredClone(this.require(id));
  }

  /** 新建或更新 CLI 连接器；`create` 用于防止静默覆盖同名连接器。 */
  save(id: string, payload: unknown, create: boolean): Promise<void> {
    return this.mutate(() => {
      const previous = this.configs.get(id);
      if (create === Boolean(previous)) {
        throw new ConnectorConfigError(create ? "同名连接器已存在。" : "连接器不存在。");
      }
      return [parseCliConnector(id, payload, previous)];
    });
  }

  remove(id: string): Promise<void> {
    return this.mutate(() => { this.require(id); return []; }, id);
  }

  /** 导入一个或多个连接器；导入项一律停用，启用与审批由用户显式确认。 */
  import(payload: unknown): Promise<void> {
    return this.mutate(() => {
      const configs = parseConnectorImport(payload);
      for (const config of configs) {
        if (this.configs.has(config.id)) throw new ConnectorConfigError(`连接器 ${config.id} 已存在，请先改名或删除。`);
      }
      return configs;
    });
  }

  /** 探测可执行文件并运行探测参数；成功时重连以补登此前因找不到命令而缺失的工具。 */
  async test(id: string): Promise<ConnectorTestResult> {
    const config = this.require(id);
    const result = await probeExecutable(config.executable, config.probeArgs);
    if (!result.error) {
      if (config.enabled) this.connect(config);
      const runtime = this.runtimes.get(id);
      if (runtime && result.path) runtime.detail = result.version ? `${result.path} · ${result.version}` : result.path;
    }
    if (result.error) return { ok: false, detail: result.error };
    return { ok: true, detail: result.version ? `${result.path} · ${result.version}` : (result.path ?? "") };
  }

  /** 添加前探测任意可执行文件，返回解析路径与首行版本。 */
  probe(executable: string, args?: readonly string[]): Promise<ConnectorProbeResult> {
    return probeExecutable(executable, args);
  }

  /** 目录条目与当前连接状态：MCP 看服务器是否存在，CLI 看配置与运行状态。 */
  catalog(): CatalogItem[] {
    const servers = new Map(this.mcp.list().map((server) => [server.id, server]));
    return this.catalogEntries.map((entry): CatalogItem => {
      if (entry.kind === "mcp") {
        const server = servers.get(entry.id);
        const status: ConnectorStatus = !server ? "disabled"
          : server.status === "connected" ? "ready"
            : server.status === "connecting" ? "connecting"
              : server.status === "error" ? "error" : "disabled";
        return { ...structuredClone(entry), connected: Boolean(server), status, toolCount: server?.tools.length ?? 0, actionCount: 0 };
      }
      const config = this.configs.get(entry.id);
      const runtime = this.runtimes.get(entry.id);
      const ready = runtime?.status === "ready";
      return {
        ...structuredClone(entry),
        connected: Boolean(config),
        status: runtime?.status ?? "disabled",
        toolCount: ready ? (config?.actions.length ?? 0) : 0,
        actionCount: config?.actions.length ?? 0,
      };
    });
  }

  /** 启动一个连接任务；同一目录条目只允许一个进行中的任务。 */
  connectCatalog(id: string, inputs: Record<string, string> = {}): CatalogJob {
    const entry = this.catalogEntries.find((item) => item.id === id);
    if (!entry) throw new ConnectorConfigError(`未找到连接器 ${id}。`);
    const running = [...this.jobs.values()].find((job) => job.entryId === id && job.state === "running");
    if (running) return running;
    const job: CatalogJob = { id: randomUUID(), entryId: id, state: "running", message: `正在连接 ${entry.name}…`, startedAt: Date.now() };
    this.jobs.set(job.id, job);
    this.pruneJobs();
    void runCatalogConnect(job, entry, inputs, {
      listMcp: () => this.mcp.list(),
      saveMcp: (serverId, payload, create) => this.mcp.save(serverId, payload, create),
      hasCli: (connectorId) => this.configs.has(connectorId),
      saveCli: (connectorId, payload, create) => this.save(connectorId, payload, create),
    }).catch((failure: unknown) => {
      job.state = "error";
      job.message = failure instanceof Error ? failure.message : `连接 ${entry.name} 失败。`;
    });
    return job;
  }

  /** 断开并移除目录条目对应的 MCP 服务器或 CLI 连接器。 */
  async disconnectCatalog(id: string): Promise<void> {
    const entry = this.catalogEntries.find((item) => item.id === id);
    if (!entry) throw new ConnectorConfigError(`未找到连接器 ${id}。`);
    if (entry.kind === "mcp") {
      await this.mcp.remove(id);
      return;
    }
    if (this.configs.has(id)) await this.remove(id);
  }

  /** 查询连接任务进度。 */
  job(id: string): CatalogJob | null {
    return this.jobs.get(id) ?? null;
  }

  private pruneJobs(): void {
    if (this.jobs.size <= 50) return;
    const finished = [...this.jobs.values()].filter((job) => job.state !== "running").sort((a, b) => a.startedAt - b.startedAt);
    for (const job of finished.slice(0, this.jobs.size - 50)) this.jobs.delete(job.id);
  }

  dispose(): void {
    this.disposed = true;
    for (const id of [...this.runtimes.keys()]) this.disconnect(id);
  }

  private require(id: string): CliConnectorConfig {
    const config = this.configs.get(id);
    if (!config) throw new ConnectorConfigError("连接器不存在。");
    return config;
  }

  private mutate(change: () => CliConnectorConfig[], removeId?: string): Promise<void> {
    const work = this.pending.then(async () => {
      if (this.disposed || this.loadFailed) throw new ConnectorConfigError("连接器配置不可用。");
      const changed = change();
      const next = new Map(this.configs);
      if (removeId !== undefined) next.delete(removeId);
      for (const config of changed) next.set(config.id, config);
      await this.store.save([...next.values()]);
      if (this.disposed) return;
      if (removeId !== undefined) {
        this.configs.delete(removeId);
        this.disconnect(removeId);
      }
      for (const config of changed) {
        this.configs.set(config.id, config);
        if (config.enabled) this.connect(config);
        else this.disconnect(config.id);
      }
    });
    this.pending = work.catch(() => undefined);
    return work;
  }

  private disconnect(id: string): void {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    this.runtimes.delete(id);
    for (const unregister of runtime.unregister) unregister();
  }

  private connect(config: CliConnectorConfig): void {
    this.disconnect(config.id);
    const path = resolveExecutable(config.executable);
    if (!path) {
      this.runtimes.set(config.id, { status: "error", detail: `未找到 ${config.executable}`, unregister: [] });
      return;
    }
    const unregister: Array<() => void> = [];
    for (const action of config.actions) unregister.push(this.registry.registerTool(this.tool(config, action, path)));
    this.runtimes.set(config.id, { status: "ready", detail: path, unregister });
  }

  private tool(config: CliConnectorConfig, action: CliActionConfig, executablePath: string) {
    return {
      moduleName: "@lfaa/connectors",
      ...(config.projectId ? { projectId: config.projectId } : {}),
      approval: (action.trust ?? config.trust) === "trusted" ? "trusted" as const : "always" as const,
      name: toolName(config.id, action.id),
      title: `${config.name} · ${action.title}`,
      description: `${config.name} · ${action.title}${action.description ? `：${action.description}` : ""}（本机命令 ${config.executable}）`,
      permissionLevel: action.readOnly ? "read" as const : "exec" as const,
      parameters: actionSchema(action),
      execute: async (args: Record<string, unknown>, context: ToolExecutionContext) => {
        if (config.cwd && !existsSync(config.cwd)) {
          return { ok: false, output: `工作目录不存在：${config.cwd}`, summary: `${action.title} · 目录不存在` };
        }
        let argv: string[];
        try {
          argv = buildArgv(action, args);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { ok: false, output: message, summary: `${action.title} · 参数无效` };
        }
        const result = await runProcess(executablePath, argv, {
          ...(config.cwd ? { cwd: config.cwd } : context.workspaceRoots[0] ? { cwd: context.workspaceRoots[0] } : {}),
          env: { ...process.env, ...resolveEnv(config.env) },
          ...(action.timeoutMs ? { timeoutMs: action.timeoutMs } : {}),
          signal: context.signal,
        });
        if (result.aborted) return { ok: false, output: "已取消。", summary: `${action.title} · 已取消` };
        if (result.timedOut) return { ok: false, output: "命令执行超时，已终止进程。", summary: `${action.title} · 超时` };
        const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
        const truncated = result.truncated ? "\n…（输出已截断）" : "";
        const exit = result.code === 0 ? "" : `\n退出码 ${result.code ?? "未知"}`;
        return {
          ok: result.code === 0,
          output: (output || `(无输出)${exit}`) + truncated,
          summary: `${action.title}${result.code === 0 ? "" : " · 失败"}`,
          metadata: { connector: config.id, action: action.id, exit: result.code },
        };
      },
    };
  }
}