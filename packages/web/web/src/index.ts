// @lfaa/web 浏览器/网页能力包入口：导出能力 seam、HTTP 抓取实现与 fetch_url 工具，并组合成默认插件。
import type { Plugin } from "@deepseek-ai/cordis";
import { webPlugin } from "./seam";
import { httpFetchPlugin } from "./fetch/http-fetch";
import { toolWebPlugin } from "./tool/fetch-url-tool";

export * from "./seam";
export * from "./fetch/http-fetch";
export * from "./tool/fetch-url-tool";

/**
 * Loader 以包名装载时的默认插件：先挂能力 seam，再挂抓取实现，最后挂工具。
 * 静态装配（bundle）仍按同名导出分别挂载，以保留启动顺序与错误定位。
 */
export const webBundlePlugin: Plugin.Object<void> = {
  name: "@lfaa/web",
  async apply(ctx) {
    await ctx.plugin(webPlugin);
    await ctx.plugin(httpFetchPlugin, {});
    await ctx.plugin(toolWebPlugin);
  },
};

export default webBundlePlugin;
