/**
 * 功能：配置 LFAA Web 前端开发服务器和生产构建。
 * 作用：启用 React 转换，并将本机开发时的 API 请求代理到控制端。
 * 关联文件：apps/web/package.json、packages/client/web/src/main.tsx、packages/host/webserver/src/server.ts。
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, defineConfig, loadEnv, type Logger } from "vite";
import react from "@vitejs/plugin-react";
import { renderIndexInjections } from "@deepseek-ai/dsh-host-webserver";
import { createHarnessDevProxy } from "./src/dev-proxy.js";
import { workspaceAliases } from "../../scripts/harness-workspace.mjs";
import { recordRuntimeBuild, runtimeBuildFingerprint } from "../../scripts/runtime-build-state.mjs";
import { createWebAssetRetentionPlugin } from "./scripts/web-asset-retention.mjs";

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
  const dshBootstrap = {
    name: "lfaa-dsh-dev-bootstrap",
    apply: "serve" as const,
    transformIndexHtml: {
      order: "pre" as const,
      async handler(html: string) {
        let lastError: unknown;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          try {
            const response = await fetch(`${serverTarget}/__dsh/index-injections`);
            if (response.ok) {
              const injections: unknown = await response.json();
              if (!Array.isArray(injections)) throw new Error("DSH Host 返回的页面注入不是列表。");
              return renderIndexInjections(html, injections);
            }
            lastError = new Error(`DSH Host 页面注入返回 HTTP ${response.status}。`);
          } catch (error) {
            lastError = error;
          }
          await new Promise((resolveRetry) => setTimeout(resolveRetry, 250));
        }
        throw new Error("Vite 无法取得已装配的 DSH Client Runtime 启动图。", { cause: lastError });
      }
    }
  };
  let sourceFingerprint: string;
  let writesActiveRuntime: boolean;
  const markBackendAvailable = (proxy: { on: (event: string, listener: () => void) => unknown }) => {
    proxy.on("proxyRes", backendProxyLogger.markBackendAvailable);
    proxy.on("open", backendProxyLogger.markBackendAvailable);
  };

  return {
    customLogger: backendProxyLogger.logger,
    plugins: [dshBootstrap, react(), createWebAssetRetentionPlugin(repositoryRoot), {
      name: "lfaa-build-state",
      apply: "build",
      configResolved(config) {
        writesActiveRuntime = resolve(config.root, config.build.outDir) === resolve(repositoryRoot, "dist/apps/web");
      },
      buildStart() { sourceFingerprint = runtimeBuildFingerprint("web", repositoryRoot); },
      writeBundle() {
        if (writesActiveRuntime) {
          recordRuntimeBuild("web", repositoryRoot, sourceFingerprint);
        }
      }
    }],
    resolve: {
      alias: [
        ...workspaceAliases(repositoryRoot),
        { find: /^node:module$/u, replacement: resolve(repositoryRoot, "apps/web/src/node-module-stub.ts") }
      ]
    },
    define: {
      // Match DSH's browser build: Cordis Loader's Node-only internal loader
      // stays unreachable while its client-side internal slot is supplied
      // by the DSH module graph at boot.
      "process.versions.node": '"0.0.0"',
      "process.execArgv": "[]",
      "process.env.CORDIS_SHARED": "undefined"
    },
    build: {
      target: "es2022",
      outDir: "../../dist/apps/web",
      // 正式目录由资源保留插件按构建代数清理；显式临时输出仍由 Vite 独立清空。
      emptyOutDir: process.argv.some((argument) => argument === "--outDir" || argument.startsWith("--outDir="))
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: createHarnessDevProxy(serverTarget, markBackendAvailable)
    }
  };
});
