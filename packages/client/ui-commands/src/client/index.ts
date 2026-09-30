/** 功能：提供浏览器快捷键匹配能力。作用：沿用账户快捷键合同，随插件卸载撤销服务。关联文件：shortcuts.ts、client/web、ui-layout。 */
import type { Context } from "@deepseek-ai/cordis";
import { shortcutMatches } from "../shortcuts.js";
export function apply(ctx: Context): void { ctx.provide("clientCommands", { matches: shortcutMatches }); }
