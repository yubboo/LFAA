/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import { SessionKernel, SessionStore } from "./kernel.js";
export * from "./kernel.js";
export const name = "lfaaSessions";
export function apply(ctx: Context): void {
  // Cordis 插件只获得不绑定账户数据的内核构造器；会话读取/写入继续走认证 Host 与 Agent Loop Owner。
  ctx.provide(name, Object.freeze({ SessionKernel, SessionStore }));
}
