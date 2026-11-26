// 连接器 Host 插件入口：装配聚合服务（MCP 只读展示 + CLI 工具）并公开 /api/connectors 路由。
import type { Plugin } from "@deepseek-ai/cordis";
import { getDefaultLfaaHome } from "@lfaa/storage";
import { join } from "node:path";
import { ConnectorStore } from "./config-store";
import { ConnectorService } from "./connector-service";

export { createConnectorsHttpHandler } from "./connector-routes";
export { ConnectorService } from "./connector-service";

const connectorsPlugin: Plugin.Object<{ file?: string }> = {
  name: "@lfaa/connectors",
  inject: ["tools", "mcp"],
  async apply(ctx, config) {
    const service = new ConnectorService(ctx, new ConnectorStore(config?.file ?? join(getDefaultLfaaHome(), "connectors.json")));
    ctx.effect(() => () => service.dispose());
    await service.start();
  },
};

declare module "@deepseek-ai/cordis" {
  interface Context { connectors: ConnectorService }
}

export default connectorsPlugin;