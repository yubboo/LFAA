// 浏览器 Cordis 插件：向设置中心注册 MCP 页面，卸载时撤销视图贡献。
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { McpSettings } from "./settings/Mcp-Settings";

export function mcpClientPlugin(ctx: Context): void {
  const dispose = ctx.workbench.registerView({
    id: "settings:mcp",
    title: "MCP",
    render: () => <McpSettings isZh={document.documentElement.lang.toLowerCase().startsWith("zh")} />,
  });
  ctx.effect(() => dispose);
}
mcpClientPlugin.inject = ["workbench"] as const;
