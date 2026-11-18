// @lfaa/tools Host 侧 Cordis 服务：统一管理工具注册表、内置工作区工具与权限安全执行。
import { type Context, Service } from "@deepseek-ai/cordis";
import { createBuiltinWorkspaceTools } from "./builtin-tools";
import type {
  AgentToolDefinition,
  PublicToolSummary,
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types";

export * from "./types";
export { resolveSafeWorkspacePath, resolveSafeWorkspaceRoot } from "./sandbox";

/** 配置 Host 启动时装载的工具定义。 */
export interface ToolsPluginConfig {
  includeBuiltins?: boolean;
}

// Host 侧工具服务（Agent 手脚注册表与执行调度）。
export class ToolsService extends Service {
  private readonly registry = new Map<string, AgentToolDefinition>();

  constructor(ctx: Context, config: ToolsPluginConfig = {}) {
    super(ctx, "tools");
    if (config.includeBuiltins !== false) {
      for (const tool of createBuiltinWorkspaceTools()) {
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

  getTool(name: string): AgentToolDefinition | undefined {
    return this.registry.get(name);
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
