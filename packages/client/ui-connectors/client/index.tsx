// 浏览器 Cordis 插件：向设置中心注册「连接器」页面（MCP 服务器 + 命令行工具），卸载时撤销视图贡献。
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { ConnectorsSettings } from "./connectors/Connectors-Settings";

export function connectorsClientPlugin(ctx: Context): void {
  const dispose = ctx.workbench.registerView({
    id: "settings:connectors",
    title: "连接器",
    render: () => <ConnectorsSettings isZh={document.documentElement.lang.toLowerCase().startsWith("zh")} />,
  });
  ctx.effect(() => dispose);
}
connectorsClientPlugin.inject = ["workbench"] as const;