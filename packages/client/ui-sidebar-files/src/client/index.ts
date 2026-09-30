/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-client-modules/src/client/index.js";
export const inject = ["clientModules"];
export function apply(ctx: Context): void {
  ctx.clientModules.register(ctx, "lfaa-client-ui-sidebar-files/src/FileManagerPage.js", () => import("../FileManagerPage.js"));
}
