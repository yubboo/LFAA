// @lfaa/terminal WebSocket 升级处理：/api/terminal 走一次性令牌校验，再把双向帧转给 TerminalService。
// 独立于 ApiGateway（那是 req/res 一元请求的派发器），这里只处理 upgrade 握手与长连接。
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { checkApiAuth } from "@lfaa/api-gateway";
import type { TerminalClientMessage, TerminalServerMessage } from "./types";
import type { TerminalService } from "./terminal-service";

/** 升级处理所需的运行时依赖。 */
export interface TerminalUpgradeDeps {
  /** 取终端服务；未装配时返回 null（此时所有升级请求直接拒绝）。 */
  getService: () => TerminalService | null;
  /** 一次性接口令牌。 */
  token: string;
  /** 解析某个聊天会话的起始目录（项目根或工作树）。 */
  resolveCwd: (sessionId: string) => Promise<string>;
}

const TERMINAL_PATH = "/api/terminal";

/** 判断请求是否打到终端端点（忽略查询串）。 */
export function isTerminalUpgradeRequest(req: IncomingMessage): boolean {
  const raw = (req.url ?? "").split("?")[0] ?? "";
  return raw === TERMINAL_PATH;
}

/**
 * 生成 `server.on("upgrade")` 用的处理函数；返回 true 表示已接管（包括拒绝），
 * 返回 false 交给其它升级处理器（例如 Vite 的 HMR）。
 */
export function createTerminalUpgradeHandler(deps: TerminalUpgradeDeps): (req: IncomingMessage, socket: Duplex, head: Buffer) => boolean {
  const wss = new WebSocketServer({ noServer: true });

  return (req, socket, head) => {
    if (!isTerminalUpgradeRequest(req)) return false;
    const decision = checkApiAuth(req, { token: deps.token });
    if (!decision.allowed) {
      socket.write(`HTTP/1.1 ${decision.status} Unauthorized\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return true;
    }
    const service = deps.getService();
    if (!service) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return true;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const sessionId = new URL(req.url ?? TERMINAL_PATH, "http://localhost").searchParams.get("sessionId") ?? "";
      void attachSession(ws, service, deps, sessionId);
    });
    return true;
  };
}

/** 把一个 WebSocket 绑到某个聊天会话的 PTY 上。 */
async function attachSession(ws: WebSocket, service: TerminalService, deps: TerminalUpgradeDeps, sessionId: string): Promise<void> {
  if (!sessionId) {
    send(ws, { t: "error", message: "缺少 sessionId" });
    ws.close();
    return;
  }
  let opened = false;
  let unsubscribe: (() => void) | null = null;

  const bind = async (cols: number, rows: number) => {
    const cwd = await deps.resolveCwd(sessionId);
    const info = service.open({ sessionId, cwd, cols, rows });
    opened = true;
    unsubscribe?.();
    unsubscribe = service.subscribe(
      sessionId,
      (data) => send(ws, { t: "data", data }),
      (code) => {
        send(ws, { t: "exit", code });
        ws.close();
      },
    );
    send(ws, { t: "ready", info, replay: service.replay(sessionId) });
  };

  ws.on("message", (raw) => {
    let message: TerminalClientMessage;
    try {
      message = JSON.parse(String(raw)) as TerminalClientMessage;
    } catch {
      return;
    }
    if (message.t === "open") {
      void bind(message.cols, message.rows).catch((error: unknown) => {
        send(ws, { t: "error", message: error instanceof Error ? error.message : "终端启动失败" });
      });
      return;
    }
    if (!opened) return;
    if (message.t === "data") service.write(sessionId, message.data);
    else if (message.t === "resize") service.resize(sessionId, message.cols, message.rows);
    else if (message.t === "kill") {
      service.kill(sessionId);
      ws.close();
    }
  });

  // 断线只解除订阅，不杀进程：刷新页面后仍能接着用同一个终端。
  ws.on("close", () => unsubscribe?.());
  ws.on("error", () => unsubscribe?.());
}

function send(ws: WebSocket, message: TerminalServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}