// @lfaa/agent-profile 包入口：导出契约、归一化、校验、服务与插件本体。
import type { Plugin } from "@deepseek-ai/cordis";
import { agentProfilePlugin } from "./service";

export * from "./types";
export * from "./sanitize";
export * from "./validate";
export * from "./routing";
export * from "./routed-llm";
export { AgentProfileService, agentProfilePlugin } from "./service";
export { createAgentProfileHttpHandler } from "./http-handler";
export type { AgentProfilePluginConfig } from "./service";

/** Loader 以包名装载时的默认插件：只挂服务，P1 阶段没有工具与界面。 */
export const agentProfileBundlePlugin: Plugin.Object<void> = {
  name: "@lfaa/agent-profile",
  apply(ctx) {
    ctx.plugin(agentProfilePlugin);
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default agentProfileBundlePlugin;