/** 真实隔离目录验证首次安装不会被占位文件阻断，也不覆盖用户文件。 */
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readdir,readFile,rm,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {promoteSteamcmdInstallation,initializeSteamcmd} from "../../../packages/host/daemon/src/steamcmd-installation.mjs";
import {createRuntimeIO} from "../../../packages/host/runtime-environment/src/runtime-io.mjs";
const parent=resolve("../../dist/.tmp");await mkdir(parent,{recursive:true});
test("SteamCMD 在空占位目录原子安装并保留 .gitkeep",async()=>{
  const data=await mkdtemp(join(parent,"steamcmd-install-"));
  try {
    const stage=join(data,"cache/task.staging"),target=join(data,"lib/steamcmd");await mkdir(stage,{recursive:true});await mkdir(target,{recursive:true});await writeFile(join(target,".gitkeep"),"");await writeFile(join(stage,"steamcmd.exe"),"isolated fixture");
    const io=createRuntimeIO({roots:[data]});
    await promoteSteamcmdInstallation(stage,target,(path,allowMissing=false)=>io.assertSafeFileTarget(path,allowMissing));
    assert.deepEqual((await readdir(target)).sort(),[".gitkeep","steamcmd.exe"]);assert.equal(await readFile(join(target,"steamcmd.exe"),"utf8"),"isolated fixture");assert.deepEqual(await readdir(join(data,"cache")),[]);
  }finally{await rm(data,{recursive:true,force:true});}
});
test("SteamCMD 拒绝真实文件、非空占位和既有回退目录，保留原件",async()=>{
  const data=await mkdtemp(join(parent,"steamcmd-preserve-"));
  try {
    const stage=join(data,"stage"),target=join(data,"target");await mkdir(stage);await mkdir(target);await writeFile(join(stage,"steamcmd.exe"),"fixture");await writeFile(join(target,"world.txt"),"user fixture");
    const safe=createRuntimeIO({roots:[data]}).assertSafeFileTarget;
    await assert.rejects(promoteSteamcmdInstallation(stage,target,safe),/其他文件/);assert.equal(await readFile(join(target,"world.txt"),"utf8"),"user fixture");
    await rm(join(target,"world.txt"));await writeFile(join(target,".gitkeep"),"user content");await assert.rejects(promoteSteamcmdInstallation(stage,target,safe),/非空/);assert.equal(await readFile(join(target,".gitkeep"),"utf8"),"user content");
    await writeFile(join(target,".gitkeep"),"");await mkdir(`${stage}.previous-empty`);await assert.rejects(promoteSteamcmdInstallation(stage,target,safe),/回退目录已存在/);assert.equal(await readFile(join(target,".gitkeep"),"utf8"),"");
  }finally{await rm(data,{recursive:true,force:true});}
});
test("SteamCMD 仅在客户端真实替换后继续一次核验，普通失败不重放",async()=>{
  const data=await mkdtemp(join(parent,"steamcmd-bootstrap-"));
  try {
    const file=join(data,"steamcmd.exe");await writeFile(file,"bootstrap fixture");let calls=0,updates=0;
    const result=await initializeSteamcmd(file,{timeout:2000},()=>{updates++;},async()=>{if(++calls===1){await writeFile(file,"updated client fixture with a different size");throw Object.assign(new Error("updater restarted fixture"),{code:1});}return {stdout:"Steam Console Client (c) Valve Corporation - version fixture",stderr:""};});
    assert.match(result,/version fixture/);assert.equal(calls,2);assert.equal(updates,1);
    calls=0;await assert.rejects(initializeSteamcmd(file,{timeout:2000},undefined,async()=>{calls++;throw Object.assign(new Error("ordinary network fixture"),{code:1});}),/ordinary network/);assert.equal(calls,1);
    await assert.rejects(initializeSteamcmd(file,{timeout:2000},undefined,async()=>({stdout:"unrelated success",stderr:""})),/未返回真实客户端版本/);
  }finally{await rm(data,{recursive:true,force:true});}
});
