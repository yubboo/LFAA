/**
 * 文件：vite.ts
 * 作用：Web 产品的 Host Bundle，集中装配 Controller / Adapter，并保持 apps/web 为薄启动入口。
 * 负责：创建共享 Codex App Server Host，把 Managed Auth 与 Text Runtime 注入对应 Controller，统一注册 Vite Host 插件。
 * 不负责：Agent/Provider 业务、UI、Codex JSONL 细节、终端实现。
 * 状态归属：每个 Vite Server 实例拥有一套 Web Bundle 组合对象；Codex 子进程由本 Bundle 统一释放。
 * 对外接口：createLfaaWebViteConfig(options)。
 * 关联文件：@lfaa/codex-app-server、@lfaa/settings-controller、@lfaa/agent-controller、apps/web/vite.config.ts。
 * 修改注意事项：同一 Web Host 内不得为设置页和 Agent Runtime 各启动一份 Codex App Server。
 */
import type { Plugin, ViteDevServer } from "vite";
import { lfaaDevAgentRuntimeBridge } from "@lfaa/agent-controller";
import { lfaaDevIdentityBridge } from "@lfaa/identity-controller";
import { CodexAppServerHost } from "@lfaa/codex-app-server";
import { lfaaDevPluginManagerBridge } from "@lfaa/plugin-controller";
import { lfaaDevSessionBridge } from "@lfaa/session-controller";
import { lfaaDevAiConfigBridge } from "@lfaa/settings-controller";
import { createLfaaDevTerminalBridge } from "@lfaa/terminal-vite";
import { createLfaaViteHostConfig } from "@lfaa/host-vite";

export interface LfaaWebViteConfigOptions {
  readonly appRoot: string;
  readonly projectRoot: string;
  readonly devPort?: number;
  readonly previewPort?: number;
}

function codexLifecyclePlugin(host: CodexAppServerHost): Plugin {
  return {
    name: "lfaa-codex-app-server-lifecycle",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.httpServer?.once("close", () => host.dispose());
    },
  };
}

export function createLfaaWebViteConfig(options: LfaaWebViteConfigOptions) {
  const codexHost = new CodexAppServerHost();
  return createLfaaViteHostConfig({
    appRoot: options.appRoot,
    ...(options.devPort !== undefined ? { devPort: options.devPort } : {}),
    ...(options.previewPort !== undefined ? { previewPort: options.previewPort } : {}),
    plugins: [
      // Identity 必须第一个注册：First Run/Login 自己放行，其余 /__lfaa/dev/* API 先经过 AuthSession Gate。
      lfaaDevIdentityBridge(),
      createLfaaDevTerminalBridge(options.projectRoot),
      lfaaDevAiConfigBridge(options.projectRoot, { managedAuth: codexHost.managedAuth }),
      lfaaDevPluginManagerBridge(options.projectRoot),
      lfaaDevSessionBridge(),
      lfaaDevAgentRuntimeBridge(options.projectRoot, { codexRuntime: codexHost.textRuntime }),
      codexLifecyclePlugin(codexHost),
    ],
  });
}
