/** 隔离验证实例删除的互斥、停止前置条件、真实归档回执及历史数据保留。 */
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,rmSync} from "node:fs";
import {resolve,join} from "node:path";
import {randomUUID} from "node:crypto";
const parent=resolve("../../dist/.tmp");mkdirSync(parent,{recursive:true});const data=mkdtempSync(join(parent,"minecraft-archive-"));
process.env.LFAA_DATA_DIR=data;process.env.NODE_ENV="test";process.env.JWT_SECRET="";
const {database,closeDatabase,migrateMinecraftArchiveSchema}=await import("lfaa-storage-sqlite/src/database.js");
await import("lfaa-session/src/sessions.js");
const {retireLegacyFileTables}=await import("lfaa-storage-domain/src/migration.js");retireLegacyFileTables();
const {recordDaemonHeartbeat}=await import("lfaa-host-daemon/src/local-daemon.js");
const {deleteMinecraftInstance}=await import("lfaa-games-minecraft/src/service.js");
const queue=await import("lfaa-jobs/src/minecraft-queue.js");
const {minecraftCompletionSchema}=await import("lfaa-api-remotes/src/route-contracts.js");
const userId=randomUUID(),nodeId=randomUUID();
database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES(?,?,'salt','hash','admin')").run(userId,`fixture-${userId}`);
recordDaemonHeartbeat({id:nodeId,displayName:"隔离节点",platform:"win32",architecture:"x64",version:"fixture",dataRoot:data,capabilities:["minecraft-vanilla","minecraft-native-v1","minecraft-instance-archive-v1"],javaRuntimes:[]});
test.after(()=>{closeDatabase();assert.ok(data.startsWith(join(parent,"minecraft-archive-")));rmSync(data,{recursive:true,force:true});});
test("删除拒绝运行状态；未知交由节点核验；缺少归档回执不移除；成功后释放名称并保留任务",()=>{
  const id=randomUUID(),deploymentId=randomUUID();
  database.prepare("INSERT INTO minecraft_instances(id,node_id,created_by,name,release_id,java_major,memory_mb,state,eula_accepted_at) VALUES(?,?,?,'archive-fixture','1.16.5',11,2048,'running',?)").run(id,nodeId,userId,new Date().toISOString());
  database.prepare("INSERT INTO minecraft_deployments(id,node_id,created_by,name,server_type,release_id,java_major,state,instance_id) VALUES(?,?,?,'archive-fixture','Paper','1.16.5',11,'registered',?)").run(deploymentId,nodeId,userId,id);
  assert.throws(()=>deleteMinecraftInstance(id,userId),/先安全停止/);
  database.prepare("UPDATE minecraft_instances SET state='unknown' WHERE id=?").run(id);

  const one=deleteMinecraftInstance(id,userId);assert.throws(()=>deleteMinecraftInstance(id,userId),/未完成|排队/);
  queue.claimNextMinecraftTask(nodeId,true);queue.completeMinecraftTask(one.id,nodeId,true,"缺少回执",{});
  assert.equal(queue.getMinecraftTask(one.id).status,"failed");assert.ok(database.prepare("SELECT id FROM minecraft_instances WHERE id=?").get(id));
  const next=deleteMinecraftInstance(id,userId);queue.claimNextMinecraftTask(nodeId,true);
  const evidence={archived:true,backupName:`${id}-${next.id}`};assert.equal(minecraftCompletionSchema.validate({nodeId,succeeded:true,message:"已归档",result:evidence}).error,undefined);
  queue.completeMinecraftTask(next.id,nodeId,true,"已归档",evidence);
  assert.equal(database.prepare("SELECT id FROM minecraft_instances WHERE id=?").get(id),undefined);
  assert.equal(database.prepare("SELECT id FROM minecraft_deployments WHERE id=?").get(deploymentId),undefined);
  assert.equal(queue.getMinecraftTask(next.id).status,"succeeded");assert.equal(queue.getMinecraftTask(next.id).instanceId,null);
  migrateMinecraftArchiveSchema();assert.equal(database.prepare("PRAGMA user_version").get().user_version,59);assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(),[]);
});
