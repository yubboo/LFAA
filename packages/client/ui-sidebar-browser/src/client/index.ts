/** 功能：登记浏览器 Dock 界面。作用：通过 Client Module Loader 按需装载并在卸载时撤销。关联文件：BrowserPanel.tsx、package.json。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-client-modules/src/client/index.js";

export const inject = ["clientModules"];

export function apply(ctx: Context): void {
  ctx.clientModules.register(ctx, "lfaa-client-ui-sidebar-browser/src/BrowserPanel.js", () => import("../BrowserPanel.js"));
}
