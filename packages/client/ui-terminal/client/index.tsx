// @lfaa/client-ui-terminal 浏览器入口：导出真实终端面板组件与连接客户端。
export { TerminalPane } from "./TerminalPane";
export { connectTerminal, type TerminalConnection, type TerminalConnectionOptions } from "./terminal-client";
export type { TerminalClientMessage, TerminalServerMessage, TerminalSessionInfo } from "./terminal-types";