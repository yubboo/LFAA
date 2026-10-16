/** 功能：登记独立插件管理页客户端模块。作用：由 Workbench 按需装载；插件事实仍由 Plugin Manager 提供。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-client-modules/src/client/index.js";

export const name = "lfaa-client-ui-plugin-manager";
export const inject = ["clientModules"];

export function apply(ctx: Context): void {
  ctx.clientModules.register(ctx, "lfaa-client-ui-plugin-manager/src/PluginManagerPage.js", () => import("../PluginManagerPage.js"));
}
