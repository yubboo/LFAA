/**
 * 功能：配置 LFAA Web 前端开发服务器和生产构建。
 * 作用：启用 React 转换，并将本机开发时的 API 请求代理到控制端。
 * 关联文件：apps/web/package.json、packages/client/web/src/main.tsx、packages/host/webserver/src/server.ts。
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, defineConfig, loadEnv, type Logger } from "vite";
import react from "@vitejs/plugin-react";
import { workspaceAliases } from "../../scripts/harness-workspace.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function createBackendProxyLogger(): { logger: Logger; markBackendAvailable: () => void } {
  const viteLogger = createLogger();
  let backendUnavailable = false;

  return {
    logger: {
      get hasWarned() {
        return viteLogger.hasWarned;
      },
      info: viteLogger.info.bind(viteLogger),
      warn: viteLogger.warn.bind(viteLogger),
      warnOnce: viteLogger.warnOnce.bind(viteLogger),
      clearScreen: viteLogger.clearScreen.bind(viteLogger),
      hasErrorLogged: viteLogger.hasErrorLogged.bind(viteLogger),
      error(message, options) {
        const errorCode = options?.error && "code" in options.error ? options.error.code : undefined;
        const isBackendConnectionRefused = errorCode === "ECONNREFUSED"
          && (message.includes("http proxy error") || message.includes("ws proxy error"));

        if (!isBackendConnectionRefused) {
          viteLogger.error(message, options);
          return;
        }

        if (!backendUnavailable) {
          backendUnavailable = true;
          viteLogger.warn("LFAA 控制端连接暂不可用；同一故障期间的重复 Vite 代理错误已合并。", { timestamp: true });
        }
      }
    },
    markBackendAvailable() {
      if (!backendUnavailable) return;
      backendUnavailable = false;
      viteLogger.info("LFAA 控制端连接已恢复。", { timestamp: true });
    }
  };
}

export default defineConfig(({ mode }) => {
  const fileEnvironment = loadEnv(mode, repositoryRoot, "");
  const serverPort = process.env.SERVER_PORT?.trim() || fileEnvironment.SERVER_PORT || "3000";
  if (!/^\d{1,5}$/u.test(serverPort) || Number(serverPort) < 1 || Number(serverPort) > 65535) {
    throw new Error("SERVER_PORT 必须是 1–65535 之间的端口号。");
  }
  const serverTarget = `http://127.0.0.1:${serverPort}`;
  const backendProxyLogger = createBackendProxyLogger();
  const markBackendAvailable = (proxy: { on: (event: string, listener: () => void) => unknown }) => {
    proxy.on("proxyRes", backendProxyLogger.markBackendAvailable);
    proxy.on("open", backendProxyLogger.markBackendAvailable);
  };

  return {
    customLogger: backendProxyLogger.logger,
    plugins: [react()],
    resolve: { alias: workspaceAliases(repositoryRoot) },
    build: {
      target: "es2022",
      outDir: "../../dist/apps/web",
      emptyOutDir: true
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: serverTarget,
          configure: markBackendAvailable
        },
        "/socket.io": {
          target: serverTarget,
          ws: true,
          configure: markBackendAvailable
        }
      }
    }
  };
});
