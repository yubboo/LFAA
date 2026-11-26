// 浏览器侧终端消息契约：与 @lfaa/terminal 的 Host 协议保持一致（结构相同，独立声明避免前端引 Host 依赖）。
export interface TerminalSessionInfo {
  id: string;
  sessionId: string;
  title: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  startedAt: number;
  running: boolean;
}

export type TerminalClientMessage =
  | { t: "open"; sessionId: string; cols: number; rows: number }
  | { t: "data"; data: string }
  | { t: "resize"; cols: number; rows: number }
  | { t: "kill" };

export type TerminalServerMessage =
  | { t: "ready"; info: TerminalSessionInfo; replay?: string }
  | { t: "data"; data: string }
  | { t: "exit"; code: number | undefined }
  | { t: "error"; message: string };