/**
 * 功能：回归后台 Agent、工具协议、执行预算和权限提示。
 * 作用：仅在隔离测试数据与合成 Provider 流中验证断线、重连、取消、账户隔离和历史恢复。
 * 关联文件：core/agent-loop、core/session、preset/agent-preset；合成模型与账户不进入产品。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("后台任务断线继续、账户隔离、协议恢复和取消", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-agent-runtime-"));
  const childScript = join(parent, `${basename(data)}.mjs`);
  try {
    const source = `
      import assert from 'node:assert/strict';
      const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('fixture-owner',1,'fixture-owner','test-salt','test-hash','admin',1)").run();
      const settings=await import('lfaa-settings/src/service.js');
      const tools=await import('lfaa-tools/src/business-tools.js');
      const {Context}=await import('@deepseek-ai/cordis');
      const pluginContext=new Context();
      const credentialsFiber=await pluginContext.plugin(await import('lfaa-credentials/src/index.js'));
      const approvalFiber=await pluginContext.plugin(await import('lfaa-user-approval/src/index.js'));
      const questionsFiber=await pluginContext.plugin(await import('lfaa-user-questions/src/index.js'));
      const settingsFiber=await pluginContext.plugin(await import('lfaa-settings/src/index.js'));
      const modelFiber=await pluginContext.plugin(await import('lfaa-agent-default-model/src/index.js'));
      const toolsFiber=await pluginContext.plugin(await import('lfaa-tools/src/index.js'));
      const askUserFiber=await pluginContext.plugin(await import('lfaa-tool-ask-user/src/index.js'));
      const sessions=await import('lfaa-session/src/sessions.js');
      const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
      const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
      const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');
      const {createServer}=await import('node:http');const {once}=await import('node:events');
      let mcpExecutions=0;
      const mcpServer=createServer(async(request,response)=>{
        if(request.method==='DELETE'){response.writeHead(204).end();return;}
        let text='';for await(const chunk of request)text+=chunk;const message=JSON.parse(text);
        const respond=(result,initialize=false)=>{response.writeHead(200,{'Content-Type':'application/json',...(initialize?{'MCP-Session-Id':'agent-loop-fixture'}:{})});response.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));};
        if(message.method==='initialize'){respond({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'agent-loop-fixture',version:'1'}},true);return;}
        if(message.method==='notifications/initialized'){response.writeHead(202).end();return;}
        if(message.method==='tools/list'){respond({tools:[{name:'read_status',description:'读取测试状态',inputSchema:{type:'object',properties:{},additionalProperties:false}}]});return;}
        if(message.method==='tools/call'){mcpExecutions++;respond({content:[{type:'text',text:'实际 MCP 工具结果'}]});return;}
        response.writeHead(404).end();
      });
      mcpServer.listen(0,'127.0.0.1');await once(mcpServer,'listening');const mcpUrl='http://127.0.0.1:'+mcpServer.address().port+'/mcp';
      retireLegacyFileTables();
      assert.equal(database.prepare('PRAGMA user_version').get().user_version,47);
      const {aiRuntimeSettingsSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
      assert.ok(aiRuntimeSettingsSchema.validate({...settings.defaultSettings.aiRuntime,maxModelRequests:0}).error);
      const {shortcutsSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
      assert.deepEqual(settings.defaultSettings.shortcuts.openSideChat,['Ctrl+Alt+S']);
      assert.equal(shortcutsSchema.validate(settings.defaultSettings.shortcuts).error,undefined);
      const legacyShortcuts={...settings.defaultSettings.shortcuts};delete legacyShortcuts.openSideChat;
      settings.saveUserSettings('fixture-owner','shortcuts',legacyShortcuts);
      assert.deepEqual(settings.getUserSettings('fixture-owner').shortcuts.openSideChat,['Ctrl+Alt+S'],'旧账户快捷键配置应继承新增功能的设置中心默认值');
      settings.saveUserSettings('fixture-owner','shortcuts',settings.defaultSettings.shortcuts);
      const {pluginsSettingsSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
      const legacyPlugins=pluginsSettingsSchema.validate({enabled:true,mcpServers:[{id:'legacy',name:'旧服务',url:'http://127.0.0.1:1234/mcp',enabled:true}]});
      assert.deepEqual(legacyPlugins.value.mcpServers[0].applicationIds,['workspace']);
      assert.ok(pluginsSettingsSchema.validate({enabled:true,mcpServers:[{id:'bad-scope',name:'范围错误',url:'http://127.0.0.1:1234/mcp',enabled:true,applicationIds:['unknown'] }]}).error);
       const {createHash}=await import('node:crypto');
       const promptContent='Owner 提示词设置回归内容';
       const promptEntry={id:'prompt-'+ 'a'.repeat(20),name:'Owner 回归提示词',description:'只测试设置 Owner',applicationId:'workspace',sourceRepository:'https://github.com/acme/prompts',sourcePath:'review.prompt.md',license:'MIT',commit:'b'.repeat(40),archiveSha256:'c'.repeat(64),contentSha256:createHash('sha256').update(promptContent).digest('hex'),content:promptContent,enabled:true,createdAt:new Date().toISOString()};
       settings.installUserCapabilityPrompt('fixture-owner',promptEntry);
       assert.equal(settings.getUserSettings('fixture-owner').plugins.prompts[0].content,promptContent);
       settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[]});
       assert.equal(settings.getUserSettings('fixture-owner').plugins.prompts.length,1,'旧客户端不提交 prompts 字段时不得清空已安装内容');
       assert.equal(settings.setUserCapabilityPromptEnabled('fixture-owner',promptEntry.id,'workspace',false).enabled,false);
       assert.equal(settings.removeUserCapabilityPrompt('fixture-owner',promptEntry.id,'workspace').id,promptEntry.id);
       assert.deepEqual(settings.getUserSettings('fixture-owner').plugins.prompts,[]);
      const shellTool=tools.listAiBusinessTools('workspace','admin').find(tool=>tool.id==='host.execute-command');assert.ok(shellTool);
      const projectNode='11111111-1111-4111-8111-111111111111';
      const projectCommand=shellTool.parse({command:'Get-Location'});
      const projectPrepared=shellTool.prepare(projectCommand,{userId:'fixture-owner',workspaceProject:{nodeId:projectNode,path:'/fixture/project',title:'fixture'}});
      assert.equal(projectPrepared.nodeId,projectNode);assert.equal(projectPrepared.workingDirectory,'/fixture/project');
      const explicitPrepared=shellTool.prepare(shellTool.parse({nodeId:'22222222-2222-4222-8222-222222222222',command:'Get-Location',workingDirectory:'/explicit/path'}),{userId:'fixture-owner',workspaceProject:{nodeId:projectNode,path:'/fixture/project',title:'fixture'}});
      assert.equal(explicitPrepared.nodeId,'22222222-2222-4222-8222-222222222222');assert.equal(explicitPrepared.workingDirectory,'/explicit/path');
      settings.saveUserSettings('fixture-owner','general',{...settings.defaultSettings.general,taskFolder:'/fixture/default'});
      const settingsPrepared=shellTool.prepare(shellTool.parse({nodeId:projectNode,command:'Get-Location'}),{userId:'fixture-owner',workspaceProject:null});
      assert.equal(settingsPrepared.workingDirectory,'/fixture/default');settings.saveUserSettings('fixture-owner','general',settings.defaultSettings.general);
      let bodies=[]; let block=false; let release; let scenario='basic'; let holdChild=false; let executions=0;
      const nativeFetch=globalThis.fetch;
      globalThis.fetch=async (url,options={})=>{
        if(String(url).startsWith(mcpUrl))return nativeFetch(url,options);
        if(String(url).endsWith('/models'))return Response.json({data:[{id:'fixture-model'},{id:'fixture-child'}]});
        assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
        const body=JSON.parse(options.body);bodies.push(body);
        const isChild=body.messages.some(message=>message.role==='user'&&message.content==='child-target');
        if(block||(holdChild&&isChild))await new Promise((resolve,reject)=>{release=resolve;options.signal.addEventListener('abort',()=>reject(new DOMException('已取消','AbortError')),{once:true});});
        const hasResult=body.messages.some(message=>message.role==='tool');
        if(isChild){assert.equal(body.model,'fixture-child');assert.deepEqual(body.tools.map(tool=>tool.function.name),['fixture_read_probe']);}
        let delta;
        if(scenario==='planSafety'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){assert.match(body.messages.find(message=>message.role==='system').content,/协作计划意图/u);assert.ok(body.tools.some(tool=>tool.function.name==='lfaa_enter_plan_mode'));delta={tool_calls:[{index:0,id:'fixture-plan-enter',type:'function',function:{name:'lfaa_enter_plan_mode',arguments:'{}'}},{index:1,id:'fixture-plan-parallel-write',type:'function',function:{name:'fixture_write_probe',arguments:'{}'}}]};}
          else if(toolResults.some(item=>item.tool_call_id==='fixture-plan-enter')&&!toolResults.some(item=>item.tool_call_id==='fixture-plan-read')){assert.equal(JSON.parse(toolResults.find(item=>item.tool_call_id==='fixture-plan-parallel-write').content).executionState,'not_started');assert.match(body.messages.find(message=>message.role==='system').content,/只可执行风险判定为 read 的只读工具/u);delta={tool_calls:[{index:0,id:'fixture-plan-read',type:'function',function:{name:'fixture_read_probe',arguments:'{}'}}]};}
          else if(toolResults.some(item=>item.tool_call_id==='fixture-plan-read')&&!toolResults.some(item=>item.tool_call_id==='fixture-plan-blocked-write')){delta={tool_calls:[{index:0,id:'fixture-plan-blocked-write',type:'function',function:{name:'fixture_write_probe',arguments:'{}'}}]};}
          else{assert.equal(JSON.parse(toolResults.find(item=>item.tool_call_id==='fixture-plan-blocked-write').content).executionState,'not_started');delta={content:'已完成计划讨论'};}
        }else if(scenario==='approvalLoop'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){assert.ok(body.tools.some(tool=>tool.function.name==='fixture_write_probe'));delta={tool_calls:[{index:0,id:'fixture-approval-call',type:'function',function:{name:'fixture_write_probe',arguments:'{}'}}]};}
          else{delta={content:'审批通过后已执行测试操作'};}
        }else if(scenario==='askUserLoop'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){assert.ok(body.tools.some(tool=>tool.function.name==='lfaa_ask_user'),'问题插件即使扩展开关关闭也应由 Core 保持可用');delta={tool_calls:[{index:0,id:'fixture-question-call',type:'function',function:{name:'lfaa_ask_user',arguments:JSON.stringify({question:'选择要启动的实例',options:['生存服','测试服']})}}]};}
            else{const answer=JSON.parse(toolResults.at(-1).content);assert.deepEqual(answer,{answer:'启动生存服',skipped:false});delta={content:'已按你的选择继续'};}
        }else if(scenario==='capabilityLoop'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){assert.ok(body.tools.some(tool=>tool.function.name==='capability_install'));assert.ok(!body.tools.some(tool=>tool.function.name.startsWith('mcp_loopmcp_')));delta={tool_calls:[{index:0,id:'fixture-install',type:'function',function:{name:'capability_install',arguments:JSON.stringify({kind:'mcp'})}}]};}
          else if(toolResults.length===1){const mcpTool=body.tools.find(tool=>tool.function.name.startsWith('mcp_loopmcp_'));assert.ok(mcpTool,'安装后的工具必须进入下一次 Provider 请求');delta={tool_calls:[{index:0,id:'fixture-mcp',type:'function',function:{name:mcpTool.function.name,arguments:'{}'}}]};}
          else{assert.ok(toolResults.some(item=>item.content.includes('实际 MCP 工具结果')));delta={content:'已安装并调用 MCP'};}
        }else if(scenario==='promptLoop'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){assert.ok(body.tools.some(tool=>tool.function.name==='capability_install'));assert.ok(!body.tools.some(tool=>tool.function.name==='capability_prompt_load'),'未安装提示词时不向模型暴露无用工具');delta={tool_calls:[{index:0,id:'fixture-prompt-install',type:'function',function:{name:'capability_install',arguments:JSON.stringify({kind:'prompt'})}}]};}
          else if(toolResults.length===1){const installed=JSON.parse(toolResults[0].content);const promptTool=body.tools.find(tool=>tool.function.name==='capability_prompt_load');assert.ok(promptTool);assert.ok(installed.promptId);delta={tool_calls:[{index:0,id:'fixture-prompt-load',type:'function',function:{name:promptTool.function.name,arguments:JSON.stringify({promptId:installed.promptId})}}]};}
          else{assert.ok(toolResults.some(item=>item.content.includes('第三方提示词真实正文')));delta={content:'提示词已安装并按需加载'};}
        }else{
          const name=scenario==='children' ? isChild ? 'fixture_read_probe' : 'delegate_domain_expert' : 'host_list_nodes';
          const argumentsText=name==='delegate_domain_expert' ? JSON.stringify({task:'child-target',toolNames:['fixture_read_probe']}) : '{}';
          delta=hasResult||!body.tools ? {content:'合成测试回答'} : {tool_calls:[{index:0,id:'fixture-call',type:'function',function:{name,arguments:argumentsText}}]};
        }
        return new Response('data: '+JSON.stringify({choices:[{delta}]})+'\\n\\ndata: [DONE]\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
      };
      const account=await settings.saveAiAccount('fixture-owner',{providerId:'openai',secret:'fixture-test-key',options:{},displayName:'合成测试模型',modelId:'fixture-model',reasoningMode:'default'});
      settings.activateAiAccount('fixture-owner',account.id);
      const childAccount=await settings.saveAiAccount('fixture-owner',{providerId:'openai',secret:'fixture-child-test-key',options:{},displayName:'合成子模型',modelId:'fixture-child',reasoningMode:'default'});
      const credentials=await import('lfaa-credentials/src/index.js');
      const accountReference=credentials.credentialReference('lfaa-settings',account.id);
      const resolvedModelCredential=pluginContext.lfaaAgentDefaultModel.resolve('fixture-owner');
      assert.equal(resolvedModelCredential.secret,'fixture-test-key');
      assert.equal(pluginContext.lfaaAgentDefaultModel.resolve('another-owner'),null);
      assert.equal(accountReference.providerId,'lfaa-settings');
      const host={listPlugins:()=>[],listExtensions:()=>[],listInstructionExtensions:()=>[],listHooks:()=>[],getSystemInstructions:()=>[],runBeforeInference:()=>({failedHookIds:[]}),runAfterInference:()=>({failedHookIds:[]})};
      const runs=await import('lfaa-agent-loop/src/runs.js');runs.initializeAiRuns(pluginContext.lfaaAgentDefaultModel,pluginContext.lfaaUserApproval,pluginContext.lfaaUserQuestions);
      const until=async predicate=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('测试等待超时');};
      block=true;
      const run=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'合成测试目标'},host);
      let received=[];const unsubscribe=runs.subscribeAiRun('fixture-owner',run.id,(event,data)=>received.push({event,data}));
      await until(()=>!!release);unsubscribe();block=false;release();
      await until(()=>runs.getAiRun('fixture-owner',run.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',run.id).status,'complete');
       const firstSystemPrompt=bodies[0].messages.find(item=>item.role==='system')?.content??'';
       assert.match(firstSystemPrompt,/最终回复默认使用用户的语言自然表达/u);
       assert.match(firstSystemPrompt,/内部字段名、布尔标记和状态枚举/u);
       assert.match(firstSystemPrompt,/用户明确要求查看代码、命令、日志、JSON/u);
      const activity=runs.getAiRun('fixture-owner',run.id).message.activity.find(item=>item.title==='调用主机工具');
      assert.ok(activity);assert.doesNotMatch(JSON.stringify(activity),/host_list_nodes|参数：|"result"/u);
      assert.equal(bodies[0].tool_choice,'auto');
      assert.equal(runs.getAiRun('another-owner',run.id),null);
      assert.equal(runs.cancelAiRun('another-owner',run.id),false);
      assert.equal(received.filter(item=>item.event==='done').length,0);
      assert.ok(bodies.at(-1).messages.some(item=>item.role==='tool'&&item.tool_call_id==='fixture-call'));
      let reconnected=[];runs.subscribeAiRun('fixture-owner',run.id,(event,data)=>reconnected.push({event,data}));
      assert.equal(reconnected[0].data.assistantMessage.content,'合成测试回答');
      assert.equal(reconnected.at(-1).data.status,'complete');
      const completedMessage=runs.getAiRun('fixture-owner',run.id).message;
      const rawHistory=[
        {role:'assistant',content:null,tool_calls:[{id:'fixture-old-call',type:'function',function:{name:'host_list_nodes',arguments:'{}'}}]},
        {role:'tool',tool_call_id:'fixture-old-call',content:'历史工具返回的节点快照'.repeat(12000)},
        {role:'assistant',content:null,tool_calls:[{id:'fixture-question',type:'function',function:{name:'lfaa_ask_user',arguments:JSON.stringify({question:'要启动哪个实例？',options:['生存服','测试服']})}}]},
        {role:'tool',tool_call_id:'fixture-question',content:JSON.stringify({answer:'启动生存服',skipped:false})},
        {role:'user',content:'历史轮内引导'},
        {role:'assistant',content:'合成测试回答'}
      ];
      sessions.saveAiModelHistory('fixture-owner',run.sessionId,completedMessage.id,rawHistory);
      const next=sessions.createAiTurn('fixture-owner','workspace',run.sessionId,'后续目标');
      assert.ok(next.history.some(item=>item.role==='user'&&item.content==='合成测试目标'));
      assert.ok(next.history.some(item=>item.role==='user'&&item.content==='历史轮内引导'));
      assert.ok(next.history.some(item=>item.role==='user'&&item.content.includes('要启动哪个实例？')&&item.content.includes('启动生存服')));
      assert.ok(next.history.some(item=>item.role==='assistant'&&item.content==='合成测试回答'));
      assert.ok(next.history.every(item=>item.role!=='tool'&&!item.tool_calls));
      assert.ok(JSON.stringify(next.history).length<JSON.stringify(rawHistory).length/10,'下一轮不重复发送大体积历史工具协议');
      const persistedHistory=sessionRecords.get('ai_messages',completedMessage.id).model_history;
      assert.ok(persistedHistory.some(item=>item.role==='tool'&&item.content===rawHistory[1].content),'原始工具结果仍留在持久化模型记录');
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
      settings.saveUserSettings('fixture-owner','general',{...settings.defaultSettings.general,followupBehavior:'queue'});
      const sideSession=sessions.forkAiSessionForSideChat('fixture-owner',steered.sessionId);
      assert.ok(sideSession);assert.equal(sessions.getAiSideChatParentSessionId('fixture-owner',sideSession.id),steered.sessionId);
      block=true;release=undefined;bodies=[];scenario='basic';
      const sideRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:sideSession.id,content:'解释一下当前聊天'},host,{allowedToolNames:['host_list_nodes'],canAskUser:true,memoryEligible:true,systemPrompt:'攻击者覆盖提示词'});
      await until(()=>!!release);
      const sideQueued=runs.appendAiRunInput('fixture-owner','admin',sideRun.id,'排队补问',host);
      assert.equal(sideQueued.mode,'queue');assert.equal(sideQueued.run.status,'queued');
      block=false;release();await until(()=>runs.getAiRun('fixture-owner',sideQueued.run.id).status==='complete');
      assert.equal(runs.getAiRun('fixture-owner',sideRun.id).status,'complete');
      assert.equal(bodies.length,2);assert.ok(bodies.every(body=>!body.tools),'普通侧聊与排队续问都不得暴露工具');
      assert.ok(bodies.every(body=>body.messages.find(item=>item.role==='system')?.content.includes('侧边解释助手')),'调用方不能覆盖侧聊系统提示词');
      settings.saveUserSettings('fixture-owner','general',settings.defaultSettings.general);
      bodies=[];settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,maxModelRequests:1});
      const budget=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'预算目标'},host);
      await until(()=>runs.getAiRun('fixture-owner',budget.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',budget.id).status,'error');assert.equal(bodies.length,1);
      settings.saveUserSettings('fixture-owner','ai-runtime',settings.defaultSettings.aiRuntime);
      const registry=await import('lfaa-tools/src/registry.js');const disposers=[];
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.read-probe',name:'fixture_read_probe',description:'仅测试目录的隔离夹具',applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'read',approval:()=>({scopeKey:'test',scopeSummary:'test',summary:'test'}),execute:async(_,context)=>{assert.equal(context.userId,'fixture-owner');executions++;return {observed:'真实夹具执行计数',executions};}});
      let writeExecutions=0;
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.write-probe',name:'fixture_write_probe',description:'仅测试目录的受审批写操作夹具',applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'write',approval:()=>({scopeKey:'fixture-write-target',scopeSummary:'隔离测试目标',summary:'验证一次性审批通知'}),execute:async(_,context)=>{assert.equal(context.userId,'fixture-owner');writeExecutions++;return {executed:true};}});
      settings.saveUserSettings('fixture-owner','permissions',{mode:'full_access'});
      bodies=[];scenario='planSafety';const planningRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'先做计划再实践，请先检查范围，等我确认后执行'},host);let planModeEvents=[];const unsubscribePlanMode=runs.subscribeAiRun('fixture-owner',planningRun.id,(event,data)=>{if(event==='plan-mode')planModeEvents.push(data);});
      await until(()=>runs.getAiRun('fixture-owner',planningRun.id).status==='complete');
      unsubscribePlanMode();assert.deepEqual(planModeEvents,[{sessionId:planningRun.sessionId,active:true}]);
      assert.equal(sessions.getAiSessionPlanMode('fixture-owner',planningRun.sessionId),true);
      assert.equal(writeExecutions,0,'完全权限也不能绕过计划讨论阶段的只读边界');
      assert.ok(bodies.length>=4);assert.ok(bodies.every(body=>body.tools.some(tool=>tool.function.name==='lfaa_approve_plan_and_execute')));
      const planToolCalls=sessionRecords.allForSession('session_events',planningRun.sessionId).filter(event=>event.type==='tool/call');
      assert.equal(planToolCalls.filter(event=>event.data.name==='fixture_write_probe'&&event.data.dispatched===false).length,2);
      assert.equal(executions,1,'计划期间保留只读查询');executions=0;
      const {discoverMcpTools}=await import('lfaa-tools/src/mcp-tools.js');
       registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'capabilities.install',name:'capability_install',description:'测试用能力安装 Owner',applicationIds:['workspace'],schema:{type:'object',properties:{kind:{type:'string'}},required:['kind'],additionalProperties:false},parse:value=>value,risk:()=> 'dangerous',approval:()=>({scopeKey:'fixture-capability-install',scopeSummary:'当前测试 App',summary:'安装测试能力'}),execute:async(parameters,context)=>{
         if(parameters.kind==='prompt'){
           const promptContent='第三方提示词真实正文';const promptId='prompt-'+ 'f'.repeat(20);
           const prompt={id:promptId,name:'测试提示词',description:'验证同轮调用',applicationId:context.applicationId,sourceRepository:'https://github.com/acme/prompts',sourcePath:'review.prompt.md',license:'MIT',commit:'b'.repeat(40),archiveSha256:'c'.repeat(64),contentSha256:createHash('sha256').update(promptContent).digest('hex'),content:promptContent,enabled:true,createdAt:new Date().toISOString()};
           settings.saveUserSettings(context.userId,'plugins',{enabled:true,mcpServers:[],prompts:[prompt]});
           return {outcome:'verified_ready',kind:'prompt',targetApplicationId:context.applicationId,promptId,verification:{status:'ready',verified:true,summary:'提示词已写入设置 Owner',details:{id:prompt.id,contentSha256:prompt.contentSha256,enabled:true}}};
         }
        const candidate={id:'loopmcp',name:'回环 MCP',url:mcpUrl,enabled:true,applicationIds:['workspace']};
        const checked=await discoverMcpTools([candidate],'workspace',context.signal,5);
        const state=checked.serverStates.find(item=>item.serverId===candidate.id);
        await checked.close();
        assert.equal(checked.errors.length,0);assert.equal(state.status,'ready');
        settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[{...candidate,manifestSha256:state.manifestSha256}]});
        return {outcome:'verified_ready',kind:'mcp',targetApplicationId:'workspace',verification:{status:'ready',verified:true,summary:'测试 MCP 已核验',details:{serverId:candidate.id,manifestSha256:state.manifestSha256}}};
      }});
      settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[{id:'legacy',name:'旧服务',url:'http://127.0.0.1:1234/mcp',enabled:true}]});
      assert.deepEqual(settings.getUserSettings('fixture-owner').plugins.mcpServers[0].applicationIds,['workspace']);
      settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[]});
      settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,subagentAccountId:childAccount.id});
      bodies=[];scenario='children';
      const parentRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host);
      await until(()=>runs.getAiRun('fixture-owner',parentRun.id).status==='complete');
      assert.equal(executions,1);assert.ok(bodies.some(body=>body.model==='fixture-child'));
      assert.ok(runs.getAiRun('fixture-owner',parentRun.id).message.activity.some(item=>item.kind==='tool'&&item.title.startsWith('子 Agent · ')));
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
      await until(()=>runs.getAiRun('fixture-owner',scoped.id).status==='complete');
      assert.equal(executions,1);
      const deniedToolResult=JSON.parse(bodies.at(-1).messages.find(item=>item.role==='tool').content);
      assert.match(deniedToolResult.error,/范围外/u);assert.equal(deniedToolResult.executed,null);assert.equal(deniedToolResult.executionState,'unconfirmed');
      holdChild=true;release=undefined;
      const parentCancelled=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'parent-target'},host);
      await until(()=>!!release);runs.cancelAiRun('fixture-owner',parentCancelled.id);
      await until(()=>runs.getAiRun('fixture-owner',parentCancelled.id).status==='interrupted');holdChild=false;
      settings.saveUserSettings('fixture-owner','permissions',{...settings.defaultSettings.permissions,mode:'ask'});
      bodies=[];scenario='approvalLoop';
      const approvalRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:planningRun.sessionId,content:'我批准刚才的计划，请按计划执行这项需要审批的测试写操作',planMode:false},host);
      await until(()=>runs.getAiRun('fixture-owner',approvalRun.id).message.activity.some(item=>item.status==='approval_required'));
      const permissionPresets=await import('lfaa-permission-presets/src/permissions.js');
      const pendingApproval=permissionPresets.listAiToolApprovals('fixture-owner','pending').find(item=>item.sessionId===approvalRun.sessionId);
      assert.ok(pendingApproval);assert.equal(writeExecutions,0);
      assert.equal(permissionPresets.decideAiToolApproval('fixture-owner',pendingApproval.id,'approved',false)?.status,'approved');
      pluginContext.lfaaUserApproval.notify('fixture-owner',pendingApproval.id);
      await until(()=>runs.getAiRun('fixture-owner',approvalRun.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',approvalRun.id).status,'complete');
      assert.equal(sessions.getAiSessionPlanMode('fixture-owner',planningRun.sessionId),false,'批准后退出计划状态，并继续使用原权限审批');
      assert.equal(writeExecutions,1);assert.match(runs.getAiRun('fixture-owner',approvalRun.id).message.content,/审批通过后已执行测试操作/u);
      settings.saveUserSettings('fixture-owner','permissions',{mode:'full_access'});settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[]});
      bodies=[];scenario='capabilityLoop';
      const capabilityRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'安装并调用这个 MCP'},host);
      await until(()=>runs.getAiRun('fixture-owner',capabilityRun.id).status==='complete');
      assert.equal(mcpExecutions,1);
      const installRequestIndex=bodies.findIndex(body=>body.tools?.some(tool=>tool.function.name==='capability_install'));
      assert.ok(installRequestIndex>=0);
      assert.ok(bodies[installRequestIndex+1].tools.some(tool=>tool.function.name.startsWith('mcp_loopmcp_')));
      const installedToolResult=JSON.parse(bodies[installRequestIndex+1].messages.find(message=>message.role==='tool'&&message.tool_call_id==='fixture-install').content);
      assert.equal(installedToolResult.runtimeActivation.status,'ready');
      assert.equal(installedToolResult.runtimeActivation.addedForNextRequest,true);
      assert.ok(bodies[installRequestIndex+2].messages.some(message=>message.role==='tool'&&message.content.includes('实际 MCP 工具结果')));
      assert.match(runs.getAiRun('fixture-owner',capabilityRun.id).message.content,/已安装并调用 MCP/u);
      assert.ok(runs.getAiRun('fixture-owner',capabilityRun.id).message.activity.some(item=>item.detail.includes('加入当前 Agent Run 的下一次模型请求')));
       settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[],prompts:[]});
       bodies=[];scenario='promptLoop';
       const promptRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'安装并使用这个提示词'},host);
       await until(()=>runs.getAiRun('fixture-owner',promptRun.id).status==='complete');
       const promptInstallIndex=bodies.findIndex(body=>body.tools?.some(tool=>tool.function.name==='capability_install'));
       assert.ok(promptInstallIndex>=0);
       assert.ok(!bodies[promptInstallIndex].tools.some(tool=>tool.function.name==='capability_prompt_load'));
       assert.ok(bodies[promptInstallIndex+1].tools.some(tool=>tool.function.name==='capability_prompt_load'),'已安装提示词的按需加载工具必须进入下一次 Provider 请求');
       const promptInstalled=JSON.parse(bodies[promptInstallIndex+1].messages.find(message=>message.role==='tool'&&message.tool_call_id==='fixture-prompt-install').content);
       assert.equal(promptInstalled.promptId,'prompt-'+ 'f'.repeat(20));
       assert.equal(promptInstalled.runtimeActivation.status,'ready');
       assert.equal(promptInstalled.runtimeActivation.addedForNextRequest,true);
       assert.ok(bodies[promptInstallIndex+2].messages.some(message=>message.role==='tool'&&message.content.includes('第三方提示词真实正文')));
       assert.match(runs.getAiRun('fixture-owner',promptRun.id).message.content,/提示词已安装并按需加载/u);
      settings.saveUserSettings('fixture-owner','plugins',{...settings.defaultSettings.plugins,enabled:false});
      bodies=[];scenario='askUserLoop';
      const askRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'需要先确定目标实例'},host);
      await until(()=>runs.getAiRun('fixture-owner',askRun.id).message.activity.some(item=>item.kind==='question'&&item.status==='waiting_input'));
      const pendingQuestion=runs.getAiRun('fixture-owner',askRun.id).message.activity.find(item=>item.kind==='question'&&item.status==='waiting_input');
      assert.equal(pendingQuestion.question,'选择要启动的实例');assert.deepEqual(pendingQuestion.options,['生存服','测试服']);
      assert.throws(()=>runs.answerAiRunQuestion('another-owner',askRun.id,pendingQuestion.questionId,'启动生存服',false),/澄清问题/u);
      assert.throws(()=>runs.answerAiRunQuestion('fixture-owner',askRun.id,'00000000-0000-4000-8000-000000000000','启动生存服',false),/澄清问题/u);
      runs.answerAiRunQuestion('fixture-owner',askRun.id,pendingQuestion.questionId,'启动生存服',false);
      await until(()=>runs.getAiRun('fixture-owner',askRun.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',askRun.id).status,'complete',JSON.stringify({run:runs.getAiRun('fixture-owner',askRun.id),messages:bodies.map(body=>body.messages.filter(item=>item.role==='tool'||item.role==='user'))}));
      assert.match(runs.getAiRun('fixture-owner',askRun.id).message.content,/已按你的选择继续/u);
      assert.ok(runs.getAiRun('fixture-owner',askRun.id).message.activity.some(item=>item.kind==='question'&&item.status==='complete'));
      assert.ok(bodies.at(-1).messages.some(item=>item.role==='tool'&&item.tool_call_id==='fixture-question-call'));
      scenario='basic';
      assert.equal(executions,1);for(const dispose of disposers)dispose();assert.deepEqual(registry.listRegisteredAiTools().map(tool=>tool.id),['interaction.ask-user']);
      await askUserFiber.dispose();assert.equal(registry.listRegisteredAiTools().length,0);await toolsFiber.dispose();
      settings.saveUserSettings('fixture-owner','plugins',settings.defaultSettings.plugins);
      settings.saveUserSettings('fixture-owner','permissions',settings.defaultSettings.permissions);
      settings.saveUserSettings('fixture-owner','ai-runtime',settings.defaultSettings.aiRuntime);
      block=true;release=undefined;
      const cancelled=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'取消目标'},host);
      await until(()=>!!release);assert.equal(runs.cancelAiRun('another-owner',cancelled.id),false);assert.equal(runs.cancelAiRun('fixture-owner',cancelled.id),true);
      await until(()=>runs.getAiRun('fixture-owner',cancelled.id).status!=='streaming');assert.equal(runs.getAiRun('fixture-owner',cancelled.id).status,'interrupted');
      await runs.closeAiRuns();await questionsFiber.dispose();await modelFiber.dispose();await settingsFiber.dispose();await approvalFiber.dispose();assert.equal(pluginContext.lfaaCredentials.providers().includes('lfaa-settings'),false);await credentialsFiber.dispose();mcpServer.closeAllConnections();await new Promise(resolve=>mcpServer.close(resolve));configuration.close();sessionRecords.close();closeDatabase();
      process.stdout.write('后台执行回归通过');
    `;
    writeFileSync(childScript, source, "utf8");
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", childScript], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe", timeout: 20000 });
    assert.match(output, /后台执行回归通过/);
  } finally {
    assert.equal(dirname(resolve(childScript)), parent);
    rmSync(childScript, { force: true });
    assert.equal(dirname(resolve(data)), parent);
    rmSync(data, { recursive: true, force: true });
  }
});
