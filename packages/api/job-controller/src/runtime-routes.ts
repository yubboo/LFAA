/** 功能：运行环境的用户与节点接口。作用：复用当前认证、角色与节点凭据，不接受浏览器伪造执行载荷。 */
import type {Router} from "express";
import Joi from "joi";
import {requireAuthentication,requireRole} from "lfaa-authorization/src/middleware.js";
import {asyncHandler,parseBody,requireLocalDaemon} from "lfaa-api-remotes/src/route-contracts.js";
import {runtimeManager,getRuntimeTask,listRuntimeTasks,cancelRuntimeTask,runtimeStorageFor} from "lfaa-runtime-manager/src/service.js";
import {claimRuntimeTask,renewRuntimeTask,progressRuntimeTask,completeRuntimeTask,type RuntimeOperation} from "lfaa-jobs/src/runtime-environment-tasks.js";
import {getDaemonNode,listDaemonNodes} from "lfaa-host-daemon/src/local-daemon.js";
import {ApiError} from "lfaa-util-values/src/http-error.js";
const target=Joi.alternatives().try(Joi.string().valid("local"),Joi.string().guid()).required();
const operation=Joi.string().valid("detect","install","verify","register","remove","forget","update").required();
const schema=Joi.object({targetId:target,operation,major:Joi.number().integer().min(8).max(40),runtimeId:Joi.string().max(160),executablePath:Joi.string().max(2048),packageId:Joi.string().valid("vcredist-x64","vcredist-x86","directx-jun2010")}).unknown(false);
export function registerRuntimeRoutes(router:Router):void {
  router.get("/runtime-environments",requireAuthentication,asyncHandler(async(req,res)=>{res.setHeader("Cache-Control","no-store");res.json(await runtimeManager.overview(req.auth!.user.role));}));
  router.post("/runtime-environments/resolve",requireAuthentication,requireRole("admin"),asyncHandler(async(req,res)=>{const body=parseBody<{targetId:string;major:number}>(Joi.object({targetId:target,major:Joi.number().integer().min(8).max(40).required()}).unknown(false),req.body);res.json(await runtimeManager.resolve(body.targetId,body.major));}));
  router.get("/runtime-environments/tasks",requireAuthentication,requireRole("admin"),(req,res)=>res.json({tasks:listRuntimeTasks(req.auth!.user.id)}));
  router.post("/runtime-environments/tasks",requireAuthentication,requireRole("admin"),(req,res)=>{const body=parseBody<{targetId:string;operation:RuntimeOperation;major?:number;runtimeId?:string;executablePath?:string;packageId?:string}>(schema,req.body);res.status(202).json(runtimeManager.schedule({...body,userId:req.auth!.user.id,appId:"minecraft"}));});
  router.get("/runtime-environments/tasks/:taskId",requireAuthentication,requireRole("admin"),(req,res)=>{const task=getRuntimeTask(req.params.taskId);if(!task||task.createdBy!==req.auth!.user.id)throw new ApiError(404,"runtime_task_not_found","找不到当前账户的环境任务。");res.json(task);});
  router.post("/runtime-environments/tasks/:taskId/cancel",requireAuthentication,requireRole("admin"),(req,res)=>{const task=getRuntimeTask(req.params.taskId);if(!task||task.createdBy!==req.auth!.user.id)throw new ApiError(404,"runtime_task_not_found","找不到当前账户的环境任务。");res.json(cancelRuntimeTask(task.id,req.auth!.user.id));});
  router.get("/runtime-environments/storage/:targetId",requireAuthentication,requireRole("admin"),(req,res)=>res.json(runtimeStorageFor(req.params.targetId)));
  router.put("/runtime-environments/storage/:targetId",requireAuthentication,requireRole("admin"),()=>{throw new ApiError(410,"independent_storage_retired","运行环境、缓存和临时目录由该节点 data 根统一派生。");});
  const nodeBody=Joi.object({nodeId:Joi.string().guid().required()}).unknown(false);
  router.post("/daemon/runtime/tasks/claim",requireLocalDaemon,(req,res)=>{const body=parseBody<{nodeId:string}>(nodeBody,req.body);listDaemonNodes();const node=getDaemonNode(body.nodeId);if(!node||node.status!=="online"||!node.capabilities.includes("runtime-environment-v1"))throw new ApiError(409,"runtime_node_unavailable","节点尚未登记环境执行能力。");res.json({task:claimRuntimeTask(body.nodeId)});});
  router.post("/daemon/runtime/tasks/:taskId/renew",requireLocalDaemon,(req,res)=>{const body=parseBody<{nodeId:string}>(nodeBody,req.body);res.json(renewRuntimeTask(req.params.taskId,body.nodeId));});
  router.post("/daemon/runtime/tasks/:taskId/progress",requireLocalDaemon,(req,res)=>{const body=parseBody<{nodeId:string;progress:number;message:string}>(nodeBody.keys({progress:Joi.number().min(0).max(100).required(),message:Joi.string().max(1000).required()}),req.body);progressRuntimeTask(req.params.taskId,body.nodeId,body.progress,body.message);res.status(204).end();});
  router.post("/daemon/runtime/tasks/:taskId/complete",requireLocalDaemon,(req,res)=>{const body=parseBody<{nodeId:string;status:"succeeded"|"failed"|"cancelled";message:string;result:Record<string,unknown>}>(nodeBody.keys({status:Joi.string().valid("succeeded","failed","cancelled").required(),message:Joi.string().max(1000).required(),result:Joi.object().required()}),req.body);completeRuntimeTask(req.params.taskId,body.nodeId,body.status,body.message,body.result);res.status(204).end();});
}
