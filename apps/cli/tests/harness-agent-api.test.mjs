/**
 * 功能：回归完整 Harness 装配与任务 API。
 * 作用：隔离启动真实 Web Profile，经首次账户初始化和 Cookie 鉴权验证设置、断线运行和会话恢复；测试账户不进入产品数据。
 * 关联文件：boot/app-boot、bundle/base、api/session-controller、host/webserver。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("完整 Web Profile 经真实认证提交、断线和读取后台任务", () => {
  const parent = resolve(tmpdir()), data = mkdtempSync(join(parent, "lfaa-harness-api-"));
  try {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';import {createServer} from 'node:http';import {once} from 'node:events';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {join} from 'node:path';
      const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');process.env.SERVER_PORT=String(reservation.address().port);await new Promise(resolve=>reservation.close(resolve));
      const base='http://127.0.0.1:'+process.env.SERVER_PORT+'/api';
      const {boot}=await import('lfaa-app-boot/src/index.js');const context=await boot(['--profile','web']);
      try {
        assert.ok(context.get('lfaaAgentLoop'));assert.ok(context.get('lfaaSessions'));assert.ok(context.get('lfaaTools'));
        assert.equal((await fetch(base+'/ai/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appId:'workspace',sessionId:null,content:'test'})})).status,401);
        const setup=await fetch(base+'/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'fixture-admin',password:'Fixture-test-password-93!'})});assert.equal(setup.status,201);
        const cookie=setup.headers.get('set-cookie').split(';')[0];const {user}=await setup.json();const headers={'Content-Type':'application/json',Cookie:cookie};
        const registered=await fetch(base+'/daemon-nodes/credentials',{method:'POST',headers,body:JSON.stringify({displayName:'隔离远程节点',controlPlaneUrl:'https://fixture.example'})});assert.equal(registered.status,201);const registeredNode=await registered.json();assert.ok(registeredNode.nodeId);assert.equal(registeredNode.token,undefined);assert.equal(registeredNode.tokenHash,undefined);
        const exportFile=join(process.env.LFAA_DATA_DIR,'fixture-cli-connection.json');const exportOutput=execFileSync(process.execPath,['bin/lfaa.mjs','daemon','export','--node',registeredNode.nodeId,'--output-file',exportFile],{encoding:'utf8',windowsHide:true,timeout:10000});const exported=JSON.parse(readFileSync(exportFile,'utf8'));assert.equal(exported.nodeId,registeredNode.nodeId);assert.ok(exported.token);assert.ok(!exportOutput.includes(exported.token));
        assert.deepEqual((await(await fetch(base+'/ai/host-tasks',{headers})).json()).tasks,[]);
        const {database}=await import('lfaa-storage-sqlite/src/database.js');
        database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES('other-fixture',2,'other-fixture','test','test','member')").run();
        const conversationMemory=await import('lfaa-conversation-memory/src/index.js');
        assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version),47);
        assert.deepEqual(conversationMemory.getConversationMemorySnapshot(user.id),{memories:[],revision:0});
        assert.equal(conversationMemory.replaceConversationMemories('other-fixture',['另一账户的偏好'],0),true);
        database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES('fixture-node','测试节点','win32','x64','test','offline','2026-09-30T00:00:00Z')").run();
        database.prepare("INSERT INTO ai_host_tasks(id,node_id,created_by,app_id,shell,working_directory,command,status,message) VALUES('foreign-task','fixture-node','other-fixture','workspace','project-files','','test','queued','测试夹具')").run();
        assert.equal((await fetch(base+'/ai/host-tasks/foreign-task',{headers})).status,404);
        assert.deepEqual((await(await fetch(base+'/ai/host-tasks',{headers})).json()).tasks,[]);
        const settingsResponse=await fetch(base+'/settings',{headers});assert.equal(settingsResponse.status,200);const initial=(await settingsResponse.json()).settings;
        assert.deepEqual(initial.personalization,{memoryEnabled:false,memoryFromToolChats:false});
        const personalization=await fetch(base+'/settings/personalization',{method:'PUT',headers,body:JSON.stringify({memoryEnabled:true,memoryFromToolChats:false})});assert.equal(personalization.status,200);assert.equal((await personalization.json()).settings.personalization.memoryEnabled,true);
        const updated={...initial.aiRuntime,maxModelRequests:7,maxToolCalls:9,voiceInputEnabled:true};
        const saved=await fetch(base+'/settings/ai-runtime',{method:'PUT',headers,body:JSON.stringify(updated)});assert.equal(saved.status,200);assert.equal((await saved.json()).settings.aiRuntime.voiceInputEnabled,true);
        const invalid=await fetch(base+'/settings/plugins',{method:'PUT',headers,body:JSON.stringify({enabled:true,mcpServers:[{id:'bad',name:'bad',enabled:true,url:'http://user:secret@localhost/mcp'}]})});assert.equal(invalid.status,400);
        const nativeFetch=globalThis.fetch;
        const providerRequests=[];
        globalThis.fetch=async(url,options)=>{
          if(!String(url).startsWith('https://api.openai.com/'))return nativeFetch(url,options);
          if(String(url).endsWith('/models'))return Response.json({data:[{id:'fixture-model'}]});
          const requestBody=JSON.parse(options.body);providerRequests.push(requestBody);
          await new Promise(resolve=>setTimeout(resolve,100));
          const isMemoryRequest=requestBody.messages.some(message=>message.role==='system'&&message.content.includes('你只负责整理账户的长期个性化记忆'));
          const content=isMemoryRequest?JSON.stringify({memories:['用户偏好用简体中文交流']}):'测试隔离回复';
          return new Response('data: '+JSON.stringify({choices:[{delta:{content}}],usage:{prompt_tokens:11,completion_tokens:5}})+'\\n\\ndata: [DONE]\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
        };
        const settings=await import('lfaa-settings/src/service.js');const account=await settings.saveAiAccount(user.id,{providerId:'openai',secret:'fixture-only-key',options:{},displayName:'fixture',modelId:'fixture-model',reasoningMode:'default'});settings.activateAiAccount(user.id,account.id);
        const submitted=await fetch(base+'/ai/runs',{method:'POST',headers,body:JSON.stringify({appId:'workspace',sessionId:null,content:'测试任务'})});assert.equal(submitted.status,202);const {run}=await submitted.json();
        const events=await fetch(base+'/ai/runs/'+run.id+'/events',{headers});assert.equal(events.status,200);await events.body.cancel();
        let result;for(let attempt=0;attempt<200;attempt++){result=(await(await fetch(base+'/ai/runs/'+run.id,{headers})).json()).run;if(result.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,10));}
        assert.equal(result.status,'complete');assert.equal(result.message.content,'测试隔离回复');
        assert.equal(providerRequests.length,2);
        const memoryRequest=providerRequests.at(-1);assert.equal(memoryRequest.tools,undefined);assert.equal(memoryRequest.messages.length,2);
        assert.match(memoryRequest.messages[1].content,/\"userMessage\":\"测试任务\"/u);assert.match(memoryRequest.messages[1].content,/\"assistantFinalReply\":\"测试隔离回复\"/u);
        assert.deepEqual(conversationMemory.getConversationMemorySnapshot(user.id).memories,['用户偏好用简体中文交流']);
        assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM ai_usage WHERE user_id = ?').get(user.id).count),1);
        assert.deepEqual(database.prepare('SELECT prompt_tokens,completion_tokens FROM ai_usage WHERE user_id = ?').get(user.id),{prompt_tokens:22,completion_tokens:10});
        assert.equal((await fetch(base+'/settings/memories',{method:'DELETE'})).status,401);
        assert.equal((await fetch(base+'/settings/memories',{method:'DELETE',headers})).status,204);
        assert.deepEqual(conversationMemory.getConversationMemorySnapshot(user.id).memories,[]);
        assert.deepEqual(conversationMemory.getConversationMemorySnapshot('other-fixture').memories,['另一账户的偏好']);
        const messages=await fetch(base+'/ai/sessions/'+run.sessionId+'/messages',{headers});assert.equal((await messages.json()).messages.at(-1).status,'complete');
        assert.equal((await fetch(base+'/ai/runs/'+run.id)).status,401);
      }finally{await context.fiber.dispose();}
      process.stdout.write('完整装配回归通过');
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, SERVER_HOST: "127.0.0.1", JWT_SECRET: "", LOG_LEVEL: "error" }, encoding: "utf8", windowsHide: true, stdio: "pipe", timeout: 25000 });
    assert.match(output, /完整装配回归通过/u);
  } finally { assert.equal(dirname(resolve(data)), parent); rmSync(data, { recursive: true, force: true }); }
});
