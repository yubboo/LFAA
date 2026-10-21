/**
 * 功能：装配本机 Browser Owner 与 Agent 工具。
 * 作用：Browser Context 由当前本机 Host 持有，页面状态不进入账号持久层。
 * 关联文件：packages/bundle/desktop-computer-use、api/browser-controller、core/tools。
 */
import type { Context } from "@deepseek-ai/cordis";
import { config } from "lfaa-launch-environment/src/config.js";
import { registerAiBusinessTool } from "lfaa-tools/src/registry.js";
import { BrowserSessionManager } from "./session-manager.js";
import { createBrowserTools } from "./browser-tools.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    profileContext: { name: string };
    lfaaBrowser: BrowserSessionManager;
    lfaaTools: typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool };
  }
}

export const name = "lfaa-browser-use";
export const inject = ["profileContext", "lfaaTools"];

export function apply(ctx: Context): void {
  const localHostExecution = process.platform === "win32" || process.platform === "darwin"
    ? ctx.profileContext.name === "desktop" && config.desktopMode || ctx.profileContext.name === "web" && config.localComputerUse
    : false;
  const manager = new BrowserSessionManager(localHostExecution);
  ctx.provide("lfaaBrowser", manager);
  if (localHostExecution) for (const tool of createBrowserTools(manager)) registerAiBusinessTool(ctx, tool);
  ctx.effect(() => async () => manager.closeAll(), "lfaa-browser-session-lifecycle");
}

export { BrowserSessionManager, type BrowserProviderSummary, type BrowserSnapshot } from "./session-manager.js";
export type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";
