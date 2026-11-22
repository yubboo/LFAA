// @lfaa/sandbox 安全边界包入口：导出沙箱契约、执行策略与本地后端，并组合成默认插件。
import type { Plugin } from "@deepseek-ai/cordis";
import { sandboxLocalPlugin } from "./local/index";
import { sandboxPolicyCore } from "./policy";

export * from "./seam";
export * from "./policy";
export * from "./local/index";

/** Loader 以包名装载时的默认插件：先挂策略判定，再挂工具层后端。 */
export const sandboxBundlePlugin: Plugin.Object<void> = {
  name: "@lfaa/sandbox",
  apply(ctx) {
    ctx.plugin(sandboxPolicyCore, {});
    ctx.plugin(sandboxLocalPlugin);
  },
};

export default sandboxBundlePlugin;
