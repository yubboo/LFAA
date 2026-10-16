/** 功能：运行环境领域工具。作用：共享真实 RuntimeManager，不按 App 自动暴露完整合同。关联文件：RuntimeManager、core/tools、bundle/base。 */
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
/** 功能：模型可见的共享运行环境工具。作用：通过现有 Permission Owner 审批后交由 RuntimeManager，不模拟界面点击。 */
import Joi from "joi";
import {createHash} from "node:crypto";
import {runtimeManager,getRuntimeTask,cancelRuntimeTask} from "lfaa-runtime-manager/src/service.js";
import {makeTool,strictObject,parseWithSchema,waitForTask,type AiBusinessTool} from "lfaa-tools/src/tool-contract.js";
const target=Joi.alternatives().try(Joi.string().valid("local"),Joi.string().guid()).required();
const applications=["minecraft","steamcmd","workspace"] as const;
export function createRuntimeTools():AiBusinessTool[] {return [
  makeTool({id:"runtime.list",name:"runtime_list",applicationIds:[...applications],description:"查看本机控制端与已登记节点的真实 Java 环境、完整版本、来源和设备状态；本机检测不依赖 Daemon。",schema:strictObject({}),parse:value=>parseWithSchema(Joi.object({}).unknown(false),value),execute:async(_parameters,context)=>runtimeManager.overview(context.userRole)}),
  makeTool({id:"runtime.resolve",name:"runtime_resolve",adminOnly:true,applicationIds:[...applications],description:"按已确认的游戏核心 Java 主版本解析目标设备上现有环境和存储位置。优先复用匹配环境；local 指控制端，节点使用其真实 ID。",schema:strictObject({targetId:{type:"string"},major:{type:"integer",minimum:8,maximum:40}},["targetId","major"]),parse:value=>parseWithSchema(Joi.object({targetId:target,major:Joi.number().integer().min(8).max(40).required()}).unknown(false),value),execute:async p=>runtimeManager.resolve(String(p.targetId),Number(p.major))}),
  makeTool({id:"runtime.operation",name:"runtime_operation",adminOnly:true,retryAfterRecovery:true,applicationIds:[...applications],description:"在指定设备检测/安装/校验/注册/更新/卸载/移除注册 Java；install 可用 packageId 下载 Microsoft Visual C++ 或 DirectX 官方签名安装包，此时不传 major，下载完成不代表已安装。安装会先校验并复用已有版本；下载走官方源和摘要校验。verify/remove/forget 需要 runtime_list 返回的 runtimeId；register 需要设备上 java.exe 的绝对路径。停止 Agent 会请求取消并等待执行器确认，超时不会伪称完成。",schema:strictObject({targetId:{type:"string"},operation:{type:"string",enum:["detect","install","verify","register","remove","forget","update"]},major:{type:"integer",minimum:8,maximum:40},runtimeId:{type:"string"},executablePath:{type:"string"},packageId:{type:"string",enum:["vcredist-x64","vcredist-x86","directx-jun2010"]}},["targetId","operation"]),parse:value=>parseWithSchema(Joi.object({targetId:target,operation:Joi.string().valid("detect","install","verify","register","remove","forget","update").required(),major:Joi.number().integer().min(8).max(40),runtimeId:Joi.string().max(160),executablePath:Joi.string().max(2048),packageId:Joi.string().valid("vcredist-x64","vcredist-x86","directx-jun2010")}).unknown(false),value),risk:p=>["detect","verify"].includes(String(p.operation))?"read":["remove","forget","update"].includes(String(p.operation))?"dangerous":"write",approval:p=>({scopeKey:`runtime:${createHash("sha256").update(JSON.stringify(p)).digest("hex")}`,scopeSummary:`设备 ${p.targetId} · ${p.operation} · Java ${p.major??p.runtimeId??"已有路径"}`,summary:`运行环境操作：${p.operation}；使用该设备配置的环境、缓存及临时目录。`}),execute:async(p,context)=>{
    context.signal.throwIfAborted();const task=runtimeManager.schedule({...p,targetId:String(p.targetId),operation:p.operation as "detect",userId:context.userId,appId:context.applicationId});
    const cancel=()=>{cancelRuntimeTask(task.id,context.userId);};context.signal.addEventListener("abort",cancel,{once:true});
    try {if(context.signal.aborted)cancel();const result=await waitForTask({read:()=>getRuntimeTask(task.id),signal:context.signal,onProgress:context.onProgress,missingMessage:"环境任务记录不存在。"});const {payload,...view}=result;return view;}
    finally{context.signal.removeEventListener("abort",cancel);}
  }}),
  makeTool({id:"runtime.task",name:"runtime_get_task",adminOnly:true,applicationIds:[...applications],description:"读取当前账户环境任务的真实状态，包括取消确认与未知结果，不能从排队推断成功。",schema:strictObject({taskId:{type:"string"}},["taskId"]),parse:value=>parseWithSchema(Joi.object({taskId:Joi.string().guid().required()}).unknown(false),value),execute:async(p,context)=>{const task=getRuntimeTask(String(p.taskId));if(!task||task.createdBy!==context.userId)throw new Error("找不到当前账户的环境任务。");const {payload,...view}=task;return view;}})
];}

export const name = "lfaaToolRuntime";
export const inject = ["lfaaTools", "lfaaRuntimeManager"];
export function apply(ctx: Context): void { for (const tool of createRuntimeTools()) ctx.lfaaTools.registerTool(ctx, { ...tool, applicationIds: [...APPLICATION_IDS], coreManaged: true, onDemand: true }); }
