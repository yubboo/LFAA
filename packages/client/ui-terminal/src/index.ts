// @lfaa/client-ui-terminal 包入口：只放与浏览器无关的常量；界面组件在 ./client（浏览器入口）。
/** 终端 WebSocket 端点：Host 侧 `createTerminalUpgradeHandler` 与前端连接器共用同一路径。 */
export const TERMINAL_WS_PATH = "/api/terminal";