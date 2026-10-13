/** 功能：登记 MCP 协议服务。作用：工具与资源共享池和账户/App 租约，宿主卸载撤销连接。关联文件：runtime.ts、network.ts、agent-loop。 */
import type { Context } from "@deepseek-ai/cordis";
import { discoverMcpTools, closeMcpConnections } from "./runtime.js";
export * from "./runtime.js";
export const name = "lfaaMcp";
export function apply(ctx: Context): void {
  ctx.provide(name, { discoverMcpTools });
  ctx.effect(() => () => closeMcpConnections());
}
