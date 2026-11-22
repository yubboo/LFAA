// @lfaa/compaction 上下文治理包入口：导出压缩服务、工具结果精简与 /compact 命令插件。
import type { Plugin } from "@deepseek-ai/cordis";
import { compactionCore } from "./basic";
import { commandCompactCore } from "./command";
import { toolResultPrunerCore } from "./pruner";

export * from "./basic";
export * from "./pruner";
export * from "./command";

/**
 * Loader 以包名装载时的默认插件：先精简单条结果，再提供压缩服务，最后挂 /compact 命令。
 * 静态装配（bundle）仍按具名导出分别挂载，以保留中间件顺序（精简必须先于落盘）。
 */
export const compactionBundlePlugin: Plugin.Object<void> = {
  name: "@lfaa/compaction",
  apply(ctx) {
    ctx.plugin(toolResultPrunerCore, {});
    ctx.plugin(compactionCore, {});
    ctx.plugin(commandCompactCore);
  },
};

export default compactionBundlePlugin;
