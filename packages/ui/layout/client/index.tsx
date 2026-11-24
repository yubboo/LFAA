// 导出浏览器工作区插件入口与服务类型，不把 React 或 DOM 引入 Host 入口。
import { createRoot, type Root } from "react-dom/client";
import type { Plugin } from "@deepseek-ai/cordis";
import { WorkbenchShell } from "./shell/WorkbenchShell";
import { WorkbenchClientService } from "./workbench-service";

export { WorkbenchClientService } from "./workbench-service";
export type { LibraryTabKey, WorkbenchSnapshot } from "./workbench-service";
export type { WorkspaceMode } from "./navigation/navigation";
export { readStoredJson, writeStoredJson } from "./shell/ui-preferences";

// Web 应用提供挂载节点与可选插件就绪信号；插件注册 workbench 服务并在释放时卸载 React。
export interface WorkbenchPluginConfig {
  container: HTMLElement;
  ready?: Promise<unknown>;
}

// 将四栏 Shell 挂载到应用容器，注册 workbench 服务并在 Cordis 插件释放时清理。
export const workbenchPlugin: Plugin<WorkbenchPluginConfig> = (context, config) => {
  const service = new WorkbenchClientService(context);
  let disposed = false;
  let root: Root | null = null;

  const mountShell = () => {
    if (disposed) return;
    root = createRoot(config.container);
    root.render(<WorkbenchShell service={service} />);
  };

  if (config.ready) {
    void config.ready.then(mountShell, mountShell);
  } else {
    mountShell();
  }

  context.effect(() => () => {
    disposed = true;
    root?.unmount();
    root = null;
  });
};
