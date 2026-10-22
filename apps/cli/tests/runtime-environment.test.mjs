/** 功能：共享环境管理的长期回归。作用：隔离验证任务身份/去重/取消/租约、存储迁移与真实可执行文件复用。 */
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,mkdirSync,rmSync} from "node:fs";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {resolve,join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {EventEmitter} from "node:events";
import {createHash} from "node:crypto";
import {fetchRuntimeResource} from "../../../packages/host/runtime-environment/src/network.mjs";
import {downloadWindowsRuntime} from "../../../packages/host/runtime-environment/src/windows-runtimes.mjs";
import {createJavaRuntimeManager} from "../../../packages/host/runtime-environment/src/java-runtime.mjs";
import {createRuntimeIO} from "../../../packages/host/runtime-environment/src/runtime-io.mjs";
import {waitForNativeMinecraftReady,downloadCoreArtifact,buildMinecraftWindowsLauncher} from "../../../packages/host/daemon/src/minecraft-provisioner.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../..");
const parent=join(root,"dist/.tmp");mkdirSync(parent,{recursive:true});
test("环境任务隔离、重复合并、取消确认及租约未知；旧存储字段保持兼容",()=>{
  const data=mkdtempSync(join(parent,"runtime-owner-")),home=mkdtempSync(join(parent,"runtime-owner-home-"));
  try {execFileSync(process.execPath,["--import","tsx","--import","./register-package-loader.mjs","--input-type=module","-e",`
    import assert from 'node:assert/strict';import {join} from 'node:path';
    const {database,migrateRuntimeEnvironmentSchema,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
    const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
    await import('lfaa-session-persistence-jsonl/src/repository.js');
    const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');retireLegacyFileTables();
    const {minecraftCompletionSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
    const {buildMinecraftReadyResult}=await import('lfaa-host-daemon/src/minecraft-provisioner.mjs');
    const evidence=buildMinecraftReadyResult({coreType:'Paper',javaMajor:11},25566,false);
    const completion={nodeId:'00000000-0000-4000-8000-000000000001',succeeded:true,message:'已就绪',result:evidence};
    assert.equal(minecraftCompletionSchema.validate(completion).error,undefined);
    assert.equal(evidence.lanReachable,null);assert.equal(evidence.clientLoginVerified,false);
    assert.equal(minecraftCompletionSchema.validate({...completion,succeeded:false,result:{outcome:'cancelled'}}).error,undefined);
    assert.ok(minecraftCompletionSchema.validate({...completion,result:{...evidence,unregisteredSideEffect:true}}).error);
    for(const [id,uid] of [['owner',1],['other',2]])database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES (?,?,?,'salt','hash','admin')").run(id,uid,id);
    const jobs=await import('lfaa-jobs/src/runtime-environment-tasks.js');
    const input={targetId:'local',userId:'owner',appId:'minecraft',operation:'install',payload:{major:11}};
    const one=jobs.createRuntimeTask(input);assert.equal(jobs.createRuntimeTask(input).id,one.id);
    assert.notEqual(jobs.createRuntimeTask({...input,userId:'other'}).id,one.id);
    assert.throws(()=>jobs.cancelRuntimeTask(one.id,'other'),/当前账户/);
    const running=jobs.claimRuntimeTask('local');assert.equal(running.id,one.id);assert.equal(jobs.claimRuntimeTask('local'),null);
    jobs.cancelRuntimeTask(one.id,'owner');assert.equal(jobs.getRuntimeTask(one.id).status,'running');assert.equal(jobs.renewRuntimeTask(one.id,'local').cancelRequested,true);
    assert.throws(()=>jobs.completeRuntimeTask(one.id,'wrong','succeeded','fake',{}),/不属于/);
    jobs.completeRuntimeTask(one.id,'local','cancelled','执行器确认',{});assert.equal(jobs.getRuntimeTask(one.id).status,'cancelled');
    const next=jobs.claimRuntimeTask('local');database.prepare("UPDATE runtime_environment_tasks SET lease_expires_at='2000-01-01' WHERE id=?").run(next.id);
    assert.equal(jobs.getRuntimeTask(next.id).result.outcome,'unknown');assert.equal(jobs.claimRuntimeTask('local'),null);
    const storage=await import('lfaa-settings/src/project-storage.js');
    const before=storage.getProjectStorageLocations().settings;
    const legacy=join(process.env.LFAA_DATA_DIR,'other-environments');
    configuration.save('project_storage_locations',{id:1,runtime_directory:legacy});
    assert.equal(storage.getProjectStorageLocations().settings.runtimeDirectory,before.runtimeDirectory);
    assert.ok(storage.getRuntimeStorageLocations('local',process.env.LFAA_DATA_DIR,process.platform).previousRuntimeDirectories.includes(legacy));
    const remote=storage.getRuntimeStorageLocations('00000000-0000-4000-8000-000000000001','E:\\\\remote','win32');assert.equal(remote.runtimeDirectory,'E:\\\\remote\\\\environments');
    migrateRuntimeEnvironmentSchema();assert.equal(database.prepare('PRAGMA user_version').get().user_version,61);
    closeDatabase();
  `],{cwd:join(root,"apps/cli"),env:{...process.env,NODE_ENV:"test",LFAA_HOME:home,LFAA_DATA_DIR:data,JWT_SECRET:""},encoding:"utf8",stdio:"pipe"});}
  finally {rmSync(data,{recursive:true,force:true});rmSync(home,{recursive:true,force:true});}
});
test("共享 Java 探测保留完整版本；托管解析不依赖 PATH 或网络",async()=>{
  const data=await mkdtemp(join(parent,"runtime-java-"));
  try {
    const javaDirectory=join(data,"environments/java");const executable=join(javaDirectory,"temurin-11-windows-x64/bin/java.exe");await mkdir(dirname(executable),{recursive:true});await writeFile(executable,"fixture");
    const io=createRuntimeIO({roots:[data]});let network=0;
    const manager=createJavaRuntimeManager({repositoryRoot:root,dataDirectory:data,javaDirectory,downloadDirectory:join(data,"cache"),...io,captureProcess:async()=>({stdout:"",stderr:'openjdk version "11.0.29"\nOpenJDK Runtime Environment Temurin-11.0.29'}),fetchResource:async()=>{network++;throw new Error("不应下载");}});
    const runtime=await manager.resolveMinecraftJavaRuntime(11,null,async()=>{},30);assert.equal(runtime.major,11);assert.equal(runtime.version,"11.0.29");assert.equal(network,0);assert.equal(runtime.executable,executable);
    await assert.rejects(manager.resolveMinecraftJavaRuntime(17,"temurin-11",async()=>{},30),/不匹配/);
  }finally{await rm(data,{recursive:true,force:true});}
});
test("取消真实启动等待与下载，不接受存活 PID 为就绪",async()=>{
  const controller=new AbortController(),child=new EventEmitter();child.exitCode=null;child.signalCode=null;
  const pending=waitForNativeMinecraftReady(child,{serverReady:false},30,controller.signal);controller.abort(new DOMException("取消夹具","AbortError"));await assert.rejects(pending,/取消夹具/);assert.equal(child.listenerCount("exit"),0);
  const directory=await mkdtemp(join(parent,"runtime-cancel-"));
  try {await assert.rejects(downloadCoreArtifact({url:"https://fill-data.papermc.io/fixture.jar",algorithm:"sha256",digest:"a".repeat(64)},join(directory,"server.jar"),30,undefined,controller.signal,async()=>{controller.signal.throwIfAborted();}),/取消夹具/);}
  finally{await rm(directory,{recursive:true,force:true});}
});
test("托管更新下载失败恢复原 Java，外部文件和锁不会遗留",async()=>{
  const data=await mkdtemp(join(parent,"runtime-update-"));
  try {
    const javaDirectory=join(data,"environments/java"),executable=join(javaDirectory,"temurin-11-windows-x64/bin/java.exe");await mkdir(dirname(executable),{recursive:true});await writeFile(executable,"original-java-fixture");
    const io=createRuntimeIO({roots:[data]});const manager=createJavaRuntimeManager({repositoryRoot:root,dataDirectory:data,javaDirectory,downloadDirectory:join(data,"cache"),...io,captureProcess:async()=>({stdout:"",stderr:'openjdk version "11.0.29"'}),fetchResource:async()=>{throw new Error("官方源离线夹具");}});
    await assert.rejects(manager.updateTemurinRuntime(11,async()=>{},30),/官方源离线夹具/);
    const {readFile,readdir}=await import("node:fs/promises");assert.equal(await readFile(executable,"utf8"),"original-java-fixture");assert.deepEqual(await readdir(javaDirectory),["temurin-11-windows-x64"]);
  }finally{await rm(data,{recursive:true,force:true});}
});
test("导出的启动脚本保留 Java 完整路径并拒绝命令字符注入",()=>{
  const metadata={coreType:"Paper",memoryMb:2048,launch:{kind:"jar",path:"server.jar"}};
  const script=buildMinecraftWindowsLauncher(metadata,{executable:'C:\\Java %custom%\\bin\\java.exe'});
  assert.ok(script.includes('"C:\\Java %%custom%%\\bin\\java.exe"'));assert.ok(script.includes('"-Xmx2048M" "-jar" "server.jar" "nogui"'));
  assert.throws(()=>buildMinecraftWindowsLauncher({...metadata,launch:{kind:"jar",path:'server.jar" & arbitrary-command'}},{executable:"C:\\java.exe"}),/字符/);
});
test("官方资源连接重置重试一次；普通 404 不重试，取消不重放",async()=>{
  const previous=globalThis.fetch;let requests=0;
  try {
    globalThis.fetch=async()=>{if(++requests===1)throw Object.assign(new Error("reset fixture"),{code:"ECONNRESET"});return new Response("fixture");};
    const value=await fetchRuntimeResource("https://fill.papermc.io/fixture");assert.equal(await value.text(),"fixture");assert.equal(requests,2);
    requests=0;globalThis.fetch=async()=>{requests++;return new Response("missing",{status:404});};assert.equal((await fetchRuntimeResource("https://fill.papermc.io/fixture")).status,404);assert.equal(requests,1);
    const controller=new AbortController();controller.abort(new DOMException("cancel fixture","AbortError"));requests=0;globalThis.fetch=async()=>{requests++;controller.signal.throwIfAborted();};await assert.rejects(fetchRuntimeResource("https://fill.papermc.io/fixture",{signal:controller.signal}),/cancel fixture/);assert.equal(requests,1);
  }finally{globalThis.fetch=previous;}
});
test("工件 ECONNRESET 可恢复；Microsoft 签名失败不提升安装包或误报已安装",async()=>{
  const data=await mkdtemp(join(parent,"runtime-download-"));
  try {
    const bytes=Buffer.from("isolated artifact fixture"),digest=createHash("sha256").update(bytes).digest("hex");let attempts=0;
    await downloadCoreArtifact({url:"https://fill-data.papermc.io/fixture.jar",algorithm:"sha256",digest},join(data,"server.jar"),30,undefined,undefined,async()=>{if(++attempts===1)throw Object.assign(new Error("reset"),{code:"ECONNRESET"});return new Response(bytes);});assert.equal(attempts,2);
    const storage={runtimeDirectory:data},io=createRuntimeIO({roots:[data]});
    await assert.rejects(downloadWindowsRuntime("vcredist-x64",storage,{...io,captureProcess:async()=>{throw new Error("signature rejected fixture");}},30,undefined,undefined,async()=>new Response(bytes)),/signature rejected/);
    const {readdir}=await import("node:fs/promises");assert.deepEqual(await readdir(join(data,"VisualCpp")),[]);
    const result=await downloadWindowsRuntime("vcredist-x64",storage,{...io,captureProcess:async()=>({stdout:"",stderr:""})},30,undefined,undefined,async()=>new Response(bytes));assert.equal(result.downloaded,true);assert.equal(result.installed,false);
    await assert.rejects(downloadWindowsRuntime("directx-jun2010",storage,io,30,undefined,undefined,async()=>new Response(null,{status:302,headers:{location:"https://untrusted.invalid/program.exe"}})),/官方 HTTPS/);
  }finally{await rm(data,{recursive:true,force:true});}
});
