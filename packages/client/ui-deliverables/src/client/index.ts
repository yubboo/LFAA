/** 功能：登记资产库按需界面模块。作用：通过 Client Module Loader 懒加载并在卸载时撤销。关联文件：AgentAssetLibrary.tsx、package.json。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-client-modules/src/client/index.js";

export const inject = ["clientModules"];

export function apply(ctx: Context): void {
  ctx.clientModules.register(ctx, "lfaa-client-ui-deliverables/src/AgentAssetLibrary.js", () => import("../AgentAssetLibrary.js"));
}
