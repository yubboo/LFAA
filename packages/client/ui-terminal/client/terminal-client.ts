// 终端 WebSocket 客户端：负责握手（带一次性令牌）、重连、增开/关闭会话与发送输入。
// 页面刷新后重连会复用 Host 里同一个 PTY，因此不需要前端保存历史。
import type { TerminalClientMessage, TerminalServerMessage, TerminalSessionInfo } from "./terminal-types";

/** 连接参数。 */
export interface TerminalConnectionOptions {
  sessionId: string;
  cols: number;
  rows: number;
  onData: (data: string) => void;
  onReady?: (info: TerminalSessionInfo, replay: string) => void;
  onExit?: (code: number | undefined) => void;
  onError?: (message: string) => void;
  onStatus?: (status: "connecting" | "open" | "closed") => void;
}

/** 连接句柄：输入、改尺寸、结束会话、主动关闭。 */
export interface TerminalConnection {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  close(): void;
}

/** 从页面 meta 读一次性令牌（与 /api 请求同源）。 */
function readApiToken(): string {
  if (typeof document === "undefined") return "";
  return document.querySelector('meta[name="lfaa-api-token"]')?.getAttribute("content") ?? "";
}

/** 按当前页面地址拼出终端 WebSocket 地址。 */
function terminalUrl(sessionId: string): string {
  const token = readApiToken();
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  const query = new URLSearchParams({ sessionId });
  if (token) query.set("token", token);
  return `${scheme}//${location.host}/api/terminal?${query.toString()}`;
}

/** 建立一条终端连接；重连由调用方（面板）决定，避免在这里无限重试打爆宿主。 */
export function connectTerminal(options: TerminalConnectionOptions): TerminalConnection {
  const { sessionId } = options;
  let socket: WebSocket | null = null;
  let disposed = false;

  const send = (message: TerminalClientMessage) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  const open = () => {
    options.onStatus?.("connecting");
    const ws = new WebSocket(terminalUrl(sessionId));
    socket = ws;
    ws.onopen = () => {
      options.onStatus?.("open");
      send({ t: "open", sessionId, cols: options.cols, rows: options.rows });
    };
    ws.onmessage = (event) => {
      let message: TerminalServerMessage;
      try {
        message = JSON.parse(String(event.data)) as TerminalServerMessage;
      } catch {
        return;
      }
      if (message.t === "data") options.onData(message.data);
      else if (message.t === "ready") options.onReady?.(message.info, message.replay ?? "");
      else if (message.t === "exit") options.onExit?.(message.code);
      else if (message.t === "error") options.onError?.(message.message);
    };
    ws.onclose = () => {
      options.onStatus?.("closed");
    };
    ws.onerror = () => {
      // 具体原因由 onclose 反映；这里不重复报错，避免同一次失败弹两条。
    };
  };

  open();

  return {
    write: (data) => send({ t: "data", data }),
    resize: (cols, rows) => send({ t: "resize", cols, rows }),
    kill: () => send({ t: "kill" }),
    close: () => {
      disposed = true;
      socket?.close();
      socket = null;
      if (!disposed) return;
    },
  };
}