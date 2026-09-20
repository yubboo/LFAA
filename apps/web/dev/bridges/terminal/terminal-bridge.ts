/**
 * 文件：terminal-bridge.ts
 * 作用：Vite dev-server 的本地 PTY bridge。
 * 负责：node-pty session、输入输出、resize、owner 校验和生命周期清理。
 * 不负责：浏览器 xterm View、正式 Tool Runtime、远程终端或权限提升。
 * 状态归属：PTY sessions 仅存在于 dev-server Node 进程内。
 * 对外接口：createLfaaDevTerminalBridge(projectRoot)。
 * 关联文件：apps/web/vite.config.ts、apps/web/src/terminal/view/LocalTerminal.tsx、vite-custom-events.d.ts。
 * 修改注意事项：必须校验 client owner 与会话上限；不得把 PTY 实例暴露到浏览器。
 */
import path from "node:path";
import type { IPty } from "node-pty";
import type { Plugin, ViteDevServer } from "vite";

const MAX_TERMINAL_SESSIONS = 4;

function clampTerminalSize(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function resolveShell() {
  if (process.platform === "win32") {
    return { file: process.env.LFAA_TERMINAL_SHELL?.trim() || "powershell.exe", args: ["-NoLogo"] };
  }
  const file = process.env.LFAA_TERMINAL_SHELL?.trim() || process.env.SHELL?.trim() || "/bin/bash";
  return { file, args: [] as string[] };
}

export function createLfaaDevTerminalBridge(projectRoot: string): Plugin {
  return {
    name: "lfaa-dev-terminal-bridge",
    apply: "serve",
    async configureServer(server: ViteDevServer) {
      const pty = await import("node-pty");
      const sessions = new Map<string, { terminal: IPty; owner: object }>();

      const disposeSession = (clientId: string) => {
        const session = sessions.get(clientId);
        if (!session) return;
        sessions.delete(clientId);
        try { session.terminal.kill(); } catch { /* already exited */ }
      };

      server.ws.on("lfaa:terminal:create", (payload, client) => {
        const clientId = String(payload.clientId ?? "");
        if (!/^[0-9a-f-]{20,64}$/i.test(clientId)) return;
        const existing = sessions.get(clientId);
        if (existing) {
          disposeSession(clientId);
        } else if (sessions.size >= MAX_TERMINAL_SESSIONS) {
          client.send("lfaa:terminal:error", { clientId, message: "终端会话数量已达到本地开发上限。" });
          return;
        }

        const cols = clampTerminalSize(payload.cols, 20, 300, 100);
        const rows = clampTerminalSize(payload.rows, 5, 120, 24);
        const shell = resolveShell();
        try {
          const terminal = pty.spawn(shell.file, shell.args, {
            name: "xterm-256color",
            cols,
            rows,
            cwd: projectRoot,
            env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" } as Record<string, string>,
          });
          sessions.set(clientId, { terminal, owner: client });
          terminal.onData((data) => client.send("lfaa:terminal:data", { clientId, data }));
          terminal.onExit(({ exitCode }) => {
            sessions.delete(clientId);
            client.send("lfaa:terminal:exit", { clientId, exitCode });
          });
          client.send("lfaa:terminal:ready", { clientId, shell: path.basename(shell.file) });
        } catch (error) {
          client.send("lfaa:terminal:error", { clientId, message: error instanceof Error ? error.message : "无法启动本地终端。" });
        }
      });

      server.ws.on("lfaa:terminal:input", (payload, client) => {
        const session = sessions.get(String(payload.clientId ?? ""));
        if (!session || session.owner !== client || typeof payload.data !== "string") return;
        session.terminal.write(payload.data);
      });
      server.ws.on("lfaa:terminal:resize", (payload, client) => {
        const session = sessions.get(String(payload.clientId ?? ""));
        if (!session || session.owner !== client) return;
        try { session.terminal.resize(clampTerminalSize(payload.cols, 20, 300, 100), clampTerminalSize(payload.rows, 5, 120, 24)); } catch { /* process may exit between events */ }
      });
      server.ws.on("lfaa:terminal:dispose", (payload, client) => {
        const clientId = String(payload.clientId ?? "");
        const session = sessions.get(clientId);
        if (!session || session.owner !== client) return;
        disposeSession(clientId);
      });
      server.ws.on("connection", (client) => {
        const socket = (client as { socket?: { on: (event: "close", listener: () => void) => void } }).socket;
        socket?.on("close", () => {
          for (const [clientId, session] of sessions) if (session.owner === client) disposeSession(clientId);
        });
      });
      server.httpServer?.once("close", () => {
        for (const clientId of [...sessions.keys()]) disposeSession(clientId);
      });
    },
  };
}
