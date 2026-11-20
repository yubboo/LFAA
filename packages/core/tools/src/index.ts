// @lfaa/tools Host 侧 Cordis 服务：统一管理工具注册表、内置工作区工具与权限安全执行。
import { resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import type { SandboxDecision, SandboxPolicy } from "@lfaa/sandbox";
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
  ToolExecutionContext,
  ToolExecutionResult,
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
export class ToolsService extends Service {
  private readonly registry = new Map<string, AgentToolDefinition>();
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
        this.registry.set(tool.name, tool);
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
    if (name === "run_command") {
      const command = typeof args.command === "string" ? args.command : "";
      const decision = this.sandbox.checkCommand(command, policy);
      return decision.allowed ? null : decision.reason;
    }
    return null;
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    execContext: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      return {
        ok: false,
        output: `未注册的工具：${name}`,
        summary: `工具不存在: ${name}`,
      };
    }
    const denial = this.checkSandbox(name, args, execContext);
    if (denial) {
      return { ok: false, output: denial, summary: `沙箱拒绝: ${denial.slice(0, 60)}` };
    }
    try {
      return await tool.execute(args, execContext);
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
