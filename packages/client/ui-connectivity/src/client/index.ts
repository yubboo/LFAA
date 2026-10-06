/** 功能：登记联机服务工作区模块。作用：复用 LFAA Client 模块加载和权限边界。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-client-modules/src/client/index.js";

export const inject = ["clientModules"];

export function apply(ctx: Context): void {
  ctx.clientModules.register(ctx, "lfaa-client-ui-connectivity/src/ConnectivityWorkspace.js", () => import("../ConnectivityWorkspace.js"));
}
