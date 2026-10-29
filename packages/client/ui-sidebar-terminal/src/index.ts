/** 功能：公开共享终端表面。作用：系统 Shell PTY 与受管进程控制台复用相同 xterm 渲染及主题映射。关联文件：TerminalSurface.tsx、ui-workspace、ui-minecraft。 */
export { TerminalSurface } from "./TerminalSurface.js";
export type { TerminalSurfaceHandle, TerminalSurfaceProps, TerminalSurfaceSize } from "./TerminalSurface.js";
export { useTerminalSession } from "./useTerminalSession.js";
export type { TerminalSessionController } from "./useTerminalSession.js";

export function apply(): void {}
