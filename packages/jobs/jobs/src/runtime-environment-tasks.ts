/** 功能：运行环境任务的唯一持久化队列。作用：本机与远端共用一次领取、进度、租约和真实取消，不在重启后重放未知操作。 */
import {randomUUID} from "node:crypto";
import {database} from "lfaa-storage-sqlite/src/database.js";
import type {ApplicationId} from "lfaa-util-values/src/application-id.js";
export type RuntimeOperation = "detect" | "install" | "verify" | "register" | "remove" | "forget" | "update";
export interface RuntimeTask {id:string;targetId:string;createdBy:string;appId:ApplicationId;operation:RuntimeOperation;payload:Record<string,unknown>;status:"queued"|"running"|"succeeded"|"failed"|"cancelled";progress:number;message:string;cancelRequested:boolean;result:Record<string,unknown>;createdAt:string;startedAt:string|null;finishedAt:string|null;}
function view(row:Record<string,unknown>):RuntimeTask {
  return {id:String(row.id),targetId:String(row.target_id),createdBy:String(row.created_by),appId:row.app_id as ApplicationId,operation:row.operation as RuntimeOperation,payload:JSON.parse(String(row.payload_json)),status:row.status as RuntimeTask["status"],progress:Number(row.progress),message:String(row.message),cancelRequested:row.cancel_requested===1,result:JSON.parse(String(row.result_json)),createdAt:String(row.created_at),startedAt:row.started_at as string|null,finishedAt:row.finished_at as string|null};
}
function expire():void {
  database.prepare("UPDATE runtime_environment_tasks SET status='failed',message='运行环境执行租约已过期，结果未知；请核对目标设备后决定恢复，不会自动重放。',result_json=?,finished_at=? WHERE status='running' AND lease_expires_at < ?").run(JSON.stringify({outcome:"unknown"}),new Date().toISOString(),new Date().toISOString());
}
export function getRuntimeTask(id:string):RuntimeTask|null {expire();const row=database.prepare("SELECT * FROM runtime_environment_tasks WHERE id=?").get(id) as Record<string,unknown>|undefined;return row?view(row):null;}
export function listRuntimeTasks(userId:string):RuntimeTask[]{expire();return (database.prepare("SELECT * FROM runtime_environment_tasks WHERE created_by=? ORDER BY created_at DESC,rowid DESC LIMIT 100").all(userId) as Record<string,unknown>[]).map(view);}
export function createRuntimeTask(input:{targetId:string;userId:string;appId:ApplicationId;operation:RuntimeOperation;payload:Record<string,unknown>}):RuntimeTask {
  database.exec("BEGIN IMMEDIATE;");
  try {
    expire();
    const payload=JSON.stringify(input.payload);
    if(payload.length>16384)throw new Error("运行环境任务参数过大。");
    // 同一设备的相同实际操作复用未完成任务；不同账户不能读取彼此结果。
    const existing=database.prepare("SELECT * FROM runtime_environment_tasks WHERE target_id=? AND created_by=? AND app_id=? AND operation=? AND payload_json=? AND status IN ('queued','running') LIMIT 1").get(input.targetId,input.userId,input.appId,input.operation,payload) as Record<string,unknown>|undefined;
    if(existing){database.exec("COMMIT;");return view(existing);}
    const id=randomUUID();database.prepare("INSERT INTO runtime_environment_tasks(id,target_id,created_by,app_id,operation,payload_json,status,message,created_at) VALUES(?,?,?,?,?,?,'queued','等待运行环境执行器。',?)").run(id,input.targetId,input.userId,input.appId,input.operation,payload,new Date().toISOString());
    database.exec("COMMIT;");return getRuntimeTask(id)!;
  }catch(error){if(database.isTransaction)database.exec("ROLLBACK;");throw error;}
}
export function claimRuntimeTask(targetId:string):RuntimeTask|null {
  expire();database.exec("BEGIN IMMEDIATE;");
  try {
    if(database.prepare("SELECT 1 FROM runtime_environment_tasks WHERE target_id=? AND status='running'").get(targetId)){database.exec("COMMIT;");return null;}
    const row=database.prepare("SELECT id FROM runtime_environment_tasks WHERE target_id=? AND status='queued' ORDER BY created_at,rowid LIMIT 1").get(targetId) as {id:string}|undefined;
    if(!row){database.exec("COMMIT;");return null;}
    database.prepare("UPDATE runtime_environment_tasks SET status='running',started_at=?,lease_expires_at=?,message='正在执行运行环境任务。' WHERE id=? AND status='queued'").run(new Date().toISOString(),new Date(Date.now()+30000).toISOString(),row.id);
    database.exec("COMMIT;");return getRuntimeTask(row.id);
  }catch(error){if(database.isTransaction)database.exec("ROLLBACK;");throw error;}
}
export function renewRuntimeTask(id:string,targetId:string):{cancelRequested:boolean} {
  expire();
  const result=database.prepare("UPDATE runtime_environment_tasks SET lease_expires_at=? WHERE id=? AND target_id=? AND status='running'").run(new Date(Date.now()+30000).toISOString(),id,targetId);
  if(result.changes!==1)throw new Error("运行环境任务不属于当前设备或租约已结束。");
  return {cancelRequested:getRuntimeTask(id)!.cancelRequested};
}
export function progressRuntimeTask(id:string,targetId:string,progress:number,message:string):void {renewRuntimeTask(id,targetId);database.prepare("UPDATE runtime_environment_tasks SET progress=?,message=? WHERE id=? AND target_id=? AND status='running'").run(Math.max(0,Math.min(99,Math.round(progress))),message.slice(0,1000),id,targetId);}
export function completeRuntimeTask(id:string,targetId:string,status:"succeeded"|"failed"|"cancelled",message:string,result:Record<string,unknown>):void {
  expire();
  const serialized=JSON.stringify(result);if(serialized.length>262144)throw new Error("运行环境结果超过上限。");
  const changed=database.prepare("UPDATE runtime_environment_tasks SET status=?,message=?,result_json=?,progress=?,finished_at=?,lease_expires_at=NULL WHERE id=? AND target_id=? AND status='running'").run(status,message.slice(0,1000),serialized,status==="succeeded"?100:0,new Date().toISOString(),id,targetId);
  if(changed.changes!==1)throw new Error("运行环境任务已结束或不属于当前执行设备，未重复提交。");
}
export function cancelRuntimeTask(id:string,userId:string):RuntimeTask {
  const task=getRuntimeTask(id);if(!task||task.createdBy!==userId)throw new Error("找不到当前账户的运行环境任务。");
  if(task.status==="queued")database.prepare("UPDATE runtime_environment_tasks SET status='cancelled',cancel_requested=1,message='任务尚未执行，已取消。',finished_at=? WHERE id=? AND created_by=? AND status='queued'").run(new Date().toISOString(),id,userId);
  else if(task.status==="running")database.prepare("UPDATE runtime_environment_tasks SET cancel_requested=1,message='已请求取消，等待执行器确认安全退出。' WHERE id=? AND created_by=? AND status='running'").run(id,userId);
  return getRuntimeTask(id)!;
}
