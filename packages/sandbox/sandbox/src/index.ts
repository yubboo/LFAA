// @lfaa/sandbox 安全边界包入口：导出沙箱契约、执行策略与本地后端；默认只挂策略，本地后端由装配层单独提供。
import type { Plugin } from "@deepseek-ai/cordis";
import { sandboxLocalPlugin } from "./local/index";
import { sandboxPolicyCore } from "./policy";

export * from "./seam";
export * from "./policy";
export * from "./local/index";

/** 需要同时挂策略与本地后端的独立装配入口（测试或单包启动用）。 */
export const sandboxBundlePlugin: Plugin.Object<void> = {
  name: "@lfaa/sandbox",
  apply(ctx) {
    ctx.plugin(sandboxPolicyCore, {});
    ctx.plugin(sandboxLocalPlugin);
  },
};

/**
 * Loader 以包名装载时的默认插件：只挂策略判定。
 * 本地后端由根上下文单独装配，默认导出再挂一次会与服务提供者重复。
 */
export default sandboxPolicyCore;
