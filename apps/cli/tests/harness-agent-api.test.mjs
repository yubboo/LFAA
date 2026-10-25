/**
 * 功能：回归完整 Harness 装配与任务 API。
 * 作用：隔离启动真实 Web Profile，经默认账户登录和 Cookie 鉴权验证设置、断线运行和会话恢复；测试账户不进入产品数据。
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
        process.env.LFAA_LOCAL_MODE='true';
        const {boot}=await import('lfaa-app-boot/src/index.js');const context=await boot(['--profile','web']);
      try {
        assert.ok(context.get('lfaaAgentLoop'));assert.ok(context.get('lfaaSessions'));assert.ok(context.get('lfaaTools'));
        const minecraftSkill=await context.get('skills').get('minecraft-server-setup');
        assert.equal(minecraftSkill.provider,'lfaa-minecraft');assert.ok(minecraftSkill.content.includes('minecraft_provision_server'));
        const {listRegisteredAiTools}=await import('lfaa-tools/src/registry.js');
        const computerTools=listRegisteredAiTools().filter(tool=>tool.id.startsWith('computer-use.'));
        assert.equal(computerTools.length,process.platform==='win32'?9:0,'only a local Windows loopback Web Profile registers computer-control tools');
        assert.equal((await fetch(base+'/ai/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appId:'workspace',sessionId:null,content:'test'})})).status,401);
        const setup=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'123456'})});assert.equal(setup.status,200);
        const cookie=setup.headers.get('set-cookie').split(';')[0];const {user}=await setup.json();const headers={'Content-Type':'application/json',Cookie:cookie};
        const {LfaaClient,LfaaApiError}=await import('lfaa-sdk-client');
        const sdk=new LfaaClient({apiUrl:base,authenticationHeaders:()=>({Cookie:cookie})});
        const anonymousSdk=new LfaaClient({apiUrl:base});
        await assert.rejects(anonymousSdk.listSessions('workspace'),error=>error instanceof LfaaApiError&&error.status===401);
        const registered=await fetch(base+'/daemon-nodes/credentials',{method:'POST',headers,body:JSON.stringify({displayName:'隔离远程节点',controlPlaneUrl:'https://fixture.example'})});assert.equal(registered.status,201);const registeredNode=await registered.json();assert.ok(registeredNode.nodeId);assert.equal(registeredNode.token,undefined);assert.equal(registeredNode.tokenHash,undefined);
        const exportFile=join(process.env.LFAA_DATA_DIR,'fixture-cli-connection.json');const exportOutput=execFileSync(process.execPath,['bin/lfaa.mjs','daemon','export','--node',registeredNode.nodeId,'--output-file',exportFile],{encoding:'utf8',windowsHide:true,timeout:10000});const exported=JSON.parse(readFileSync(exportFile,'utf8'));assert.equal(exported.nodeId,registeredNode.nodeId);assert.ok(exported.token);assert.ok(!exportOutput.includes(exported.token));
        assert.deepEqual((await(await fetch(base+'/ai/host-tasks',{headers})).json()).tasks,[]);
        const {database}=await import('lfaa-storage-sqlite/src/database.js');
        database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES('other-fixture',2,'other-fixture','test','test','member')").run();
        const conversationMemory=await import('lfaa-conversation-memory/src/index.js');
        assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version),69);
        assert.deepEqual(conversationMemory.getConversationMemorySnapshot(user.id),{memories:[],revision:0});
        assert.equal(conversationMemory.replaceConversationMemories('other-fixture',['另一账户的偏好'],0),true);
        database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES('fixture-node','测试节点','win32','x64','test','offline','2026-09-30T00:00:00Z')").run();
        database.prepare("INSERT INTO ai_host_tasks(id,node_id,created_by,app_id,shell,working_directory,command,status,message) VALUES('foreign-task','fixture-node','other-fixture','workspace','project-files','','test','queued','测试夹具')").run();
        assert.equal((await fetch(base+'/ai/host-tasks/foreign-task',{headers})).status,404);
        assert.deepEqual((await(await fetch(base+'/ai/host-tasks',{headers})).json()).tasks,[]);
        const settingsResponse=await fetch(base+'/settings',{headers});assert.equal(settingsResponse.status,200);const initial=(await settingsResponse.json()).settings;
        assert.equal((await fetch(base+'/settings/sync/status')).status,401,'自托管同步状态必须要求账户认证');
        const syncStatusResponse=await fetch(base+'/settings/sync/status',{headers});assert.equal(syncStatusResponse.status,200);
        const syncStatus=(await syncStatusResponse.json()).status;assert.equal(syncStatus.service,'lfaa-self-hosted');assert.equal(syncStatus.scope,'same-control-plane');assert.ok(Array.isArray(syncStatus.categories));assert.equal(syncStatusResponse.headers.get('cache-control'),'private, no-store');
        const miniResponse=await fetch(base+'/settings/mini',{method:'PUT',headers,body:JSON.stringify({...initial.mini,showCompanion:!initial.mini.showCompanion})});assert.equal(miniResponse.status,200,await miniResponse.clone().text());
        assert.equal((await miniResponse.json()).settings.mini.showCompanion,!initial.mini.showCompanion,'Mini 偏好通过认证 Settings Owner 持久化');
        const dataDirectoryResponse=await fetch(base+'/data-directory',{headers});assert.equal(dataDirectoryResponse.status,200);
        const dataDirectory=(await dataDirectoryResponse.json()).settings;assert.equal(dataDirectory.currentDirectory,process.env.LFAA_DATA_DIR);
        const confirmedDirectory=await fetch(base+'/data-directory',{method:'PUT',headers,body:JSON.stringify({directory:dataDirectory.currentDirectory,mode:'copy',archivePath:''})});assert.equal(confirmedDirectory.status,409);
        assert.equal((await confirmedDirectory.json()).error,'data_directory_change_unavailable','测试明确设置的 LFAA_DATA_DIR 应保持只读');
        const storageResponse=await fetch(base+'/project-storage-locations',{headers});assert.equal(storageResponse.status,200);
        const storageLocations=(await storageResponse.json()).settings;assert.equal(storageLocations.writingDirectory,join(process.env.LFAA_HOME,'data'));
        assert.equal(storageLocations.dramaDirectory,join(process.env.LFAA_HOME,'data'));
        assert.deepEqual(initial.personalization,{memoryEnabled:false,memoryFromToolChats:false});
        const personalization=await fetch(base+'/settings/personalization',{method:'PUT',headers,body:JSON.stringify({memoryEnabled:true,memoryFromToolChats:false})});assert.equal(personalization.status,200);assert.equal((await personalization.json()).settings.personalization.memoryEnabled,true);
        const updated={...initial.aiRuntime,maxModelRequests:7,maxToolCalls:9,voiceInputEnabled:true};
        const saved=await fetch(base+'/settings/ai-runtime',{method:'PUT',headers,body:JSON.stringify(updated)});assert.equal(saved.status,200);assert.equal((await saved.json()).settings.aiRuntime.voiceInputEnabled,true);
        const invalid=await fetch(base+'/settings/plugins',{method:'PUT',headers,body:JSON.stringify({enabled:true,mcpServers:[{id:'bad',name:'bad',enabled:true,url:'http://user:secret@localhost/mcp'}]})});assert.equal(invalid.status,400);
        const nativeFetch=globalThis.fetch;
        const providerRequests=[];
        let pauseHold=false,releasePauseFetch,pauseProviderSignal;
        globalThis.fetch=async(url,options)=>{
          if(!String(url).startsWith('https://api.openai.com/'))return nativeFetch(url,options);
          if(String(url).endsWith('/models'))return Response.json({data:[{id:'fixture-model'}]});
          const requestBody=JSON.parse(options.body);providerRequests.push(requestBody);
          if(pauseHold&&requestBody.messages.some(message=>message.role==='user'&&message.content==='暂停后继续同一 Run')){pauseProviderSignal=options.signal;await new Promise(resolve=>{releasePauseFetch=resolve;});}
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
        const messages=await fetch(base+'/ai/sessions/'+run.sessionId+'/messages?limit=50',{headers});assert.equal(messages.status,200);const page=await messages.json();assert.equal(page.messages.at(-1).status,'complete');assert.equal(page.nextCursor,null);
        assert.equal(providerRequests.length,2);
        const memoryRequest=providerRequests.at(-1);assert.equal(memoryRequest.tools,undefined);assert.equal(memoryRequest.messages.length,2);
        assert.match(memoryRequest.messages[1].content,/\"userMessage\":\"测试任务\"/u);assert.match(memoryRequest.messages[1].content,/\"assistantFinalReply\":\"测试隔离回复\"/u);
        assert.equal((await fetch(base+'/ai/runs/unknown/pause',{method:'POST'})).status,401,'暂停接口必须要求账户认证');
        pauseHold=true;
        const pauseSubmission=await fetch(base+'/ai/runs',{method:'POST',headers,body:JSON.stringify({appId:'workspace',sessionId:null,content:'暂停后继续同一 Run'})});assert.equal(pauseSubmission.status,202);const {run:pauseRun}=await pauseSubmission.json();
        for(let attempt=0;attempt<200&&!releasePauseFetch;attempt++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(typeof releasePauseFetch,'function','合成 Provider 请求必须已到达暂停点');
        const pauseRequested=await fetch(base+'/ai/runs/'+pauseRun.id+'/pause',{method:'POST',headers});assert.equal(pauseRequested.status,202);assert.equal((await pauseRequested.json()).pauseState,'pausing');assert.equal(pauseProviderSignal.aborted,false,'暂停 API 不能中止 Provider 请求');
        const pauseEvents=await fetch(base+'/ai/runs/'+pauseRun.id+'/events',{headers});assert.equal(pauseEvents.status,200);const pauseReader=pauseEvents.body.getReader();const pauseDecoder=new TextDecoder();let pauseEventText='';
        const releasePausedProvider=releasePauseFetch;releasePauseFetch=undefined;pauseHold=false;releasePausedProvider();
        for(let attempt=0;attempt<100&&!pauseEventText.includes('"state":"paused"');attempt++){const chunk=await pauseReader.read();if(chunk.done)break;pauseEventText+=pauseDecoder.decode(chunk.value,{stream:true});}
        assert.match(pauseEventText,/"state":"paused"/u,'原 Run 的 SSE 必须确认已经暂停');await pauseReader.cancel();
        const pauseSnapshot=(await(await fetch(base+'/ai/runs/'+pauseRun.id,{headers})).json()).run;assert.equal(pauseSnapshot.status,'streaming');
        const resumed=await fetch(base+'/ai/runs/'+pauseRun.id+'/resume',{method:'POST',headers});assert.equal(resumed.status,202);assert.equal((await resumed.json()).pauseState,'running');
        let pauseResult;for(let attempt=0;attempt<200;attempt++){pauseResult=(await(await fetch(base+'/ai/runs/'+pauseRun.id,{headers})).json()).run;if(pauseResult.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,10));}
        assert.equal(pauseResult.id,pauseRun.id);assert.equal(pauseResult.status,'complete');assert.equal(pauseResult.message.content,'测试隔离回复');
        let memories=[];for(let attempt=0;attempt<200;attempt++){memories=conversationMemory.getConversationMemorySnapshot(user.id).memories;if(memories.includes('用户偏好用简体中文交流'))break;await new Promise(resolve=>setTimeout(resolve,10));}
        assert.deepEqual(memories,['用户偏好用简体中文交流']);
        const usageResponse=await fetch(base+'/ai/usage',{headers});assert.equal(usageResponse.status,200);const usage=(await usageResponse.json()).usage;
        assert.equal(usage.requestCount,3);assert.equal(usage.promptTokens,33);assert.equal(usage.completionTokens,15);
        assert.equal((await fetch(base+'/settings/memories',{method:'DELETE'})).status,401);
        assert.equal((await fetch(base+'/settings/memories',{method:'DELETE',headers})).status,204);
        assert.deepEqual(conversationMemory.getConversationMemorySnapshot(user.id).memories,[]);
        assert.deepEqual(conversationMemory.getConversationMemorySnapshot('other-fixture').memories,['另一账户的偏好']);
        assert.equal((await fetch(base+'/ai/runs/'+run.id)).status,401);
        assert.equal((await sdk.run(run.id)).run.status,'complete');
        assert.ok((await sdk.messages(run.sessionId,{limit:1})).messages.length<=1);
        const sdkEvents=[];for await(const event of sdk.events(run.id))sdkEvents.push(event);
        assert.equal(sdkEvents.at(-1).event,'done');
        assert.equal((await sdk.listSessions('workspace')).sessions.some(item=>item.id===run.sessionId),true);
        assert.ok(context.get('lfaaLlm'));assert.ok(context.get('lfaaMcp'));
        const names=context.lfaaTools.listAiBusinessTools('workspace','admin').map(tool=>tool.name);
        for(const name of ['lfaa_capability_status','lfaa_set_capability_enabled','lfaa_skill_load','session_search'])assert.ok(names.includes(name),name);
        assert.equal(names.includes('host_execute_command'),true,'已登记的节点执行工具可供当前应用的模型按目标选择，并由同一权限 Owner 校验');
        assert.ok(context.lfaaTools.listAiBusinessTools('minecraft','admin').some(tool=>tool.name==='host_execute_command'),'游戏 Agent 可由模型选择目标节点 Shell');
      }finally{await context.fiber.dispose();}
      process.stdout.write('完整装配回归通过');
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, LFAA_HOME: `${data}-home`, LFAA_DATA_DIR_MANAGED_BY_LAUNCHER: "1", LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED: "1", SERVER_HOST: "127.0.0.1", JWT_SECRET: "", LOG_LEVEL: "error" }, encoding: "utf8", windowsHide: true, stdio: "pipe", timeout: 25000 });
    assert.match(output, /完整装配回归通过/u);
  } finally { assert.equal(dirname(resolve(data)), parent); rmSync(data, { recursive: true, force: true }); rmSync(`${data}-home`, { recursive: true, force: true }); }
});
