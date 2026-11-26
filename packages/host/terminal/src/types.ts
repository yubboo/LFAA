// @lfaa/terminal 契约：会话描述、启动参数与 WebSocket 消息格式。
// 只放纯类型，Host 与 Client 共用同一份字段，避免两边手写字符串漂移。

/** 一个终端会话的只读快照（诊断与展示用）。 */
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

/** 打开（或复用）一个终端会话。 */
export interface TerminalOpenOptions {
  /** 聊天会话 id：同一个会话只保留一个终端进程，切换面板不重建。 */
  sessionId: string;
  /** 起始目录；必须落在项目根内，由 Host 侧校验。 */
  cwd: string;
  cols?: number;
  rows?: number;
  /** 显式指定 shell；缺省按平台选 powershell / bash。 */
  shell?: string;
}

/** 终端服务配置。 */
export interface TerminalServiceConfig {
  /** 项目根：cwd 越界一律回退到它。 */
  projectRoot?: string;
  /** 允许的 shell 白名单（按可执行文件名比较，不含路径）。 */
  allowedShells?: string[];
  /** 单个 Host 生命周期内最多保留的终端数。 */
  maxSessions?: number;
  /** 回放缓冲上限（字节）：重连时先补最近的输出。 */
  replayBytes?: number;
}

/** 客户端 → 宿主。 */
export type TerminalClientMessage =
  | { t: "open"; sessionId: string; cols: number; rows: number }
  | { t: "data"; data: string }
  | { t: "resize"; cols: number; rows: number }
  | { t: "kill" };

/** 宿主 → 客户端。 */
export type TerminalServerMessage =
  | { t: "ready"; info: TerminalSessionInfo; replay?: string }
  | { t: "data"; data: string }
  | { t: "exit"; code: number | undefined }
  | { t: "error"; message: string };