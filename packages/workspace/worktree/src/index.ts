// @lfaa/worktree Host 入口：注册工作树服务并默认导出插件本体，供 Cordis Loader 按包名装载。
import type { Plugin } from "@deepseek-ai/cordis";
import { WorktreeService, type WorktreePluginConfig } from "./worktree-service";

export * from "../contract";
export { createWorktreeHttpHandler } from "./http-handler";
export { buildWorktreePath, WorktreeService, type WorktreePluginConfig } from "./worktree-service";
export { WorktreeStore, isValidWorktreeRecord } from "./store";

const worktreePlugin: Plugin.Object<WorktreePluginConfig> = {
  name: "lfaa-worktree",
  inject: ["workspace"],
  apply(ctx, config) {
    new WorktreeService(ctx, config);
  },
};

declare module "@deepseek-ai/cordis" {
  interface Context {
    worktree: WorktreeService;
  }
}

export { worktreePlugin };

/** 默认导出插件本体，供 Loader 以包名装载。 */
export default worktreePlugin;