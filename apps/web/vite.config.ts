/**
 * 文件：vite.config.ts
 * 作用：LFAA Web 开发宿主 Composition Root。
 * 负责：Vite server/preview 参数与 dev bridge 组合。
 * 不负责：Resource 扫描、PTY 生命周期、AI/Plugin/Agent bridge 内部实现。
 * 状态归属：无产品业务状态；只读取当前开发进程端口与项目路径。
 * 对外接口：Vite defineConfig 默认导出。
 * 关联文件：dev/bridges/*、src/host-clients/*、src/App.tsx。
 * 修改注意事项：保持薄组合根；详细 Node Host 逻辑必须进入 dev/bridges 子模块。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { lfaaDevAiConfigBridge } from "./dev/bridges/ai/ai-config-bridge.ts";
import { lfaaDevPluginManagerBridge } from "./dev/bridges/plugins/plugin-manager-bridge.ts";
import { lfaaDevAgentRuntimeBridge } from "./dev/bridges/agent/agent-runtime-bridge.ts";
import { createLfaaDevResourceBridge } from "./dev/bridges/resources/resource-bridge.ts";
import { createLfaaDevTerminalBridge } from "./dev/bridges/terminal/terminal-bridge.ts";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(appRoot, "../..");
const devPort = Number.parseInt(process.env.LFAA_WEB_PORT ?? "5173", 10);
const previewPort = Number.parseInt(process.env.LFAA_WEB_PREVIEW_PORT ?? "4173", 10);

export default defineConfig({
  root: appRoot,
  plugins: [
    createLfaaDevResourceBridge(projectRoot),
    createLfaaDevTerminalBridge(projectRoot),
    lfaaDevAiConfigBridge(projectRoot),
    lfaaDevPluginManagerBridge(projectRoot),
    lfaaDevAgentRuntimeBridge(projectRoot),
  ],
  server: { host: "127.0.0.1", port: Number.isFinite(devPort) ? devPort : 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: Number.isFinite(previewPort) ? previewPort : 4173, strictPort: true },
});
