/**
 * 文件：vite.config.ts
 * 作用：LFAA Web 本地开发服务器配置，并提供仅开发模式可用的 .lfaa 资源桥和真实终端桥。
 * 负责：Vite 配置、资源元数据扫描、资源变更通知、node-pty 会话创建/输入/输出/Resize/回收。
 * 不负责：正式 Agent Tool Runtime、远程终端、Secret 注入、生产环境系统执行。
 * 状态归属：开发服务器拥有 PTY session Map；资源文件本身仍以项目 .lfaa 目录为事实源。
 * 对外接口：Vite config、/__lfaa/dev/resources、lfaa:terminal:* 自定义事件。
 * 关联文件：apps/web/src/App.tsx、LocalTerminal.tsx、vite-custom-events.d.ts、.lfaa/*。
 * 修改注意事项：服务器必须只绑定 127.0.0.1；资源桥只返回元数据；PTY owner 必须和 WebSocket client 一一校验。
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import type { IPty } from "node-pty";
import { lfaaDevAiConfigBridge } from "./dev/bridges/ai/ai-config-bridge.ts";
import { lfaaDevPluginManagerBridge } from "./dev/bridges/plugins/plugin-manager-bridge.ts";

// ===== 1. 项目路径和开发端口 =====
const appRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(appRoot, "../..");
const resourceRoot = path.join(projectRoot, ".lfaa");
const resourceKinds = ["skills", "experts", "plugins", "extensions", "mcp"] as const;
const devPort = Number.parseInt(process.env.LFAA_WEB_PORT ?? "5173", 10);
const previewPort = Number.parseInt(process.env.LFAA_WEB_PREVIEW_PORT ?? "4173", 10);
const maxTerminalSessions = 4;

type ResourceKind = (typeof resourceKinds)[number];

// ===== 2. .lfaa 开发资源桥 =====
// 只扫描名称、相对路径、类型和 mtime，不读取资源正文。
async function scanResources() {
  const resources: Array<{ kind: ResourceKind; name: string; relativePath: string; entryType: "file" | "directory"; updatedAt: number }> = [];
  for (const kind of resourceKinds) {
    const folder = path.join(resourceRoot, kind);
    let entries;
    try { entries = await readdir(folder, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "README.md") continue;
      const absolute = path.join(folder, entry.name);
      let updatedAt = 0;
      try { updatedAt = (await stat(absolute)).mtimeMs; } catch { /* resource may be changing */ }
      resources.push({ kind, name: entry.name, relativePath: `.lfaa/${kind}/${entry.name}`, entryType: entry.isDirectory() ? "directory" : "file", updatedAt });
    }
  }
  return resources.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "zh-CN"));
}

function isAllowedResourcePath(file: string): boolean {
  const relative = path.relative(resourceRoot, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const [kind] = relative.split(path.sep);
  return resourceKinds.includes(kind as ResourceKind);
}

// Vite Plugin：HTTP 提供资源快照，watcher 只广播 changed 通知。
function lfaaDevResourceBridge(): Plugin {
  return {
    name: "lfaa-dev-resource-bridge",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      for (const kind of resourceKinds) server.watcher.add(path.join(resourceRoot, kind));
      server.middlewares.use("/__lfaa/dev/resources", async (_request, response) => {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify({ resources: await scanResources() }));
      });
      server.watcher.on("all", (_event, file) => {
        if (!isAllowedResourcePath(file)) return;
        server.ws.send({ type: "custom", event: "lfaa:resources-changed", data: { changed: true } });
      });
    },
  };
}

// ===== 3. 本地 PTY 开发桥 =====
function clampTerminalSize(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

// Windows 默认 PowerShell；其他平台使用 $SHELL 或 /bin/bash。
function resolveShell() {
  if (process.platform === "win32") {
    return { file: process.env.LFAA_TERMINAL_SHELL?.trim() || "powershell.exe", args: ["-NoLogo"] };
  }
  const file = process.env.LFAA_TERMINAL_SHELL?.trim() || process.env.SHELL?.trim() || "/bin/bash";
  return { file, args: [] as string[] };
}

// Vite Plugin：每个浏览器 clientId 对应一个 node-pty，会话所有权绑定到 WebSocket client。
function lfaaDevTerminalBridge(): Plugin {
  return {
    name: "lfaa-dev-terminal-bridge",
    apply: "serve",
    async configureServer(server: ViteDevServer) {
      const pty = await import("node-pty");
      const sessions = new Map<string, { terminal: IPty; owner: object }>();

      // 所有退出路径都走同一个 dispose，避免 PTY 孤儿进程。
      const disposeSession = (clientId: string) => {
        const session = sessions.get(clientId);
        if (!session) return;
        sessions.delete(clientId);
        try { session.terminal.kill(); } catch { /* already exited */ }
      };

      // create：校验 clientId、限制并发、固定 cwd 为项目根，然后启动 PTY。
      server.ws.on("lfaa:terminal:create", (payload, client) => {
        const clientId = String(payload.clientId ?? "");
        if (!/^[0-9a-f-]{20,64}$/i.test(clientId)) return;

        const existing = sessions.get(clientId);
        if (existing) {
          disposeSession(clientId);
        } else if (sessions.size >= maxTerminalSessions) {
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
            env: {
              ...process.env,
              TERM: "xterm-256color",
              COLORTERM: "truecolor",
            } as Record<string, string>,
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
        const cols = clampTerminalSize(payload.cols, 20, 300, 100);
        const rows = clampTerminalSize(payload.rows, 5, 120, 24);
        try { session.terminal.resize(cols, rows); } catch { /* process may exit between events */ }
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
          for (const [clientId, session] of sessions) {
            if (session.owner === client) disposeSession(clientId);
          }
        });
      });

      server.httpServer?.once("close", () => {
        for (const clientId of [...sessions.keys()]) disposeSession(clientId);
      });
    },
  };
}

export default defineConfig({
  root: appRoot,
  plugins: [lfaaDevResourceBridge(), lfaaDevTerminalBridge(), lfaaDevAiConfigBridge(projectRoot), lfaaDevPluginManagerBridge(projectRoot)],
  server: {
    host: "127.0.0.1",
    port: Number.isFinite(devPort) ? devPort : 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: Number.isFinite(previewPort) ? previewPort : 4173,
    strictPort: true,
  },
});
