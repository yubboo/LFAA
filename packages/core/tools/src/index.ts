/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./business-tools.js";
import { registerAiBusinessTool } from "./registry.js";
declare module "@deepseek-ai/cordis" { interface Context { lfaaTools: typeof capability & { registerTool: typeof registerAiBusinessTool } } }
export const name = "lfaaTools";
export function apply(ctx: Context): void {
  ctx.provide(name, { ...capability, registerTool: registerAiBusinessTool });
}
