// @lfaa/terminal Host 插件入口：注册 terminal 服务，并导出 WebSocket 升级处理器给 web-server 挂载。
import type { Plugin } from "@deepseek-ai/cordis";
import { TerminalService } from "./terminal-service";
import type { TerminalServiceConfig } from "./types";

export * from "./types";
export { TerminalService } from "./terminal-service";
export { createTerminalUpgradeHandler, isTerminalUpgradeRequest, type TerminalUpgradeDeps } from "./ws-handler";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 真实终端服务：按聊天会话维护 PTY。 */
    terminal: TerminalService;
  }
}

/** 把终端服务挂到 Cordis 上下文；卸载时由服务自身回收全部 PTY。 */
export const terminalPlugin: Plugin.Object<TerminalServiceConfig | undefined> = {
  name: "@lfaa/terminal",
  apply(ctx, config) {
    new TerminalService(ctx, config ?? {});
  },
};

export default terminalPlugin;