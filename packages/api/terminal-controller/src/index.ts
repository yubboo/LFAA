/**
 * 功能：终端控制器插件入口。
 * 作用：把认证、账户隔离的节点终端生命周期与流式路由登记进 apiGateway，并在卸载撤销所有连接。
 * 关联文件：packages/api/gateway/src/index.ts、packages/api/terminal-controller/src/routes.ts、packages/api/terminal-controller/src/registry.ts。
 *
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 @deepseek-ai/dsh-api-terminal-controller。
 * 集成需要：目标 Daemon 连接认证终端通道并持有真实 PTY；控制端不执行用户 Shell。
 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
import { TerminalRegistry } from "./registry.js";
import { registerTerminalRoutes } from "./routes.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    apiGateway: import("lfaa-api-gateway/src/index.js").ApiGateway;
  }
}

export const inject = ["apiGateway"];

export function apply(ctx: Context): void {
  const registry = new TerminalRegistry();
  ctx.effect(() => () => registry.dispose());
  ctx.apiGateway.register(ctx, "terminal-controller", (router, aiHost, realtime) => {
    registerTerminalRoutes(router, registry, aiHost, realtime);
  });
}
