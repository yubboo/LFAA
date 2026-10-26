/**
 * 功能：配置 LFAA Web 前端开发服务器和生产构建。
 * 作用：启用 React 转换，并将本机开发时的 API 请求代理到控制端。
 * 关联文件：apps/web/package.json、packages/client/web/src/main.tsx、packages/host/webserver/src/server.ts。
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createLogger, defineConfig, loadEnv, type Logger } from "vite";
import react from "@vitejs/plugin-react";
import { renderIndexInjections } from "@deepseek-ai/dsh-host-webserver";
import { createHarnessDevProxy } from "./src/dev-proxy.js";
import { createDshDevBootstrapPlugin } from "./src/dsh-dev-bootstrap.js";
import { workspaceAliases } from "../../scripts/harness-workspace.mjs";
import { recordRuntimeBuild, runtimeBuildFingerprint } from "../../scripts/runtime-build-state.mjs";
import { createWebAssetRetentionPlugin } from "./scripts/web-asset-retention.mjs";
import { createProjectBuildMetadata } from "./scripts/project-version.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectBuildMetadata = createProjectBuildMetadata({
  projectPackage: JSON.parse(readFileSync(resolve(repositoryRoot, "apps/cli/package.json"), "utf8")),
  webPackage: JSON.parse(readFileSync(resolve(repositoryRoot, "apps/web/package.json"), "utf8")),
  electronPackage: JSON.parse(readFileSync(resolve(repositoryRoot, "apps/desktop-electron/package.json"), "utf8")),
  releaseManifest: JSON.parse(readFileSync(resolve(repositoryRoot, "update.json"), "utf8"))
});

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
  let sourceFingerprint: string;
  let writesActiveRuntime: boolean;
  let webOutputDirectory: string;
  const markBackendAvailable = (proxy: { on: (event: string, listener: () => void) => unknown }) => {
    proxy.on("proxyRes", backendProxyLogger.markBackendAvailable);
    proxy.on("open", backendProxyLogger.markBackendAvailable);
  };

  return {
    customLogger: backendProxyLogger.logger,
    plugins: [createDshDevBootstrapPlugin(
      serverTarget,
      renderIndexInjections,
      message => backendProxyLogger.logger.warn(message, { timestamp: true })
    ), react(), createWebAssetRetentionPlugin(repositoryRoot), {
      name: "lfaa-build-state",
      apply: "build",
      configResolved(config) {
        webOutputDirectory = resolve(config.root, config.build.outDir);
        writesActiveRuntime = webOutputDirectory === resolve(repositoryRoot, "dist/apps/web");
      },
      buildStart() { sourceFingerprint = runtimeBuildFingerprint("web", repositoryRoot); },
      writeBundle() {
        if (writesActiveRuntime) {
          recordRuntimeBuild("web", repositoryRoot, sourceFingerprint);
        } else if (webOutputDirectory === resolve(repositoryRoot, "dist/.tmp/desktop-electron/web-candidate")) {
          recordRuntimeBuild("web", repositoryRoot, sourceFingerprint, webOutputDirectory);
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
      __LFAA_PROJECT_BUILD_INFO__: JSON.stringify(projectBuildMetadata),
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
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replace(/\\/gu, "/");
            if (moduleId.includes("/simple-icons/")) return "vendor-simple-icons";
            if (moduleId.includes("/katex/")) return "vendor-katex";
            if (moduleId.includes("/react-dom/")) return "vendor-react-dom";
            if (moduleId.includes("/@shikijs/langs/dist/cpp-macro.mjs")) return "vendor-syntax-cpp-macro";
            if (moduleId.includes("/@shikijs/langs/dist/regexp.mjs")) return "vendor-syntax-regexp";
            if (["/dist/typescript.mjs", "/dist/shellscript.mjs", "/dist/json.mjs"].some(fileName => moduleId.includes(`/@shikijs/langs${fileName}`))) return "vendor-syntax-basics";
            if (moduleId.includes("/shiki/") || moduleId.includes("/@shikijs/") && !moduleId.includes("/@shikijs/langs/")) return "vendor-syntax-core";
            if (["/micromark/", "/micromark-", "/mdast-util-", "/hast-util-", "/unist-util-", "/property-information/"].some(packagePath => moduleId.includes(packagePath))) return "vendor-markdown";
            if (moduleId.includes("/@deepseek-ai/dsh-client-ui-primitives/")) return "dsh-ui-primitives";
            if (moduleId.includes("/@deepseek-ai/dsh-client-ui-dockkit/")) return "dsh-ui-dockkit";
            return undefined;
          }
        }
      },
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
