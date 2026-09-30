/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import Hmr from "@deepseek-ai/cordis-plugin-hmr";
import { config } from "lfaa-launch-environment/src/config.js";
export async function apply(ctx: Context): Promise<void> {
  if (config.nodeEnvironment !== "development") return;
  // web 命令运行编译后的界面与服务，无源码监听；开发命令仍保留原热更新路径。
  if (process.env.LFAA_SERVE_FRONTEND === "true" || process.env.LFAA_SERVE_FRONTEND === "1") return;
  await ctx.plugin(Hmr, { root: [`${config.repositoryRoot}/packages`], ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"], debounce: 120 });
  ctx.provide("lfaaHotReload", true);
}
