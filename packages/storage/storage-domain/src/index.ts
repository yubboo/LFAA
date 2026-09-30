/** 功能：登记 JSON 配置域服务。作用：供设置与应用包共享权威配置和生命周期。关联文件：configuration.ts、bundle/base。 */
import type { Context } from "@deepseek-ai/cordis";
import { configuration } from "./configuration.js";
export const name = "lfaaConfiguration";
export function apply(ctx: Context): void { ctx.provide(name, configuration); ctx.effect(() => () => configuration.close()); }
