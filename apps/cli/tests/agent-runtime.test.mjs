/**
 * 功能：回归后台 Agent、工具协议、执行预算和权限提示。
 * 作用：仅在隔离测试数据与合成 Provider 流中验证断线、重连、取消、账户隔离和历史恢复。
 * 关联文件：core/agent-loop、core/session、preset/agent-preset；合成模型与账户不进入产品。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("后台任务断线继续、账户隔离、协议恢复和取消", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-agent-runtime-"));
  try {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('fixture-owner',1,'fixture-owner','test-salt','test-hash','admin',1)").run();
      const settings=await import('lfaa-settings/src/service.js');
      const sessions=await import('lfaa-session/src/sessions.js');
      const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
      const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
      const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      assert.equal(database.prepare('PRAGMA user_version').get().user_version,32);
      const {aiRuntimeSettingsSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
      assert.ok(aiRuntimeSettingsSchema.validate({...settings.defaultSettings.aiRuntime,maxModelRequests:0}).error);
      let bodies=[]; let block=false; let release; let scenario='basic'; let holdChild=false; let executions=0;
      globalThis.fetch=async (url,options={})=>{
        if(String(url).endsWith('/models'))return Response.json({data:[{id:'fixture-model'},{id:'fixture-child'}]});
        assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
        const body=JSON.parse(options.body);bodies.push(body);
        const isChild=body.messages.some(message=>message.role==='user'&&message.content==='child-target');
        if(block||(holdChild&&isChild))await new Promise((resolve,reject)=>{release=resolve;options.signal.addEventListener('abort',()=>reject(new DOMException('已取消','AbortError')),{once:true});});
        const hasResult=body.messages.some(message=>message.role==='tool');
        if(isChild){assert.equal(body.model,'fixture-child');assert.deepEqual(body.tools.map(tool=>tool.function.name),['fixture_read_probe']);}
        const name=scenario==='children' ? isChild ? 'fixture_read_probe' : 'delegate_domain_expert' : 'host_list_nodes';
        const argumentsText=name==='delegate_domain_expert' ? JSON.stringify({task:'child-target',toolNames:['fixture_read_probe']}) : '{}';
        const delta=hasResult||!body.tools ? {content:'合成测试回答'} : {tool_calls:[{index:0,id:'fixture-call',type:'function',function:{name,arguments:argumentsText}}]};
        return new Response('data: '+JSON.stringify({choices:[{delta}]})+'\\n\\ndata: [DONE]\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
      };
      const account=await settings.saveAiAccount('fixture-owner',{providerId:'openai',secret:'fixture-test-key',options:{},displayName:'合成测试模型',modelId:'fixture-model',reasoningMode:'default'});
      settings.activateAiAccount('fixture-owner',account.id);
      const childAccount=await settings.saveAiAccount('fixture-owner',{providerId:'openai',secret:'fixture-child-test-key',options:{},displayName:'合成子模型',modelId:'fixture-child',reasoningMode:'default'});
      const host={listPlugins:()=>[],listExtensions:()=>[],listInstructionExtensions:()=>[],listHooks:()=>[],getSystemInstructions:()=>[],runBeforeInference:()=>({failedHookIds:[]}),runAfterInference:()=>({failedHookIds:[]})};
      const runs=await import('lfaa-agent-loop/src/runs.js');runs.initializeAiRuns();
      const until=async predicate=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('测试等待超时');};
      block=true;
      const run=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'合成测试目标'},host);
      let received=[];const unsubscribe=runs.subscribeAiRun('fixture-owner',run.id,(event,data)=>received.push({event,data}));
      await until(()=>!!release);unsubscribe();block=false;release();
      await until(()=>runs.getAiRun('fixture-owner',run.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',run.id).status,'complete');
      assert.equal(runs.getAiRun('another-owner',run.id),null);
      assert.equal(runs.cancelAiRun('another-owner',run.id),false);
      assert.equal(received.filter(item=>item.event==='done').length,0);
      assert.ok(bodies.at(-1).messages.some(item=>item.role==='tool'&&item.tool_call_id==='fixture-call'));
      let reconnected=[];runs.subscribeAiRun('fixture-owner',run.id,(event,data)=>reconnected.push({event,data}));
      assert.equal(reconnected[0].data.assistantMessage.content,'合成测试回答');
      assert.equal(reconnected.at(-1).data.status,'complete');
      const next=sessions.createAiTurn('fixture-owner','workspace',run.sessionId,'后续目标');
      assert.ok(next.history.some(item=>item.role==='tool'));
      assert.throws(()=>sessions.createAiTurn('fixture-owner','workspace',run.sessionId,'重复目标'),/活动任务/);
      sessions.finishAiAssistantMessage('fixture-owner',run.sessionId,next.assistantMessage.id,'','interrupted');
      block=true;release=undefined;bodies=[];
      const first=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'排队前任务'},host);
      await until(()=>!!release);
      const queuedCancellation=runs.appendAiRunInput('fixture-owner','admin',first.id,'应取消的排队目标',host);
      assert.equal(runs.cancelAiRun('fixture-owner',queuedCancellation.run.id),true);
      assert.equal(runs.getAiRun('fixture-owner',queuedCancellation.run.id).status,'interrupted');
      const queued=runs.appendAiRunInput('fixture-owner','admin',first.id,'排队跟进',host);
      assert.equal(queued.mode,'queue');assert.equal(queued.run.status,'queued');assert.equal(bodies.length,1);
      block=false;release();await until(()=>runs.getAiRun('fixture-owner',queued.run.id).status==='complete');
      assert.ok(bodies.at(-1).messages.some(item=>item.role==='tool'));
      assert.ok(bodies.at(-1).messages.some(item=>item.content?.includes('此排队任务已由用户取消')));
      settings.saveUserSettings('fixture-owner','general',{...settings.defaultSettings.general,followupBehavior:'steer'});
      block=true;release=undefined;bodies=[];
      const steered=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'运行中引导'},host);
      await until(()=>!!release);assert.equal(runs.appendAiRunInput('fixture-owner','admin',steered.id,'新增约束',host).mode,'steer');
      block=false;release();await until(()=>runs.getAiRun('fixture-owner',steered.id).status==='complete');
      assert.ok(bodies.at(-1).messages.some(item=>item.role==='user'&&item.content==='新增约束'));
      const afterSteer=sessions.createAiTurn('fixture-owner','workspace',steered.sessionId,'引导后的下一轮');
      assert.equal(afterSteer.history.filter(item=>item.content==='新增约束').length,1);
      sessions.finishAiAssistantMessage('fixture-owner',steered.sessionId,afterSteer.assistantMessage.id,'','interrupted');
      bodies=[];settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,maxModelRequests:1});
      const budget=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'预算目标'},host);
      await until(()=>runs.getAiRun('fixture-owner',budget.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',budget.id).status,'error');assert.equal(bodies.length,1);
      settings.saveUserSettings('fixture-owner','ai-runtime',settings.defaultSettings.aiRuntime);
      const registry=await import('lfaa-tools/src/registry.js');const disposers=[];
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.read-probe',name:'fixture_read_probe',description:'仅测试目录的隔离夹具',applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'read',approval:()=>({scopeKey:'test',scopeSummary:'test',summary:'test'}),execute:async(_,context)=>{assert.equal(context.userId,'fixture-owner');executions++;return {observed:'真实夹具执行计数',executions};}});
      settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[]});
      settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,subagentAccountId:childAccount.id});
      bodies=[];scenario='children';
      const parentRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host);
      await until(()=>runs.getAiRun('fixture-owner',parentRun.id).status==='complete');
      assert.equal(executions,1);assert.ok(bodies.some(body=>body.model==='fixture-child'));
      assert.ok(runs.getAiRun('fixture-owner',parentRun.id).message.activity.some(item=>item.title.startsWith('子 Agent · 调用工具')));
      const childResult=JSON.parse(bodies.at(-1).messages.find(item=>item.role==='tool').content);
      assert.equal(childResult.status,'complete');assert.equal(runs.getAiRun('fixture-owner',childResult.childRunId).status,'complete');
      settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,subagentAccountId:'missing-account'});
      bodies=[];const missing=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host);
      await until(()=>runs.getAiRun('fixture-owner',missing.id).status==='complete');assert.equal(executions,1);assert.ok(!bodies.some(body=>body.model==='fixture-child'));assert.ok(JSON.parse(bodies.at(-1).messages.find(item=>item.role==='tool').content).error);
      settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,subagentAccountId:childAccount.id,maxDelegationDepth:0});
      const limited=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host);
      await until(()=>runs.getAiRun('fixture-owner',limited.id).status==='complete');assert.equal(executions,1);
      settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,subagentAccountId:childAccount.id,maxSubagents:0});
      const noChildren=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host);
      await until(()=>runs.getAiRun('fixture-owner',noChildren.id).status==='complete');assert.equal(executions,1);
      settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,subagentAccountId:childAccount.id});
      const scoped=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host,{allowedToolNames:['delegate_domain_expert']});
      await until(()=>runs.getAiRun('fixture-owner',scoped.id).status==='complete');assert.equal(executions,1);assert.ok(runs.getAiRun('fixture-owner',scoped.id).message.activity.some(item=>item.status==='error'&&item.detail.includes('范围外')));
      holdChild=true;release=undefined;
      const parentCancelled=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host);
      await until(()=>!!release);runs.cancelAiRun('fixture-owner',parentCancelled.id);
      await until(()=>runs.getAiRun('fixture-owner',parentCancelled.id).status==='interrupted');holdChild=false;scenario='basic';
      assert.equal(executions,1);for(const dispose of disposers)dispose();assert.equal(registry.listRegisteredAiTools().length,0);
      settings.saveUserSettings('fixture-owner','plugins',settings.defaultSettings.plugins);
      settings.saveUserSettings('fixture-owner','ai-runtime',settings.defaultSettings.aiRuntime);
      block=true;release=undefined;
      const cancelled=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'取消目标'},host);
      await until(()=>!!release);assert.equal(runs.cancelAiRun('another-owner',cancelled.id),false);assert.equal(runs.cancelAiRun('fixture-owner',cancelled.id),true);
      await until(()=>runs.getAiRun('fixture-owner',cancelled.id).status!=='streaming');assert.equal(runs.getAiRun('fixture-owner',cancelled.id).status,'interrupted');
      await runs.closeAiRuns();configuration.close();sessionRecords.close();closeDatabase();
      process.stdout.write('后台执行回归通过');
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe", timeout: 20000 });
    assert.match(output, /后台执行回归通过/);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    rmSync(data, { recursive: true, force: true });
  }
});
