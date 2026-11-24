// MCP Host 插件入口，管理连接服务并公开设置路由。
import type { Plugin } from "@deepseek-ai/cordis";
import { getDefaultLfaaHome } from "@lfaa/storage";
import { join } from "node:path";
import { ConfigStore } from "./config-store";
import { McpService } from "./mcp-service";

export { createMcpHttpHandler } from "./mcp-routes";

const mcpPlugin: Plugin.Object<{ file?: string }> = {
  name: "@lfaa/mcp",
  inject: ["tools"],
  async apply(ctx, config) {
    const service = new McpService(ctx, new ConfigStore(config?.file ?? join(getDefaultLfaaHome(), "mcp-servers.json")));
    ctx.effect(() => () => service.dispose());
    await service.start();
  },
};

declare module "@deepseek-ai/cordis" {
  interface Context { mcp: McpService }
}

export default mcpPlugin;
