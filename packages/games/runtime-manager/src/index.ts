/** 功能：登记统一运行环境服务。作用：生命周期托管本机任务，不代替已有 Daemon 或 Agent。 */
import type {Context} from "@deepseek-ai/cordis";
import {runtimeManager} from "./service.js";
export const name="lfaaRuntimeManager";
export const inject=["lfaaStorage","lfaaConfiguration"];
export function apply(ctx:Context):void {ctx.provide(name,runtimeManager);ctx.effect(()=>runtimeManager.start());}
