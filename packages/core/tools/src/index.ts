// @lfaa/tools Host 侧 Cordis 服务：统一管理工具注册表、内置工作区工具与权限安全执行。
import { resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import type { SandboxDecision, SandboxPolicy } from "./types";
import type { ShellService } from "@lfaa/shell";
import { createBuiltinWorkspaceTools } from "./builtin-tools";
import { createEditTools } from "./edit-tools";
import { createSearchTools } from "./search-tools";
import type {
  AgentToolDefinition,
  CommandTimeoutFallbackInput,
  CommandTimeoutFallbackResult,
  CommandTimeoutHandler,
  PublicToolSummary,
  SandboxModeResolver,
  ToolExecutionContext,
  ToolExecutionMiddleware,
  ToolExecutionResult,
  ToolMiddlewareInfo,
} from "./types";

export * from "./types";
export { appendCommandAudit, findProtectedPathInCommand, type CommandAuditEntry } from "@lfaa/guard";
export { createBuiltinWorkspaceTools } from "./builtin-tools";
export { createEditTools } from "./edit-tools";
export { createSearchTools, globToRegExp } from "./search-tools";
export { walkWorkspaceFiles } from "@lfaa/fs";
export { resolveSafeWorkspacePath, resolveSafeWorkspaceRoot } from "@lfaa/fs";

/** 配置 Host 启动时装载的工具定义。 */
export interface ToolsPluginConfig {
  includeBuiltins?: boolean;
  executeCommand?: ShellService["execute"];
  describeCommandShell?: () => Promise<string>;
  /** 执行前沙箱判定；未装配时不做限制（由调用方自行保证边界）。 */
  sandbox?: {
    checkWrite(targetPath: string, policy: SandboxPolicy): SandboxDecision;
    checkCommand(command: string, policy: SandboxPolicy): SandboxDecision;
  };
  /** 前台命令超时后转后台任务的可选兜底，由 Jobs 服务在装配时注册。 */
  onCommandTimeout?: CommandTimeoutHandler;
}

// Host 侧工具服务（Agent 手脚注册表与执行调度）。
/** agent 级工具策略：allow 非空时只放行名单内，deny 永远剔除。 */
export interface ToolPolicy {
  allow?: readonly string[];
  deny?: readonly string[];
}

/** 策略是否真的收紧；空策略等于不限制。 */
export function hasToolPolicy(policy: ToolPolicy | undefined): boolean {
  return Boolean(policy && ((policy.allow?.length ?? 0) > 0 || (policy.deny?.length ?? 0) > 0));
}

/** 单个工具是否被策略放行；纯函数，便于单测且被视图与执行两处共用。 */
export function isToolAllowed(policy: ToolPolicy | undefined, name: string): boolean {
  if (!policy) return true;
  if (policy.deny?.includes(name)) return false;
  const allow = policy.allow ?? [];
  return allow.length === 0 || allow.includes(name);
}

export class ToolsService extends Service {
  private readonly registry = new Map<string, AgentToolDefinition>();
  private readonly middlewares = new Map<string, ToolExecutionMiddleware>();
  private sandboxResolver: SandboxModeResolver | null = null;
  private commandTimeoutHandler: CommandTimeoutHandler | null;
  private readonly sandbox: ToolsPluginConfig["sandbox"];

  constructor(ctx: Context, private readonly config: ToolsPluginConfig = {}) {
    super(ctx, "tools");
    this.commandTimeoutHandler = config.onCommandTimeout ?? null;
    this.sandbox = config.sandbox;
    if (config.includeBuiltins !== false) {
      const tools = [
        ...createBuiltinWorkspaceTools(config.executeCommand, {
          onCommandTimeout: (input) => this.handleCommandTimeout(input),
        }),
        ...createEditTools(),
        ...createSearchTools(),
      ];
      for (const tool of tools) {
        this.registry.set(tool.name, { ...tool, moduleName: "@lfaa/tools" });
      }
    }
  }

  registerTool(definition: AgentToolDefinition): () => void {
    this.registry.set(definition.name, definition);
    return () => {
      if (this.registry.get(definition.name) === definition) {
        this.registry.delete(definition.name);
      }
    };
  }

  /** 后台任务服务注册前台超时兜底；返回注销函数，卸载后恢复为无兜底。 */
  setCommandTimeoutHandler(handler: CommandTimeoutHandler | null): () => void {
    this.commandTimeoutHandler = handler;
    return () => {
      if (this.commandTimeoutHandler === handler) {
        this.commandTimeoutHandler = null;
      }
    };
  }

  private async handleCommandTimeout(input: CommandTimeoutFallbackInput): Promise<CommandTimeoutFallbackResult | null> {
    if (!this.commandTimeoutHandler) return null;
    try {
      return await this.commandTimeoutHandler(input);
    } catch {
      return null;
    }
  }

  getTool(name: string): AgentToolDefinition | undefined {
    return this.registry.get(name);
  }

  /** 同一份会话策略用于模型声明、审批前查询和执行时校验。 */
  scope(modules: ReadonlySet<string>, readOnly = false): ToolsService {
    const allowsTool = (name: string) => {
      const tool = this.getTool(name);
      return Boolean(tool?.moduleName && modules.has(tool.moduleName) && (!readOnly || tool.permissionLevel === "read"));
    };
    const view = Object.create(this) as ToolsService;
    view.getTool = (name) => allowsTool(name) ? this.getTool(name) : undefined;
    view.getLlmToolSchemas = () => this.getLlmToolSchemas().filter(({ name }) => allowsTool(name));
    view.executeTool = (name, args, context) => this.executeTool(name, args, {
      ...context,
      allowsTool: (candidate) => allowsTool(candidate) && (context.allowsTool?.(candidate) ?? true),
    });
    return view;
  }

  /**
   * 按 agent 的工具策略收窄可见工具：allow 非空时只放行名单内，deny 永远剔除。
   * 返回原型视图，与 scope() 一致——模型声明、审批与执行三处看到的是同一份策略。
   */
  withPolicy(policy: ToolPolicy | undefined): ToolsService {
    if (!hasToolPolicy(policy)) return this;
    const permits = (name: string) => isToolAllowed(policy, name);
    const view = Object.create(this) as ToolsService;
    view.getTool = (name) => permits(name) ? this.getTool(name) : undefined;
    view.getLlmToolSchemas = () => this.getLlmToolSchemas().filter(({ name }) => permits(name));
    view.executeTool = (name, args, context) => {
      // 执行时必须再拦一次：模型可能凭历史记忆调用已在策略外被藏起来的工具，返回结构化拒绝避免崩溃整轮运行；同时组合 allowsTool 防止子智能体绕过策略。
      if (!permits(name)) {
        return Promise.resolve({
          ok: false,
          output: `工具 ${name} 已被当前 agent 的工具策略禁用。`,
          summary: "工具不可用",
        });
      }
      return this.executeTool(name, args, {
        ...context,
        allowsTool: (candidate) => permits(candidate) && (context.allowsTool?.(candidate) ?? true),
      });
    };
    return view;
  }

  describeCommandShell(): Promise<string> {
    return this.config.describeCommandShell?.() ?? Promise.resolve("");
  }

  listDefinitions(): PublicToolSummary[] {
    return [...this.registry.values()].map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      permissionLevel: tool.permissionLevel,
      parameters: tool.parameters,
    }));
  }

  getLlmToolSchemas(): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    return [...this.registry.values()].map((tool) => ({
      name: tool.name,
      description: `[${tool.permissionLevel}] ${tool.description}`,
      parameters: tool.parameters,
    }));
  }

  /** 执行前按策略判定写入与命令；拒绝时返回可展示原因，不执行工具本体。 */
  private checkSandbox(
    name: string,
    args: Record<string, unknown>,
    execContext: ToolExecutionContext,
  ): string | null {
    if (!this.sandbox) return null;
    const mode = execContext.sandboxMode ?? "workspace-write";
    const policy: SandboxPolicy = { mode, workspaceRoots: execContext.workspaceRoots };
    if (name === "write_file" || name === "edit_file") {
      const rawPath = typeof args.path === "string" ? args.path : "";
      const base = execContext.workspaceRoots[0] ?? process.cwd();
      const target = rawPath.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(rawPath) ? rawPath : resolve(base, rawPath);
      const decision = this.sandbox.checkWrite(target, policy);
      return decision.allowed ? null : decision.reason;
    }
    if (name === "run_command" || name === "start_background_task") {
      const command = typeof args.command === "string" ? args.command : "";
      const decision = this.sandbox.checkCommand(command, policy);
      return decision.allowed ? null : decision.reason;
    }
    return null;
  }

  /** 注册执行中间件（超时、结果精简、落盘等策略），返回注销函数。 */
  useToolMiddleware(middleware: ToolExecutionMiddleware): () => void {
    const id = middleware.id.trim();
    if (!id) throw new Error("工具中间件的 id 不能为空。");
    this.middlewares.set(id, middleware);
    return () => {
      if (this.middlewares.get(id) === middleware) this.middlewares.delete(id);
    };
  }

  /** 注册逐次沙箱策略；返回注销函数。策略返回 undefined 时沿用调用方模式。 */
  setSandboxResolver(resolver: SandboxModeResolver | null): () => void {
    this.sandboxResolver = resolver;
    return () => {
      if (this.sandboxResolver === resolver) this.sandboxResolver = null;
    };
  }

  /** 按注册顺序把中间件套在真实执行外并改写结果；任一中间件抛错按工具执行失败处理。 */
  private async runWithMiddleware(
    tool: AgentToolDefinition,
    args: Record<string, unknown>,
    execContext: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const wrappers = [...this.middlewares.values()].filter((middleware) => middleware.aroundExecute);
    const invoke = (index: number, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
      const middleware = wrappers[index];
      if (!middleware?.aroundExecute) return tool.execute(args, context);
      return middleware.aroundExecute(
        (nextContext) => invoke(index + 1, nextContext ?? context),
        { name: tool.name, args, context },
      );
    };
    const info: ToolMiddlewareInfo = { name: tool.name, args, context: execContext };
    let result = await invoke(0, execContext);
    for (const middleware of this.middlewares.values()) {
      if (middleware.afterExecute) result = await middleware.afterExecute(result, info);
    }
    return result;
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    execContext: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    if (execContext.allowsTool?.(name) === false) {
      return { ok: false, output: `当前会话或子任务不能调用工具：${name}`, summary: "工具不可用" };
    }
    const tool = this.registry.get(name);
    if (!tool) {
      return {
        ok: false,
        output: `未注册的工具：${name}`,
        summary: `工具不存在: ${name}`,
      };
    }
    const resolvedMode = this.sandboxResolver?.(name, args, execContext);
    const context = resolvedMode ? { ...execContext, sandboxMode: resolvedMode } : execContext;
    const denial = this.checkSandbox(name, args, context);
    if (denial) {
      return { ok: false, output: denial, summary: `沙箱拒绝: ${denial.slice(0, 60)}` };
    }
    try {
      return await this.runWithMiddleware(tool, args, context);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        output: msg,
        summary: `执行失败: ${msg.slice(0, 60)}`,
      };
    }
  }
}

/** 向 Cordis 注册工具查询和执行入口，供 Agent 注入使用。 */
export function toolsPlugin(context: Context, config: ToolsPluginConfig = {}): void {
  new ToolsService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    tools: ToolsService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default toolsPlugin;
