/**
 * 文件：index.ts
 * 功能：登记匿名公网 HTTP(S) 抓取 Provider 到 ctx.lfaaWeb。
 * 作用：本插件不持有服务，只把 HttpFetchProvider 注入联网能力缝的抓取注册表。
 * 不负责：搜索、模型工具渲染。
 * 关联文件：provider.ts、packages/web/web。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web-fetch-http。
 */
import type { Context } from "@deepseek-ai/cordis";
import { HttpFetchProvider, DEFAULT_LIMITS } from "./provider.js";

export const name = "lfaaWebFetchHttp";
export const inject = ["lfaaWeb"];

/** 注册本地 HTTP(S) 抓取 Provider。上限使用 DEFAULT_LIMITS（可按需在代码内调整）。 */
export function apply(ctx: Context): void {
  ctx.lfaaWeb.registerFetchProvider(new HttpFetchProvider(DEFAULT_LIMITS));
}
