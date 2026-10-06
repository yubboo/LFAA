/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-client-modules/src/client/index.js";
import { bindDshThemeEvents, dshThemeCompatibility } from "lfaa-client-ui-theme/src/dsh-theme-bridge.js";
import { dshLocaleRuntime } from "../dsh-locale-runtime.js";
import { sidebarRightRuntime } from "../sidebar-right-runtime.js";
export const inject = ["clientModules"];
export function apply(ctx: Context): void {
  ctx.provide("sidebarRightTabs", sidebarRightRuntime.tabsApi);
  ctx.provide("sidebarRight", sidebarRightRuntime.control);
  ctx.provide("shortcuts", sidebarRightRuntime.shortcutsApi);
  ctx.provide("theme", dshThemeCompatibility);
  ctx.provide("locale", dshLocaleRuntime);
  ctx.effect(() => bindDshThemeEvents(ctx));
  ctx.clientModules.register(ctx, "lfaa-client-ui-workspace/src/ApplicationWorkspace.js", () => import("../ApplicationWorkspace.js"));
}
