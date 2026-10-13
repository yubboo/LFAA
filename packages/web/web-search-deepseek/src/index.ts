/**
 * 文件：index.ts
 * 功能：把 DeepSeek 联网搜索 Provider 注册到 ctx.lfaaWeb。
 * 作用：本插件不持有服务，只向联网能力缝的搜索注册表注入一个 Provider；
 *      密钥在每次搜索时按当前用户从 settings/环境变量解析，不写死在配置里。
 * 关联文件：provider.ts、packages/web/web、packages/settings/settings。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web-search-deepseek。
 */
import type { Context } from "@deepseek-ai/cordis";
import { DeepSeekSearchProvider } from "./provider.js";

export const name = "lfaaWebSearchDeepseek";
export const inject = ["lfaaWeb"];

/** 注册 DeepSeek 搜索 Provider。未配置 DeepSeek 账户时搜索会以结构化错误提示，不阻断启动。 */
export function apply(ctx: Context): void {
  ctx.lfaaWeb.registerSearchProvider(new DeepSeekSearchProvider());
}
