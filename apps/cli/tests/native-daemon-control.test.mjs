/**
 * 功能：在隔离环境验证真实 Windows Daemon 的控制端任务链。
 * 作用：首次账户认证后启动源码节点，实际执行 PowerShell、读取运行中输出并请求取消；不触碰用户数据或真实游戏。
 * 关联文件：boot/app-boot、api/job-controller、api/session-controller、host/daemon/daemon.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("真实节点执行、认证读取增量输出和取消确认", { skip: process.platform !== "win32" || process.arch !== "x64", timeout: 65000 }, () => {
  const parent = resolve(tmpdir()), data = mkdtempSync(join(parent, "lfaa-native-control-"));
  try {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict'; import {createServer} from 'node:http'; import {once} from 'node:events'; import {spawn} from 'node:child_process';
      const reservation=createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening'); process.env.SERVER_PORT=String(reservation.address().port); await new Promise(resolve=>reservation.close(resolve));
      const base='http://127.0.0.1:'+process.env.SERVER_PORT+'/api'; const {boot}=await import('lfaa-app-boot/src/index.js'); const context=await boot(['web']);
      let daemon; let daemonExit; let logs='';
      const until=async action=>{for(let i=0;i<400;i++){const result=await action();if(result)return result;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('真实节点等待超时：'+logs.slice(-1200));};
      try {
        assert.equal((await fetch(base+'/daemon-nodes/credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:'测试节点'})})).status,401);
        const setup=await fetch(base+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'fixture-native-admin',password:'Fixture-Native-Password-93!'})});assert.equal(setup.status,201);
        const headers={'Content-Type':'application/json',Cookie:setup.headers.get('set-cookie').split(';')[0]}; const {user}=await setup.json();
        daemon=spawn(process.execPath,['--import','tsx','--import','./register-package-loader.mjs','src/index.ts','daemon'],{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
        daemonExit=new Promise((resolveExit,rejectExit)=>{daemon.once('error',rejectExit);daemon.once('exit',code=>resolveExit(code));});daemon.stdout.on('data',data=>{logs+=data;});daemon.stderr.on('data',data=>{logs+=data;});
        const {listAiHostNodes,createAiHostTask,getAiHostTask}=await import('lfaa-jobs/src/ai-host-tasks.js');
        const node=await until(()=>listAiHostNodes().find(item=>item.status==='online'&&item.shellSupported));
        const task=createAiHostTask({nodeId:node.id,createdBy:user.id,appId:'workspace',shell:'powershell',workingDirectory:'',command:"Write-Output 'lfaa-live-output 中文日志'; Start-Sleep -Seconds 30",timeoutSeconds:60});
        await until(()=>getAiHostTask(task.id)?.result?.stdout.includes('lfaa-live-output'));
        const snapshot=await fetch(base+'/ai/host-tasks/'+task.id,{headers});assert.equal(snapshot.status,200);const observed=(await snapshot.json()).task;assert.equal(observed.status,'running');assert.equal(observed.result.exitCode,null);
        assert.match(observed.result.stdout,/中文日志/);
        assert.equal((await fetch(base+'/ai/host-tasks/'+task.id+'/cancel',{method:'POST',headers})).status,202);
        const final=await until(()=>{const value=getAiHostTask(task.id);return value?.status==='failed'?value:null;});assert.equal(final.result.cancelled,true);assert.match(final.result.stdout,/lfaa-live-output/);assert.notEqual(final.result.exitCode,0);
      } finally {
        if(daemon&&daemon.exitCode===null&&daemon.signalCode===null){daemon.send({type:'lfaa-shutdown'});const timer=setTimeout(()=>daemon.kill(),10000);try{assert.equal(await daemonExit,0,logs);}finally{clearTimeout(timer);}}
        await context.fiber.dispose();
      }
      process.stdout.write('真实节点控制回归通过');
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, SERVER_HOST: "127.0.0.1", LFAA_HARNESS_HOME: "", JWT_SECRET: "", LOG_LEVEL: "error" }, encoding: "utf8", windowsHide: true, stdio: "pipe", timeout: 60000 });
    assert.match(output, /真实节点控制回归通过/u);
  } finally { assert.equal(dirname(resolve(data)), parent); rmSync(data, { recursive: true, force: true }); }
});
