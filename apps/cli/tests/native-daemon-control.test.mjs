/**
 * 功能：在隔离环境验证真实 Windows Daemon 的控制端任务链。
 * 作用：首次账户认证后启动源码节点，实际执行 PowerShell、读取运行中输出并请求取消；不触碰用户数据或真实游戏。
 * 关联文件：boot/app-boot、api/job-controller、api/session-controller、host/daemon/daemon.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("真实节点执行、认证读取增量输出和取消确认", { skip: process.platform !== "win32" || process.arch !== "x64", timeout: 65000 }, () => {
  const parent = resolve(tmpdir()), data = mkdtempSync(join(parent, "lfaa-native-control-"));
  const home = mkdtempSync(join(parent, "lfaa-native-control-home-"));
  const profileDirectories = { USERPROFILE: home, HOME: home, APPDATA: join(home, "AppData", "Roaming") };
  mkdirSync(profileDirectories.APPDATA, { recursive: true });
  try {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict'; import {createServer} from 'node:http'; import {once} from 'node:events'; import {spawn} from 'node:child_process'; import {mkdirSync,readFileSync,existsSync} from 'node:fs'; import {join} from 'node:path';
      const reservation=createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening'); process.env.SERVER_PORT=String(reservation.address().port); await new Promise(resolve=>reservation.close(resolve));
      const base='http://127.0.0.1:'+process.env.SERVER_PORT+'/api'; const {boot}=await import('lfaa-app-boot/src/index.js'); const context=await boot(['web']);
        let daemon; let daemonExit; let logs=''; let lastTaskState=null;
        const until=async(action,attempts=400)=>{for(let i=0;i<attempts;i++){const result=await action();if(result)return result;if(daemon&&(daemon.exitCode!==null||daemon.signalCode!==null))throw Error('真实节点提前退出：'+daemon.exitCode+' '+daemon.signalCode+' '+logs.slice(-1200));await new Promise(resolve=>setTimeout(resolve,50));}throw Error('真实节点等待超时：'+logs.slice(-1200)+' task='+JSON.stringify(lastTaskState));};
      try {
        assert.equal((await fetch(base+'/daemon-nodes/credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:'测试节点'})})).status,401);
        const setup=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'123456'})});assert.equal(setup.status,200);
        const headers={'Content-Type':'application/json',Cookie:setup.headers.get('set-cookie').split(';')[0]}; const {user}=await setup.json();
        daemon=spawn(process.execPath,['--import','tsx','--import','./register-package-loader.mjs','src/index.ts','daemon'],{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
        daemonExit=new Promise((resolveExit,rejectExit)=>{daemon.once('error',rejectExit);daemon.once('exit',code=>resolveExit(code));});daemon.stdout.on('data',data=>{logs+=data;});daemon.stderr.on('data',data=>{logs+=data;});
          const {createAiHostTask}=await import('lfaa-jobs/src/ai-host-tasks.js');
          let lastNodeRead=0;const node=await until(async()=>{if(Date.now()-lastNodeRead<250)return null;lastNodeRead=Date.now();const response=await fetch(base+'/minecraft/nodes',{headers});if(!response.ok)return null;const payload=await response.json();return payload.nodes.find(item=>item.status==='online'&&item.capabilities.includes('agent-shell-v1'))});
          const readTask=async id=>{const response=await fetch(base+'/ai/host-tasks/'+id,{headers});if(!response.ok)return null;return (await response.json()).task;};
          const task=createAiHostTask({nodeId:node.id,createdBy:user.id,appId:'workspace',shell:'powershell',workingDirectory:'',command:"Write-Output 'lfaa-live-output 中文日志'; Start-Sleep -Seconds 30",timeoutSeconds:60});
          await until(async()=>{lastTaskState=await readTask(task.id);return lastTaskState?.result?.stdout.includes('lfaa-live-output')});
        const snapshot=await fetch(base+'/ai/host-tasks/'+task.id,{headers});assert.equal(snapshot.status,200);const observed=(await snapshot.json()).task;assert.equal(observed.status,'running');assert.equal(observed.result.exitCode,null);
        assert.match(observed.result.stdout,/中文日志/);
        assert.equal((await fetch(base+'/ai/host-tasks/'+task.id+'/cancel',{method:'POST',headers})).status,202);
        const final=await until(async()=>{const value=await readTask(task.id);lastTaskState=value;return value?.status==='failed'?value:null;},160);assert.equal(final.result.cancelled,true);assert.match(final.result.stdout,/lfaa-live-output/);assert.equal(final.result.sandbox.mode,'danger-full-access');assert.equal(final.result.sandbox.enforcement,'none');
        assert.ok(node.capabilities.includes('app-sandbox-windows-appcontainer-v1'),'真实 Daemon 应只在 Windows AppContainer Host 已就绪时登记 Provider');
        const workspaceRoot=join(process.env.LFAA_DATA_DIR,'agent-workspace');mkdirSync(workspaceRoot,{recursive:true});
        const writePath=join(workspaceRoot,'written.txt');const quotedWritePath=writePath.replace(/'/gu,"''");
        const writeTask=createAiHostTask({nodeId:node.id,createdBy:user.id,appId:'workspace',shell:'powershell',workingDirectory:workspaceRoot,workspaceRoot,sandboxMode:'workspace-write',command:"$ErrorActionPreference='Stop'; Set-Content -NoNewline -LiteralPath '"+quotedWritePath+"' -Value 'node-sandbox-write'; Write-Output 'workspace-write-confirmed'",timeoutSeconds:20});
          const writeFinal=await until(async()=>{const value=await readTask(writeTask.id);lastTaskState=value;return value?.status==='succeeded'||value?.status==='failed'?value:null;});assert.equal(writeFinal.status,'succeeded',writeFinal.message+' '+writeFinal.result?.stderr);assert.equal(writeFinal.result.sandbox.mode,'workspace-write');assert.equal(writeFinal.result.sandbox.enforcement,'full');assert.equal(writeFinal.result.sandbox.hostVerified,true);assert.match(writeFinal.result.stdout,/workspace-write-confirmed/);assert.doesNotMatch(writeFinal.result.stderr,/LFAA_AGENT_SANDBOX/u);assert.equal(readFileSync(writePath,'utf8'),'node-sandbox-write');
        const readonlyTask=createAiHostTask({nodeId:node.id,createdBy:user.id,appId:'workspace',shell:'powershell',workingDirectory:workspaceRoot,workspaceRoot,sandboxMode:'read-only',command:"$ErrorActionPreference='Stop'; try { Set-Content -LiteralPath '"+quotedWritePath+"' -Value 'must-not-write'; exit 0 } catch { exit 19 }",timeoutSeconds:20});
          const readonlyFinal=await until(async()=>{const value=await readTask(readonlyTask.id);lastTaskState=value;return value?.status==='succeeded'||value?.status==='failed'?value:null;});assert.equal(readonlyFinal.status,'failed');assert.notEqual(readonlyFinal.result.exitCode,0);assert.equal(readonlyFinal.result.sandbox.mode,'read-only');assert.equal(readonlyFinal.result.sandbox.enforcement,'full');assert.equal(readonlyFinal.result.sandbox.hostVerified,true);assert.equal(readFileSync(writePath,'utf8'),'node-sandbox-write');
        const sandboxCancel=createAiHostTask({nodeId:node.id,createdBy:user.id,appId:'workspace',shell:'powershell',workingDirectory:workspaceRoot,workspaceRoot,sandboxMode:'workspace-write',command:"Write-Output 'sandbox-running'; Start-Sleep -Seconds 30",timeoutSeconds:60});
          await until(async()=>{lastTaskState=await readTask(sandboxCancel.id);return lastTaskState?.result?.stdout.includes('sandbox-running')});
        assert.equal((await fetch(base+'/ai/host-tasks/'+sandboxCancel.id+'/cancel',{method:'POST',headers})).status,202);
        const sandboxCancelled=await until(async()=>{const value=await readTask(sandboxCancel.id);lastTaskState=value;return value?.status==='failed'?value:null;},160);assert.equal(sandboxCancelled.result.cancelled,true);assert.equal(sandboxCancelled.result.sandbox.mode,'workspace-write');assert.equal(sandboxCancelled.result.sandbox.hostVerified,true);assert.doesNotMatch(sandboxCancelled.result.stderr,/LFAA_AGENT_SANDBOX/u);
        assert.equal(existsSync(join(workspaceRoot,'.lfaa-tmp')),false,'受限运行不得在项目树创建用户临时目录');
      } finally {
        if(daemon&&daemon.exitCode===null&&daemon.signalCode===null){daemon.send({type:'lfaa-shutdown'});const timer=setTimeout(()=>daemon.kill(),10000);try{assert.equal(await daemonExit,0,logs);}finally{clearTimeout(timer);}}
        await context.fiber.dispose();
      }
      process.stdout.write('真实节点控制回归通过');
    `], { cwd: cli, env: { ...process.env, ...profileDirectories, NODE_ENV: "test", LFAA_HOME: home, LFAA_DATA_DIR: data, SERVER_HOST: "127.0.0.1", LFAA_HARNESS_HOME: "", JWT_SECRET: "", LOG_LEVEL: "error" }, encoding: "utf8", windowsHide: true, stdio: "pipe", timeout: 60000 });
    assert.match(output, /真实节点控制回归通过/u);
  } finally { assert.equal(dirname(resolve(data)), parent); assert.equal(dirname(resolve(home)), parent); rmSync(data, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); }
});
