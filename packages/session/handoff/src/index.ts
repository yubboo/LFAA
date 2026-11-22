// @lfaa/handoff 交接能力包入口：导出交接服务、工具与 HTTP 接口，并组合成默认插件。
import type { Plugin } from "@deepseek-ai/cordis";
import { handoffPlugin } from "./service";
import { toolHandoffPlugin } from "./tool/handoff-tool";

export * from "./service";
export * from "./tool/handoff-tool";
export { createHandoffHttpHandler } from "./http-handler";

/** Loader 以包名装载时的默认插件：先挂服务，再挂工具（工具依赖服务与目标）。 */
export const handoffBundlePlugin: Plugin.Object<void> = {
  name: "@lfaa/handoff",
  async apply(ctx) {
    await ctx.plugin(handoffPlugin);
    await ctx.plugin(toolHandoffPlugin);
  },
};

export default handoffBundlePlugin;