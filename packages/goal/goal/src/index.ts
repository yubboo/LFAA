// @lfaa/goal 目标能力包入口：导出目标服务与目标工具，并组合成默认插件。
import type { Plugin } from "@deepseek-ai/cordis";
import { goalPlugin } from "./service";
import { toolGoalPlugin } from "./tool/goal-tool";

export * from "./service";
export * from "./tool/goal-tool";

/** Loader 以包名装载时的默认插件：先挂目标服务，再挂目标工具（工具依赖服务）。 */
export const goalBundlePlugin: Plugin.Object<void> = {
  name: "@lfaa/goal",
  async apply(ctx) {
    await ctx.plugin(goalPlugin);
    await ctx.plugin(toolGoalPlugin);
  },
};

export default goalBundlePlugin;

export { createGoalHttpHandler } from "./http-handler";
