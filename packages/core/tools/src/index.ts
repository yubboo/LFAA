/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./business-tools.js";
import { registerAiBusinessTool, checkToolArgumentsAgainstSchema } from "./registry.js";
import * as toolSchema from "./json-schema.js";
import * as toolViews from "./presentation.js";
// 保持既有 Context 增强形状不变（避免与其他分片的同名接口合并冲突）；
// 新增的 checkToolArgumentsAgainstSchema/toolSchema/toolViews 在 apply 时随服务对象一起提供（运行期可用）。
declare module "@deepseek-ai/cordis" { interface Context { lfaaTools: typeof capability & { registerTool: typeof registerAiBusinessTool } } }
export const name = "lfaaTools";
export function apply(ctx: Context): void {
  ctx.provide(name, {
    ...capability,
    registerTool: registerAiBusinessTool,
    checkToolArgumentsAgainstSchema,
    toolSchema,
    toolViews,
  });
}
