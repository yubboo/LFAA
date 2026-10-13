/**
 * 文件：index.ts
 * 功能：把模型可见的 web_search / web_fetch 工具注册到 lfaaTools。
 * 作用：本包只负责工具 schema、参数校验、结果裁剪与文本渲染；
 *      实际搜索/抓取由 ctx.lfaaWeb 的 Provider 完成，模型自由选择是否调用。
 * 不负责：具体 Provider、密钥解析、重定向/超时策略。
 * 关联文件：fetch.ts、search.ts、packages/web/web、packages/web/web-fetch-http。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-web。
 */
import type { Context } from "@deepseek-ai/cordis";
import { applyWebFetchTool } from "./fetch.js";
import { applyWebSearchTool } from "./search.js";

export const name = "lfaaToolWeb";
export const inject = ["lfaaTools", "lfaaWeb"];

/** 注册 web_search 与 web_fetch 两个工具。 */
export function apply(ctx: Context): void {
  ctx.lfaaTools.registerTool(ctx, applyWebSearchTool(ctx));
  ctx.lfaaTools.registerTool(ctx, applyWebFetchTool(ctx));
}
