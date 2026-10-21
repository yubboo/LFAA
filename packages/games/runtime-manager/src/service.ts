/** 功能：运行环境控制与本机任务执行 Owner。作用：共享任务/设置/设备身份，模型负责选择，执行器返回真实证据。 */
import {windowsRuntimeCatalog} from "lfaa-runtime-environment/src/windows-runtimes.mjs";
import {hostname} from "node:os";
import {config} from "lfaa-launch-environment/src/config.js";
import {findRepositoryRoot} from "lfaa-home-paths/src/index.mjs";
import {getDaemonDataRoot,getDaemonNode,listDaemonNodes} from "lfaa-host-daemon/src/local-daemon.js";
import {getLocalDaemonNodeId} from "lfaa-host-daemon/src/node-credentials.js";
import {database} from "lfaa-storage-sqlite/src/database.js";
import {getProjectStorageLocations,getRuntimeStorageLocations,type RuntimeStorageLocations} from "lfaa-settings/src/project-storage.js";
import {getUserSettings} from "lfaa-settings/src/service.js";
import {createRuntimeExecutor} from "lfaa-runtime-environment/src/executor.mjs";
import {cancelRuntimeTask,claimRuntimeTask,completeRuntimeTask,createRuntimeTask,getRuntimeTask,listRuntimeTasks,progressRuntimeTask,renewRuntimeTask,type RuntimeOperation,type RuntimeTask} from "lfaa-jobs/src/runtime-environment-tasks.js";
import {ApiError} from "lfaa-util-values/src/http-error.js";
import type {ApplicationId} from "lfaa-util-values/src/application-id.js";

function localNodeId():string|null {return getLocalDaemonNodeId();}
export function assertRuntimeUnused(targetId:string,major:number):void {
  const id=targetId==="local"?localNodeId():targetId;if(!id)return;
  const instance=database.prepare("SELECT name FROM minecraft_instances WHERE node_id=? AND java_major=? AND state IN ('installing','starting','running','stopping','unknown') LIMIT 1").get(id,major) as {name:string}|undefined;
  if(instance)throw new ApiError(409,"runtime_in_use",`实例“${instance.name}”正在使用 Java ${major} 或状态未确认，暂不能卸载/更新。`);
}
export function runtimeStorageFor(targetId:string):RuntimeStorageLocations {
  const localDataRoot=getProjectStorageLocations().settings.contentDirectory;
  if(targetId==="local")return getRuntimeStorageLocations("local",localDataRoot,process.platform);
  const node=getDaemonNode(targetId);const root=getDaemonDataRoot(targetId);if(!node||!root)throw new ApiError(404,"runtime_target_not_found","找不到已登记的运行环境设备。");
  return getRuntimeStorageLocations(targetId,root,node.platform,targetId===localNodeId()?getRuntimeStorageLocations("local",localDataRoot,process.platform):undefined);
}

