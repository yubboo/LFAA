/**
 * Web 产品的 Host Bundle：集中组装 Controller / Adapter，apps/web 不知道它们的内部实现。
 */
import { lfaaDevAgentRuntimeBridge } from "@lfaa/agent-controller";
import { lfaaDevPluginManagerBridge } from "@lfaa/plugin-controller";
import { lfaaDevAiConfigBridge } from "@lfaa/settings-controller";
import { createLfaaDevTerminalBridge } from "@lfaa/terminal-vite";
import { createLfaaViteHostConfig } from "@lfaa/host-vite";

export interface LfaaWebViteConfigOptions {
  readonly appRoot: string;
  readonly projectRoot: string;
  readonly devPort?: number;
  readonly previewPort?: number;
}

export function createLfaaWebViteConfig(options: LfaaWebViteConfigOptions) {
  return createLfaaViteHostConfig({
    appRoot: options.appRoot,
    devPort: options.devPort,
    previewPort: options.previewPort,
    plugins: [
      createLfaaDevTerminalBridge(options.projectRoot),
      lfaaDevAiConfigBridge(options.projectRoot),
      lfaaDevPluginManagerBridge(options.projectRoot),
      lfaaDevAgentRuntimeBridge(options.projectRoot),
    ],
  });
}
