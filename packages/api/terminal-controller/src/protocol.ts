/** 功能：定义节点交互式终端协议。作用：浏览器账户会话与认证 Daemon 连接代际隔离，命令逐项应答。关联文件：registry.ts、routes.ts、host/daemon/src/terminal-channel.mjs。 */
export interface TerminalInfo {
  id: string; nodeId: string; title: string; cwd: string; cols: number; rows: number;
  target?: TerminalTarget;
  state: "starting" | "running" | "exited"; exitCode: number | null;
}
export type TerminalTarget = { kind: "shell" } | { kind: "minecraft-shell"; instanceId: string } | { kind: "minecraft"; instanceId: string };
export type TerminalCommand = {
  commandId: string; id: string; type: "create" | "input" | "resize" | "close";
  cwd?: string; shell?: string; cols?: number; rows?: number; data?: string; target?: TerminalTarget;
};
export type TerminalEvent =
  | { type: "ack"; commandId: string; ok: boolean; message?: string }
  | { type: "output"; id: string; data: string }
  | { type: "exit"; id: string; exitCode: number | null; message?: string };