export class RuntimeManager {
  private cachedLocal: Array<Record<string,unknown>>=[];
  private discoveredAt=0;
  private discovering:Promise<Array<Record<string,unknown>>>|null=null;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private controller:AbortController|undefined;
  private worker:Promise<void>|undefined;
  private stopped=true;
  private localExecutor(signal?:AbortSignal,storage=runtimeStorageFor("local")){return createRuntimeExecutor({dataDirectory:config.dataDirectory,repositoryRoot:findRepositoryRoot(import.meta.url),storage,...(signal?{signal}:{}),checkDependencies:async(runtime:{major?:number})=>{if(runtime.major)assertRuntimeUnused("local",runtime.major);}});}
  async localEnvironments(force=false):Promise<Array<Record<string,unknown>>> {
    if(!force&&Date.now()-this.discoveredAt<60000)return this.cachedLocal;
    if(this.discovering)return this.discovering;
    this.discovering=this.localExecutor().list().then((value:Array<Record<string,unknown>>)=>{this.cachedLocal=value;this.discoveredAt=Date.now();return value;}).finally(()=>{this.discovering=null;});
    return this.discovering!;
  }
  async overview(role:string) {
    const local=await this.localEnvironments();
    // 保留节点真实检测回执；再次进入页面不能把已检测的 Microsoft 组件显示成未安装。
    const snapshots=new Map<string,Array<Record<string,unknown>>>();
    const rows=database.prepare("SELECT target_id,result_json FROM runtime_environment_tasks WHERE status='succeeded' AND json_type(result_json,'$.runtimes')='array' ORDER BY finished_at DESC LIMIT 128").all() as Array<{target_id:string;result_json:string}>;
    for(const row of rows)if(!snapshots.has(row.target_id))snapshots.set(row.target_id,(JSON.parse(row.result_json).runtimes as Array<Record<string,unknown>>).filter(item=>item&&typeof item==="object"&&windowsRuntimeCatalog.some(entry=>entry.id===item.runtimeId&&entry.type===item.type)).map(item=>({runtimeId:String(item.runtimeId),type:String(item.type),vendor:"Microsoft",managed:false,source:"system",available:item.available===true,...Object.fromEntries(["version","executablePath","detectedAt"].filter(key=>typeof item[key]==="string"&&String(item[key]).length<=2048).map(key=>[key,item[key]]))})));
    const visible=(runtimes:Array<Record<string,unknown>>)=>role==="member"?runtimes.map(({executablePath,root,executable,...rest})=>rest):runtimes;
    const devices=[{id:"local",displayName:`本机控制端 · ${hostname()}`,platform:process.platform,architecture:process.arch,status:"online",runtimes:visible(local),...(role!=="member"?{storage:runtimeStorageFor("local")}: {})},...listDaemonNodes().map(node=>({id:node.id,displayName:`节点 · ${node.displayName}`,platform:node.platform,architecture:node.architecture,status:node.status,runtimes:visible([...node.javaRuntimes.map(runtime=>({...runtime,type:"java",available:node.status==="online",detectedAt:node.lastSeenAt})),...(node.capabilities.includes("steamcmd-ready-v1")?[{runtimeId:"steamcmd",type:"steamcmd",vendor:"Valve",source:"managed",managed:true,available:node.status==="online",detectedAt:node.lastSeenAt}]:[])]),...(role!=="member"?{storage:runtimeStorageFor(node.id)}:{})}))];
    for(const device of devices)if(device.id!=="local")device.runtimes.push(...visible((snapshots.get(device.id)??[]).map(item=>({...item,available:device.status==="online"&&item.available===true}))));
    const controlNodeId=localNodeId();
    const servers=database.prepare("SELECT id,name,node_id,java_major,core_type,state FROM minecraft_instances ORDER BY updated_at DESC LIMIT 200").all() as Array<{id:string;name:string;node_id:string;java_major:number;core_type:string;state:string}>;
    return {devices:devices.map(device=>({...device,servers:servers.filter(server=>server.node_id===(device.id==="local"?controlNodeId:device.id)).map(server=>({id:server.id,name:server.name,requiredJavaMajor:server.core_type==="PocketMine"?null:server.java_major,state:server.state}))})),packages:windowsRuntimeCatalog};
  }
  async resolve(targetId:string,major:number) {
    if(!Number.isInteger(major)||major<8||major>40)throw new ApiError(400,"runtime_requirement_invalid","Java 需求必须来自已确认的服务端要求。");
    const runtimes:Array<{major?:unknown;[key:string]:unknown}>=targetId==="local"?await this.localEnvironments():(getDaemonNode(targetId)?.javaRuntimes??[]).map(runtime=>({...runtime}));
    const matches=runtimes.filter(runtime=>runtime.major===major);
    return {targetId,requiredMajor:major,installed:matches.length>0,runtimes:matches,storage:runtimeStorageFor(targetId),note:matches.length?"已发现匹配的实际运行环境，执行时仍会校验可执行文件。":"没有已验证的匹配环境，可选择安装或注册已有路径。"};
  }
  schedule(input:{targetId:string;userId:string;appId:ApplicationId;operation:RuntimeOperation;major?:number;runtimeId?:string;executablePath?:string;packageId?:string}):RuntimeTask {
    if(!["detect","install","verify","register","remove","forget","update"].includes(input.operation))throw new ApiError(400,"runtime_operation_unavailable","没有登记此环境操作。");
    if(["verify","remove","forget","update"].includes(input.operation)&&!input.runtimeId)throw new ApiError(400,"runtime_id_required","此操作需要当前设备检测结果中的环境 ID。");
    if(input.operation==="register"&&!input.executablePath)throw new ApiError(400,"runtime_path_required","注册环境需要完整可执行文件路径。");
    if(input.targetId!=="local"){listDaemonNodes();const node=getDaemonNode(input.targetId);if(!node||node.status!=="online"||!node.capabilities.includes("runtime-environment-v1"))throw new ApiError(409,"runtime_target_unavailable","目标节点离线或尚未加载统一运行环境执行器。");}
    if(input.packageId&&(!windowsRuntimeCatalog.some(item=>item.id===input.packageId)||input.operation!=="install"))throw new ApiError(400,"runtime_package_invalid","未登记此运行库下载操作。");
    if(!input.packageId&&["install","update"].includes(input.operation)&&(!Number.isInteger(input.major)||input.major!<8||input.major!>40))throw new ApiError(400,"runtime_major_invalid","请输入有效 Java 主版本。");
    if(["remove","update"].includes(input.operation)&&input.major)assertRuntimeUnused(input.targetId,input.major);
    const storage=runtimeStorageFor(input.targetId);
    return createRuntimeTask({targetId:input.targetId,userId:input.userId,appId:input.appId,operation:input.operation,payload:{...(input.packageId?{packageId:input.packageId}:{}),...(input.major?{major:input.major}:{}),...(input.runtimeId?{runtimeId:input.runtimeId}:{}),...(input.executablePath?{executablePath:input.executablePath}:{}),storage,downloadTimeoutSeconds:getUserSettings(input.userId).minecraftRuntime.minecraftDownloadTimeoutSeconds}});
  }
  start():()=>Promise<void> {
    this.stopped=false;
    const tick=async()=>{
      if(this.stopped)return;
      try {const task=claimRuntimeTask("local");if(task)await this.executeLocal(task);}
      catch(error){process.stderr.write(`本机运行环境任务失败：${error instanceof Error?error.message:"未知错误"}\n`);}
      finally{if(!this.stopped)this.timer=setTimeout(()=>{this.worker=tick();},500);}
    };
    this.worker=tick();
    return async()=>{this.stopped=true;if(this.timer)clearTimeout(this.timer);this.controller?.abort(new DOMException("运行环境服务正在卸载。","AbortError"));await this.worker;};
  }
  private async executeLocal(task:RuntimeTask):Promise<void> {
    const controller=new AbortController();this.controller=controller;
    const heartbeat=setInterval(()=>{try{if(renewRuntimeTask(task.id,"local").cancelRequested)controller.abort(new DOMException("用户取消运行环境任务。","AbortError"));}catch(error){controller.abort(error);}},3000);
    try {
      const result=await this.localExecutor(controller.signal,task.payload.storage as unknown as RuntimeStorageLocations).execute(task.operation,task.payload,(progress:number,message:string)=>progressRuntimeTask(task.id,"local",progress,message));
      controller.signal.throwIfAborted();completeRuntimeTask(task.id,"local","succeeded","运行环境操作已完成并取得实际结果。",result);this.discoveredAt=0;
    }catch(error){completeRuntimeTask(task.id,"local",controller.signal.aborted?"cancelled":"failed",controller.signal.aborted?"执行器已确认取消；已完成的配置变更不会假装回滚，请核对环境状态。":error instanceof Error?error.message:"运行环境执行失败。",{});}
    finally{clearInterval(heartbeat);this.controller=undefined;}
  }
}
export const runtimeManager=new RuntimeManager();
export {getRuntimeTask,listRuntimeTasks,cancelRuntimeTask};
