/** 功能：登记跨游戏联机的认证路由。作用：只调用 Connectivity Owner，并独立校验账户和 Daemon 身份。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
import { registerRoutes } from "./routes.js";
export const name = "lfaaApiConnectivityController";
export const inject = ["apiGateway", "lfaaGameConnectivity"];
export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "connectivity-controller", (router, aiHost, realtime) => registerRoutes(router, aiHost, realtime, ctx.lfaaGameConnectivity));
}
