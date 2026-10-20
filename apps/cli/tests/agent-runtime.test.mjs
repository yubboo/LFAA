/**
 * 功能：回归后台 Agent、工具协议、执行预算和权限提示。
 * 作用：仅在隔离测试数据与合成 Provider 流中验证断线、重连、取消、账户隔离和历史恢复。
 * 关联文件：core/agent-loop、core/session、preset/agent-preset；合成模型与账户不进入产品。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendShellCommandActivityPreview, sanitizeShellCommandActivityPreview } from "../../../packages/core/agent-loop/src/shell-command-activity.ts";
import { buildAiProjectFileChanges } from "../../../packages/core/agent-loop/src/project-file-activity.ts";
import { buildWebActivityPreview } from "../../../packages/core/agent-loop/src/web-activity.ts";
import { toolExecutionState } from "../../../packages/core/agent-loop/src/tool-outcome.ts";

test("顶层与嵌套任务结果保持失败、运行中及未知状态，不能误记为成功写入", () => {
  for (const wrap of [value => value, value => ({task:value})]) {
    assert.equal(toolExecutionState(wrap({status:'failed',result:{}}),true),'failed');
    assert.equal(toolExecutionState(wrap({status:'failed',result:{outcome:'unknown'}}),true),'unconfirmed');
    assert.equal(toolExecutionState(wrap({status:'running'}),true),'unconfirmed');
    assert.equal(toolExecutionState(wrap({status:'succeeded',result:{serverReady:true}}),true),'complete');
  }
  assert.equal(toolExecutionState({status:'succeeded'},false),'not_started');
  assert.equal(toolExecutionState({executionState:'not_started',error:'准备阶段失败'},true),'not_started');
  assert.equal(toolExecutionState({task:{status:'cancelled'}},true),'unconfirmed');
  assert.equal(toolExecutionState({executionState:'cancelled'},true),'unconfirmed');
  // 节点 Shell 将任务头与执行结果分开返回，未知副作用不能被 succeeded 任务头覆盖。
  assert.equal(toolExecutionState({task:{status:'succeeded'},result:{outcome:'unknown'}},true),'unconfirmed');
});

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stdioMcpFixture = resolve(cli, "tests", "fixtures", "mcp-stdio-fixture.mjs");

test("本机应用 Agent 提示先核实已打开状态，再用一次 query 启动且不循环", () => {
  const source = readFileSync(new URL("../../../packages/core/agent-loop/src/execute-turn.ts", import.meta.url), "utf8");
  const start = source.indexOf("const localApplicationInstruction = [");
  const end = source.indexOf("const localGameInstruction = [", start);
  assert.ok(start >= 0 && end > start);
  const instruction = source.slice(start, end);
  assert.match(instruction, /先用一句简短正文告诉用户接下来会确认应用状态并在必要时启动/u);
  assert.match(instruction, /观察当前屏幕\/可见窗口/u);
  assert.match(instruction, /已确认目标应用打开，直接简洁报告并结束/u);
  assert.match(instruction, /computer_use_launch_local_app 的 query 一次完成有界发现与启动/u);
  assert.match(instruction, /启动请求返回后重新观察一次/u);
  assert.match(instruction, /不循环搜索或重复启动/u);
  assert.doesNotMatch(instruction, /并调用 computer_use_search_local_apps；/u);
});

test("Shell 活动预览保留命令、遮蔽常见凭据并限制长度", () => {
  const command = 'Invoke-RestMethod -Headers @{ Authorization = "Bearer bearer-secret-value" } --api-key="sk-test-12345678901234567890"; curl -u admin:curl-password https://user:url-password@example.test/data';
  const preview = sanitizeShellCommandActivityPreview(command);
  assert.match(preview, /Invoke-RestMethod/u);
  assert.doesNotMatch(preview, /bearer-secret-value|sk-test-12345678901234567890|curl-password|url-password/u);

  const localDetail = appendShellCommandActivityPreview("local.execute-command", command, "命令执行完成。");
  assert.match(localDetail, /本机 PowerShell 命令预览/u);
  assert.match(localDetail, /命令执行完成/u);
  const nodeDetail = appendShellCommandActivityPreview("host.execute-command", "Get-Location", "节点任务已完成。");
  assert.match(nodeDetail, /目标节点 Shell 命令预览/u);
  assert.equal(appendShellCommandActivityPreview("other.tool", "Get-Location", "原活动说明。"), "原活动说明。");

  const longPreview = sanitizeShellCommandActivityPreview(`Get-Content ${"x".repeat(5000)}`);
  assert.ok(longPreview.length <= 4000);
  assert.match(longPreview, /命令已截断/u);
});

test("网页活动保留实际查询与 URL，遮蔽凭据且不记录 URL 查询串、片段或正文", () => {
  assert.equal(buildWebActivityPreview("web.search", { queries: ["site:api-docs.deepseek.com thinking mode", "reasoning_content"] }), "搜索查询：\nsite:api-docs.deepseek.com thinking mode\nreasoning_content");
  const safe = buildWebActivityPreview("web.search", { queries: ["api_key=sk-test-12345678901234567890", "x".repeat(5000)] });
  assert.ok(safe.length < 1900);assert.doesNotMatch(safe, /sk-test-12345678901234567890/u);assert.match(safe,/预览已截断/u);
  assert.equal(buildWebActivityPreview("web.fetch", { url: "https://user:secret@example.test/docs?token=secret#private" }), "读取网页：\nhttps://example.test/docs");
  assert.equal(buildWebActivityPreview("web.fetch", { url: "file:///private" }), null);
  assert.equal(buildWebActivityPreview("other.tool", { queries: ["private"] }), null);
});

test("文件活动只记录成功 CRUD 的有界项目相对路径，不包含正文或工具输出", () => {
  assert.deepEqual(buildAiProjectFileChanges("project.files", { operation: "read" }, {
    result: { path: "H:/project/src/app.ts", relativePath: "src/app.ts", content: "私密文件正文" }
  }, "project-1"), [{ operation: "read", path: "src/app.ts", projectId: "project-1" }]);
  const parameters = { operation: "replace", path: "src/app.ts", oldText: "私密旧正文", newText: "私密新正文" };
  const changes = buildAiProjectFileChanges("project.files", parameters, {
    taskId: "task-1",
    result: { changed: true, relativePath: "src/app.ts", change: { oldText: "私密旧正文", newText: "私密新正文" } }
  }, "project-1");
  assert.deepEqual(changes, [{ operation: "modified", path: "src/app.ts", projectId: "project-1" }]);
  assert.doesNotMatch(JSON.stringify(changes), /私密旧正文|私密新正文|task-1/u);
  assert.deepEqual(buildAiProjectFileChanges("project.files", { operation: "write" }, { result: { changed: false, relativePath: "src/app.ts" } }, "project-1"), []);
  assert.deepEqual(buildAiProjectFileChanges("project.files", { operation: "delete" }, { error: "失败", executed: false }, "project-1"), []);
  assert.deepEqual(buildAiProjectFileChanges("project.files", { operation: "create" }, { result: { created: true, relativePath: "../escape.txt" } }, "project-1"), []);
  const files = Array.from({ length: 130 }, (_, index) => ({ relativePath: `skills/${index}/SKILL.md`, content: "不写入活动" }));
  const created = buildAiProjectFileChanges("project.files", { operation: "create_tree" }, { result: { created: true, files } }, null);
  assert.equal(created.length, 128);
  assert.equal(created[0]?.projectId, null);
  assert.doesNotMatch(JSON.stringify(created), /不写入活动/u);
  assert.deepEqual(buildAiProjectFileChanges("other.tool", { operation: "delete" }, { result: { deleted: true, relativePath: "safe.txt" } }, "project-1"), []);
});

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
      // 先完成正式存储初始化，再加载依赖 Writing 的工具；不得跳过本地文件迁移校验。
      const sessions=await import('lfaa-session/src/sessions.js');
      const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
      const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
      const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      const stdioMcpFixture=${JSON.stringify(stdioMcpFixture)};
      const tools=await import('lfaa-tools/src/business-tools.js');
      const {Context}=await import('@deepseek-ai/cordis');
      const pluginContext=new Context();
      const credentialsFiber=await pluginContext.plugin(await import('lfaa-credentials/src/index.js'));
      const approvalFiber=await pluginContext.plugin(await import('lfaa-user-approval/src/index.js'));
      const questionsFiber=await pluginContext.plugin(await import('lfaa-user-questions/src/index.js'));
      const settingsFiber=await pluginContext.plugin(await import('lfaa-settings/src/index.js'));
      const modelFiber=await pluginContext.plugin(await import('lfaa-agent-default-model/src/index.js'));
      await pluginContext.plugin(await import('lfaa-llm'));
      const toolsFiber=await pluginContext.plugin(await import('lfaa-tools/src/index.js'));
      pluginContext.provide('lfaaMinecraft',await import('lfaa-games-minecraft/src/service.js'));
      const extensionsFiber=await pluginContext.plugin((await import('lfaa-agent')).default);
      const promptToolsFiber=await pluginContext.plugin(await import('lfaa-prompt'));
      const minecraftToolsFiber=await pluginContext.plugin(await import('lfaa-tool-minecraft'));
      const askUserFiber=await pluginContext.plugin(await import('lfaa-tool-ask-user/src/index.js'));
      const shellFiber=await pluginContext.plugin(await import('lfaa-tool-shell/src/index.js'));
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
      assert.equal(database.prepare('PRAGMA user_version').get().user_version,59);
      const {aiRuntimeSettingsSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
      const {AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN,AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN}=await import('lfaa-util-values/src/settings-contract.js');
      assert.equal(aiRuntimeSettingsSchema.validate({...settings.defaultSettings.aiRuntime,maxModelRequests:0,maxToolCalls:0}).error,undefined);
      assert.equal(aiRuntimeSettingsSchema.validate({...settings.defaultSettings.aiRuntime,maxModelRequests:AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN,maxToolCalls:AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN}).error,undefined);
      assert.ok(aiRuntimeSettingsSchema.validate({...settings.defaultSettings.aiRuntime,maxModelRequests:AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN+1}).error);
      assert.ok(aiRuntimeSettingsSchema.validate({...settings.defaultSettings.aiRuntime,maxToolCalls:AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN+1}).error);
      assert.ok(aiRuntimeSettingsSchema.validate({...settings.defaultSettings.aiRuntime,maxModelRequests:-1}).error);
      configuration.save('user_settings',{user_id:'fixture-owner',category:'ai-runtime',value_json:JSON.stringify({...settings.defaultSettings.aiRuntime,maxModelRequests:AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN+20,maxToolCalls:AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN+20})});
      const legacyRuntimeSettings=settings.getUserSettings('fixture-owner').aiRuntime;
      assert.equal(legacyRuntimeSettings.maxModelRequests,AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN,'历史超大模型预算按产品安全上限读取');
      assert.equal(legacyRuntimeSettings.maxToolCalls,AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN,'历史超大工具预算按产品安全上限读取');
      settings.saveUserSettings('fixture-owner','ai-runtime',settings.defaultSettings.aiRuntime);
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
      const stdioConfig={id:'stdio_contract',name:'本机 MCP',transport:'stdio',command:process.execPath,args:['--version'],enabled:true,applicationIds:['workspace'],computerUse:true};
      assert.equal(pluginsSettingsSchema.validate({enabled:true,mcpServers:[stdioConfig]}).error,undefined);
      assert.ok(pluginsSettingsSchema.validate({enabled:true,mcpServers:[{...stdioConfig,command:'node\\0bad'}]}).error);
      assert.ok(pluginsSettingsSchema.validate({enabled:true,mcpServers:[{id:'http-cua',name:'HTTP CUA',url:'http://127.0.0.1:1234/mcp',enabled:true,computerUse:true}]}).error);
      settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[stdioConfig]});
      assert.deepEqual(settings.getUserSettings('fixture-owner').plugins.mcpServers[0],{...stdioConfig,applicationIds:['workspace']},'Settings Owner 必须持久化本机传输和 Computer-Use 类型');
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
      const sharedNodeCommand=tools.listAiBusinessTools('workspace','admin').find(tool=>tool.id==='host.execute-command');
      assert.equal(sharedNodeCommand.name,'host_execute_command','跨界面复用节点能力仍与本机 local_execute_command 分开');
      assert.throws(()=>sharedNodeCommand.prepare(sharedNodeCommand.parse({command:'Get-Location'}),{userId:'fixture-owner',workspaceProject:null}),/选择在线 Daemon 节点/u,'缺少真实节点目标时不得回退到控制端本机');
      const shellTool=tools.listAiBusinessTools('minecraft','admin').find(tool=>tool.id==='host.execute-command');assert.ok(shellTool,'游戏 App 仍由模型选择目标节点 Shell 工具');
      const projectNode='11111111-1111-4111-8111-111111111111';
      const projectCommand=shellTool.parse({command:'Get-Location'});
      const projectPrepared=shellTool.prepare(projectCommand,{userId:'fixture-owner',workspaceProject:{nodeId:projectNode,path:'/fixture/project',title:'fixture'}});
      assert.equal(projectPrepared.nodeId,projectNode);assert.equal(projectPrepared.workingDirectory,'/fixture/project');
      assert.equal(projectPrepared.shell,settings.getUserSettings('fixture-owner').general.integratedShell);
      const shellBefore=settings.getUserSettings('fixture-owner').general.integratedShell;
      const powershellPrepared=shellTool.prepare(shellTool.parse({nodeId:projectNode,command:'$value = 1; Write-Output $value',shell:'powershell'}),{userId:'fixture-owner',workspaceProject:null});
      assert.equal(powershellPrepared.shell,'powershell');
      assert.equal(settings.getUserSettings('fixture-owner').general.integratedShell,shellBefore,'单次明确 Shell 不修改用户终端偏好');
      assert.throws(()=>shellTool.parse({nodeId:projectNode,command:'echo fixture',shell:'arbitrary-executable'}));
      const nodeOwner=await import('lfaa-host-daemon/src/local-daemon.js');
      nodeOwner.recordDaemonHeartbeat({id:projectNode,displayName:'fixture-path-node',platform:'win32',architecture:'x64',version:'fixture',dataRoot:'/fixture/data',capabilities:['minecraft-vanilla'],javaRuntimes:[]});
      const nodesTool=tools.listAiBusinessTools('minecraft','super_admin').find(tool=>tool.id==='minecraft.list-nodes');
      assert.equal((await nodesTool.execute({}, {userId:'fixture-owner',userRole:'super_admin'})).find(node=>node.id===projectNode).dataRoot,'/fixture/data');
      assert.equal(Object.hasOwn((await nodesTool.execute({}, {userId:'fixture-owner',userRole:'member'})).find(node=>node.id===projectNode),'dataRoot'),false,'普通账户不获得宿主绝对路径');
      const explicitPrepared=shellTool.prepare(shellTool.parse({nodeId:'22222222-2222-4222-8222-222222222222',command:'Get-Location',workingDirectory:'/explicit/path'}),{userId:'fixture-owner',workspaceProject:{nodeId:projectNode,path:'/fixture/project',title:'fixture'}});
      assert.equal(explicitPrepared.nodeId,'22222222-2222-4222-8222-222222222222');assert.equal(explicitPrepared.workingDirectory,'/explicit/path');
      settings.saveUserSettings('fixture-owner','general',{...settings.defaultSettings.general,taskFolder:'/fixture/default'});
      const settingsPrepared=shellTool.prepare(shellTool.parse({nodeId:projectNode,command:'Get-Location'}),{userId:'fixture-owner',workspaceProject:null});
      assert.equal(settingsPrepared.workingDirectory,'/fixture/default');settings.saveUserSettings('fixture-owner','general',settings.defaultSettings.general);
      let bodies=[]; let block=false; let release; let scenario='basic'; let holdChild=false; let executions=0; let holdPauseResponse=false; let releasePauseResponse; let pauseRequestSignal; let holdWriteTool=false; let releaseWriteTool; let pauseToolSignal;
      const nativeFetch=globalThis.fetch;
      globalThis.fetch=async (url,options={})=>{
        if(String(url).startsWith(mcpUrl))return nativeFetch(url,options);
        if(String(url).endsWith('/models'))return Response.json({data:[{id:'fixture-model'},{id:'fixture-child'}]});
        assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
        const body=JSON.parse(options.body);bodies.push(body);
        const isChild=body.messages.some(message=>message.role==='user'&&message.content==='child-target');
        if(holdPauseResponse&&scenario==='pauseBeforeTool'){pauseRequestSignal=options.signal;await new Promise(resolve=>{releasePauseResponse=resolve;});}
        if(block||(holdChild&&isChild))await new Promise((resolve,reject)=>{release=resolve;options.signal.addEventListener('abort',()=>reject(new DOMException('已取消','AbortError')),{once:true});});
        const hasResult=body.messages.some(message=>message.role==='tool');
        if(isChild){assert.equal(body.model,'fixture-child');assert.deepEqual(body.tools.map(tool=>tool.function.name),['fixture_read_probe']);}
        let delta;
        if(scenario==='pauseBeforeTool'||scenario==='pauseDuringTool'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){delta={tool_calls:[{index:0,id:'fixture-pause-write',type:'function',function:{name:'fixture_write_probe',arguments:'{}'}}]};}
          else{delta={content:'同一 Run 已恢复并完成'};}
        }else if(scenario==='planSafety'){
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
        }else if(scenario==='stdioComputerUse'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){const system=body.messages.find(message=>message.role==='system')?.content??'';assert.match(system,/untrusted-mcp-instructions/u);assert.match(system,/先调用 get_app_state/u);const observe=body.tools.find(tool=>tool.function.name.startsWith('mcp_stdio_cua_'));assert.ok(observe,'已登记的本机 Computer-Use MCP 工具必须按自然语言目标进入模型目录');delta={tool_calls:[{index:0,id:'fixture-stdio-observe',type:'function',function:{name:observe.function.name,arguments:JSON.stringify({app:'当前窗口'})}}]};}
          else{const result=toolResults.at(-1).content;assert.ok(Array.isArray(result),'MCP 工具结果应保留多模态消息而不是 JSON 文本');assert.ok(result.some(part=>part.type==='text'&&part.text.includes('测试窗口')));assert.ok(result.some(part=>part.type==='image_url'&&part.image_url.url.startsWith('data:image/png;base64,')),'模型必须收到本轮临时截图');delta={content:'我看到了当前窗口的画面'};}
        }else if(scenario==='stdioComputerUseDisabled'){
          assert.ok(!body.tools.some(tool=>tool.function.name.startsWith('mcp_stdio_cua_')),'电脑操控关闭时不向模型提供工具');
          delta={content:'当前账户已关闭电脑操控'};
        }else if(scenario==='promptLoop'){
          const toolResults=body.messages.filter(message=>message.role==='tool');
          if(toolResults.length===0){assert.ok(body.tools.some(tool=>tool.function.name==='capability_install'));assert.ok(!body.tools.some(tool=>tool.function.name==='capability_prompt_load'),'未安装提示词时不向模型暴露无用工具');delta={tool_calls:[{index:0,id:'fixture-prompt-install',type:'function',function:{name:'capability_install',arguments:JSON.stringify({kind:'prompt'})}}]};}
          else if(toolResults.length===1){const installed=JSON.parse(toolResults[0].content);const promptTool=body.tools.find(tool=>tool.function.name==='capability_prompt_load');assert.ok(promptTool);assert.ok(installed.promptId);delta={tool_calls:[{index:0,id:'fixture-prompt-load',type:'function',function:{name:promptTool.function.name,arguments:JSON.stringify({promptId:installed.promptId})}}]};}
          else{assert.ok(toolResults.some(item=>item.content.includes('第三方提示词真实正文')));delta={content:'提示词已安装并按需加载'};}
        }else if(scenario==='recoverFailedTask'){
          const count=body.messages.filter(message=>message.role==='tool').length;
          const name=count===1?'fixture_write_probe':'fixture_task_probe';
          delta=count>=3?{content:'依赖修复后启动成功。'}:{tool_calls:[{index:0,id:'fixture-recover-'+count,type:'function',function:{name,arguments:'{}'}}]};
        }else if(scenario==='recoverPreflight'||scenario==='repeatPreflight'){
          const count=body.messages.filter(message=>message.role==='tool').length;
          const name=scenario==='recoverPreflight'&&count===1?'fixture_read_probe':'fixture_preflight_probe';
          delta=scenario==='recoverPreflight'&&count>=3?{content:'准备失败后核查并完成。'}:{tool_calls:[{index:0,id:'fixture-preflight-'+count,type:'function',function:{name,arguments:'{}'}}]};
        }else if(scenario==='invalidToolArguments'||scenario==='abortedTool'){
          const name=scenario==='invalidToolArguments'?'fixture_read_probe':'fixture_abort_probe';
          delta=hasResult?{content:'已如实报告工具没有完成'}:{tool_calls:[{index:0,id:'fixture-protocol-pair',type:'function',function:{name,arguments:scenario==='invalidToolArguments'?'{':'{}'}}]};
        }else if(scenario==='repeatFailedTool'){
          assert.ok(body.tools.some(tool=>tool.function.name==='fixture_failure_probe'));
          delta={tool_calls:[{index:0,id:'fixture-failure-'+body.messages.filter(message=>message.role==='tool').length,type:'function',function:{name:'fixture_failure_probe',arguments:'{}'}}]};
        }else if(scenario==='repeatSuccessfulTool'){
          assert.ok(body.tools.some(tool=>tool.function.name==='fixture_write_probe'));
          delta=body.messages.filter(message=>message.role==='tool').length>=2 ? {content:'已核对已有成功结果，无需重复操作。'} : {tool_calls:[{index:0,id:'fixture-success-'+body.messages.filter(message=>message.role==='tool').length,type:'function',function:{name:'fixture_write_probe',arguments:'{}'}}]};
        }else if(scenario==='modelBudgetZero'){
          assert.ok(body.tools.some(tool=>tool.function.name==='fixture_read_probe'));
          delta={tool_calls:[{index:0,id:'fixture-model-budget-'+body.messages.filter(message=>message.role==='tool').length,type:'function',function:{name:'fixture_read_probe',arguments:'{}'}}]};
        }else if(scenario==='toolBudgetZero'){
          assert.ok(body.tools.some(tool=>tool.function.name==='fixture_read_probe'));
          const count=body.messages.filter(message=>message.role==='tool').length;
          const batchSize=count===0?129:1;
          delta={tool_calls:Array.from({length:batchSize},(_,index)=>({index,id:'fixture-tool-budget-'+count+'-'+index,type:'function',function:{name:'fixture_read_probe',arguments:'{}'}}))};
        }else{
          const name=scenario==='children' ? isChild ? 'fixture_read_probe' : 'delegate_domain_expert' : 'host_list_nodes';
          const argumentsText=name==='delegate_domain_expert' ? JSON.stringify({task:'child-target',toolNames:['fixture_read_probe']}) : '{}';
          delta=hasResult||!body.tools ? {content:'合成测试回答'} : {tool_calls:[{index:0,id:'fixture-call',type:'function',function:{name,arguments:argumentsText}}]};
        }
        return new Response('data: '+JSON.stringify({choices:[{delta}],...(scenario==='repeatFailedTool'?{usage:{prompt_tokens:11,completion_tokens:3}}:{})})+'\\n\\ndata: [DONE]\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
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
      const host={llm:pluginContext.lfaaLlm,listPlugins:()=>[],listExtensions:()=>[],listInstructionExtensions:()=>[],listHooks:()=>[],getSystemInstructions:()=>[],runBeforeInference:()=>({failedHookIds:[]}),runAfterInference:()=>({failedHookIds:[]})};
      const runs=await import('lfaa-agent-loop/src/runs.js');runs.initializeAiRuns(pluginContext.lfaaAgentDefaultModel,pluginContext.lfaaUserApproval,pluginContext.lfaaUserQuestions,pluginContext.lfaaLlm);
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
      const activity=runs.getAiRun('fixture-owner',run.id).message.activity.find(item=>item.title==='查询 Daemon 节点');
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
      assert.equal(next.history.some(item=>item.role==='user'&&item.content.includes('启动生存服')),false,'澄清答案不得改写为普通 user 消息');
      assert.ok(next.history.some(item=>item.role==='assistant'&&item.tool_calls?.some(call=>call.id==='fixture-question'&&call.function.name==='lfaa_ask_user')));
      assert.ok(next.history.some(item=>item.role==='tool'&&item.tool_call_id==='fixture-question'&&JSON.parse(item.content).answer==='启动生存服'));
      assert.ok(next.history.some(item=>item.role==='assistant'&&item.content==='合成测试回答'));
      assert.ok(next.history.every(item=>item.role!=='tool'||item.tool_call_id==='fixture-question'));
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
      let failureExecutions=0;
      let taskExecutions=0;
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.task-probe',name:'fixture_task_probe',description:'隔离领域启动与恢复夹具',retryAfterRecovery:true,applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'write',approval:()=>({scopeKey:'fixture-task',scopeSummary:'隔离任务',summary:'验证依赖恢复'}),execute:async()=>({status:++taskExecutions===1?'failed':'succeeded',message:'真实任务夹具',result:{}})});
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.failure-probe',name:'fixture_failure_probe',description:'验证不重复派发失败操作',applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'read',approval:()=>({scopeKey:'fixture-failure',scopeSummary:'隔离测试目标',summary:'验证失败操作防重'}),execute:async()=>{failureExecutions++;throw new Error('合成执行器返回未知结果');}});
      let writeExecutions=0;
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.abort-probe',name:'fixture_abort_probe',description:'仅测试执行器取消的协议证据',applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'read',approval:()=>({scopeKey:'fixture-abort',scopeSummary:'隔离取消',summary:'核对协议配对'}),execute:async()=>{throw new DOMException('合成执行器已中止等待','AbortError');}});
      let preflightExecutions=0;
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.preflight-probe',name:'fixture_preflight_probe',description:'仅测试准备失败且没有副作用的恢复',applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'write',approval:()=>({scopeKey:'fixture-preflight',scopeSummary:'隔离准备目标',summary:'验证安全恢复'}),execute:async()=>++preflightExecutions===1||scenario==='repeatPreflight'?{error:'合成元数据连接失败',executionState:'not_started',retryable:true,executed:false}:{executed:true}});
      registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'fixture.write-probe',name:'fixture_write_probe',description:'仅测试目录的受审批写操作夹具',applicationIds:['workspace'],schema:{type:'object',properties:{},additionalProperties:false},parse:value=>value,risk:()=> 'write',approval:()=>({scopeKey:'fixture-write-target',scopeSummary:'隔离测试目标',summary:'验证一次性审批通知'}),execute:async(_,context)=>{assert.equal(context.userId,'fixture-owner');if(holdWriteTool&&scenario==='pauseDuringTool'){pauseToolSignal=context.signal;await new Promise(resolve=>{releaseWriteTool=resolve;});}writeExecutions++;return {executed:true};}});
      settings.saveUserSettings('fixture-owner','permissions',{mode:'full_access'});
      bodies=[];scenario='pauseBeforeTool';holdPauseResponse=true;releasePauseResponse=undefined;const writesBeforePause=writeExecutions;
      const pauseRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'暂停前不派发写操作'},host);
      const pauseEvents=[];runs.subscribeAiRun('fixture-owner',pauseRun.id,(event,data)=>pauseEvents.push({event,data}));
      await until(()=>typeof releasePauseResponse==='function');
      assert.equal(runs.pauseAiRun('another-owner',pauseRun.id),null,'其他账户不能暂停此 Run');
      assert.equal(runs.pauseAiRun('fixture-owner',pauseRun.id),'pausing');
      assert.equal(pauseRequestSignal.aborted,false,'暂停不能 abort Provider 请求');
      const releaseProviderResponse=releasePauseResponse;releasePauseResponse=undefined;holdPauseResponse=false;releaseProviderResponse();
      await until(()=>runs.getAiRunPauseState('fixture-owner',pauseRun.id)==='paused');
      assert.equal(runs.getAiRun('fixture-owner',pauseRun.id).status,'streaming','暂停后 Run 仍保持活动');
      assert.equal(writeExecutions,writesBeforePause,'暂停检查点前不得派发模型刚返回的写工具');
      assert.equal(bodies.length,1,'暂停状态下不继续请求模型');
      const pauseReconnect=[];runs.subscribeAiRun('fixture-owner',pauseRun.id,(event,data)=>pauseReconnect.push({event,data}));
      assert.equal(pauseReconnect.find(item=>item.event==='pause-state').data.state,'paused','重订阅快照回报暂停状态');
      assert.equal(runs.resumeAiRun('another-owner',pauseRun.id),null,'其他账户不能继续此 Run');
      assert.equal(runs.resumeAiRun('fixture-owner',pauseRun.id),'running');
      await until(()=>runs.getAiRun('fixture-owner',pauseRun.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',pauseRun.id).status,'complete');
      assert.equal(runs.getAiRun('fixture-owner',pauseRun.id).id,pauseRun.id,'继续必须沿用同一 Run ID');
      assert.equal(writeExecutions,writesBeforePause+1,'恢复后写工具恰好派发一次');
      assert.equal(bodies.length,2,'同一 Run 继续而不是创建新的模型轮次');
      assert.deepEqual(pauseEvents.filter(item=>item.event==='pause-state').map(item=>item.data.state),['running','pausing','paused','running']);
      assert.equal(pauseEvents.filter(item=>item.event==='done').at(-1).data.status,'complete');
      bodies=[];scenario='pauseDuringTool';holdWriteTool=true;releaseWriteTool=undefined;const writesBeforeInFlightPause=writeExecutions;
      const inFlightPause=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'工具完成后暂停'},host);
      await until(()=>typeof releaseWriteTool==='function');
      assert.equal(runs.pauseAiRun('fixture-owner',inFlightPause.id),'pausing');
      assert.equal(pauseToolSignal.aborted,false,'暂停不能中断已派发的工具操作');
      const releaseInFlightTool=releaseWriteTool;releaseWriteTool=undefined;holdWriteTool=false;releaseInFlightTool();
      await until(()=>runs.getAiRunPauseState('fixture-owner',inFlightPause.id)==='paused');
      assert.equal(writeExecutions,writesBeforeInFlightPause+1,'暂停前已派发的工具应完整执行一次');
      assert.equal(bodies.length,1,'工具返回后暂停，不立即发起下一轮 Provider 请求');
      const inFlightEvents=sessionRecords.allForSession('session_events',inFlightPause.sessionId).filter(event=>event.type==='tool/call'&&event.data.runId===inFlightPause.id);
      assert.equal(inFlightEvents.length,1);assert.equal(inFlightEvents[0].data.dispatched,true);
      assert.equal(runs.resumeAiRun('fixture-owner',inFlightPause.id),'running');
      await until(()=>runs.getAiRun('fixture-owner',inFlightPause.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',inFlightPause.id).status,'complete');
      assert.equal(writeExecutions,writesBeforeInFlightPause+1,'继续同一 Run 不得重放已完成工具');
      assert.equal(bodies.length,2);
      scenario='basic';
      bodies=[];settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,maxModelRequests:0,maxToolCalls:0});
      const executionsBeforeModelBudget=executions;scenario='modelBudgetZero';
      const modelBudgetZero=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'验证零模型预算仍有有限上限'},host);
      await until(()=>runs.getAiRun('fixture-owner',modelBudgetZero.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',modelBudgetZero.id).status,'error');
      assert.equal(bodies.length,AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN,'0 模型请求预算必须使用产品安全上限');
      assert.equal(executions-executionsBeforeModelBudget,AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN-1,'最后一次请求返回的工具不得在预算到达后派发');
      assert.match(runs.getAiRun('fixture-owner',modelBudgetZero.id).message.content,/模型请求预算 64 次已达到有效上限/u);
      settings.saveUserSettings('fixture-owner','ai-runtime',{...settings.defaultSettings.aiRuntime,maxModelRequests:0,maxToolCalls:0});
      bodies=[];const executionsBeforeToolBudget=executions;scenario='toolBudgetZero';
      const toolBudgetZero=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'验证零工具预算仍有有限上限'},host);
      await until(()=>runs.getAiRun('fixture-owner',toolBudgetZero.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',toolBudgetZero.id).status,'error');
      assert.equal(executions-executionsBeforeToolBudget,0,'超出 0 值对应产品安全上限的整批工具不得派发');
      assert.equal(bodies.length,1,'工具预算超限后不再请求 Provider');
      assert.match(runs.getAiRun('fixture-owner',toolBudgetZero.id).message.content,/工具调用预算 128 已达到有效上限/u);
      settings.saveUserSettings('fixture-owner','ai-runtime',settings.defaultSettings.aiRuntime);
      bodies=[];scenario='repeatSuccessfulTool';const successfulWritesBefore=writeExecutions;
      const repeatedSuccess=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'验证成功写操作不会重复派发'},host);
      await until(()=>runs.getAiRun('fixture-owner',repeatedSuccess.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',repeatedSuccess.id).status,'complete');
      assert.equal(writeExecutions-successfulWritesBefore,1,'相同成功写操作只执行一次');
      assert.equal(bodies.length,3,'防重反馈回到同一 Run，允许模型纠正并交付');
      assert.ok(runs.getAiRun('fixture-owner',repeatedSuccess.id).message.content.includes('无需重复操作'));
      const successfulCalls=sessionRecords.allForSession('session_events',repeatedSuccess.sessionId).filter(event=>event.type==='tool/call'&&event.data.name==='fixture_write_probe');
      assert.deepEqual(successfulCalls.map(event=>event.data.dispatched),[true,false]);
      bodies=[];scenario='recoverFailedTask';
      const recovered=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'修复依赖后再启动同一实例的合成目标'},host);
      await until(()=>runs.getAiRun('fixture-owner',recovered.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',recovered.id).status,'complete');
      assert.equal(taskExecutions,2,'明确失败的领域操作在不同写工具修复后允许重验并执行');
      assert.ok(bodies[1].messages.some(message=>message.role==='tool'&&message.content.includes('failed')));
      assert.equal(bodies.length,4);
      executions=0;writeExecutions=0;
      bodies=[];scenario='planSafety';const planningRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'先做计划再实践，请先检查范围，等我确认后执行'},host);let planModeEvents=[];const unsubscribePlanMode=runs.subscribeAiRun('fixture-owner',planningRun.id,(event,data)=>{if(event==='plan-mode')planModeEvents.push(data);});
      await until(()=>runs.getAiRun('fixture-owner',planningRun.id).status==='complete');
      unsubscribePlanMode();assert.deepEqual(planModeEvents,[{sessionId:planningRun.sessionId,active:true}]);
      assert.equal(sessions.getAiSessionPlanMode('fixture-owner',planningRun.sessionId),true);
      assert.equal(writeExecutions,0,'完全权限也不能绕过计划讨论阶段的只读边界');
      assert.ok(bodies.length>=4);assert.ok(bodies.every(body=>body.tools.some(tool=>tool.function.name==='lfaa_approve_plan_and_execute')));
      const planToolCalls=sessionRecords.allForSession('session_events',planningRun.sessionId).filter(event=>event.type==='tool/call');
      assert.equal(planToolCalls.filter(event=>event.data.name==='fixture_write_probe'&&event.data.dispatched===false).length,2);
      assert.equal(executions,1,'计划期间保留只读查询');executions=0;
      const {discoverMcpTools}=await import('lfaa-mcp-client/src/runtime.js');
       registry.registerAiBusinessTool({effect:setup=>disposers.push(setup())},{id:'capabilities.install',name:'capability_install',description:'测试用能力安装 Owner',applicationIds:['workspace'],schema:{type:'object',properties:{kind:{type:'string'}},required:['kind'],additionalProperties:false},parse:value=>value,risk:()=> 'dangerous',approval:()=>({scopeKey:'fixture-capability-install',scopeSummary:'当前测试 App',summary:'安装测试能力'}),execute:async(parameters,context)=>{
         if(parameters.kind==='prompt'){
           const promptContent='第三方提示词真实正文';const promptId='prompt-'+ 'f'.repeat(20);
           const prompt={id:promptId,name:'测试提示词',description:'验证同轮调用',applicationId:context.applicationId,sourceRepository:'https://github.com/acme/prompts',sourcePath:'review.prompt.md',license:'MIT',commit:'b'.repeat(40),archiveSha256:'c'.repeat(64),contentSha256:createHash('sha256').update(promptContent).digest('hex'),content:promptContent,enabled:true,createdAt:new Date().toISOString()};
           settings.saveUserSettings(context.userId,'plugins',{enabled:true,mcpServers:[],prompts:[prompt]});
           return {outcome:'verified_ready',kind:'prompt',targetApplicationId:context.applicationId,promptId,verification:{status:'ready',verified:true,summary:'提示词已写入设置 Owner',details:{id:prompt.id,contentSha256:prompt.contentSha256,enabled:true}}};
         }
        const candidate={id:'loopmcp',name:'回环 MCP',url:mcpUrl,enabled:true,applicationIds:['workspace']};
        const checked=await discoverMcpTools([candidate],'workspace',context.userId,context.signal,5);
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
      const waitingApproval=runs.getAiRun('fixture-owner',approvalRun.id).message.activity.find(item=>item.approvalId===pendingApproval.id);
      assert.match(waitingApproval.approvalQuestion,/待批准：.*目标范围：/u);
      assert.equal(waitingApproval.approvalAnswer,undefined,'等待期间不能伪造审批答案');
      assert.equal(runs.pauseAiRun('fixture-owner',approvalRun.id),'paused','等待审批是安全等待点，可立即暂停');
      assert.equal(permissionPresets.decideAiToolApproval('fixture-owner',pendingApproval.id,'approved',false)?.status,'approved');
      pluginContext.lfaaUserApproval.notify('fixture-owner',pendingApproval.id);
      await until(()=>runs.getAiRun('fixture-owner',approvalRun.id).message.activity.some(item=>item.approvalId===pendingApproval.id&&item.status==='running'));
      await new Promise(resolve=>setTimeout(resolve,25));
      assert.equal(runs.getAiRunPauseState('fixture-owner',approvalRun.id),'paused');assert.equal(writeExecutions,0,'暂停中的审批结果不能提前派发写操作');
      assert.equal(runs.resumeAiRun('fixture-owner',approvalRun.id),'running');
      await until(()=>runs.getAiRun('fixture-owner',approvalRun.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',approvalRun.id).status,'complete');
      assert.equal(sessions.getAiSessionPlanMode('fixture-owner',planningRun.sessionId),false,'批准后退出计划状态，并继续使用原权限审批');
      assert.equal(writeExecutions,1);assert.match(runs.getAiRun('fixture-owner',approvalRun.id).message.content,/审批通过后已执行测试操作/u);
      const recordedApproval=sessions.getAiSessionMessages('fixture-owner',approvalRun.sessionId).find(item=>item.id===approvalRun.id)?.activity.find(item=>item.approvalId===pendingApproval.id);
      assert.equal(recordedApproval?.approvalQuestion,waitingApproval.approvalQuestion);
      assert.equal(recordedApproval?.approvalAnswer,'approved','真实 Permission 决定在原活动中持久化');
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
       settings.saveUserSettings('fixture-owner','computer-control',{enabled:true});
       settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[{id:'stdio_cua',name:'本机 Computer-Use',transport:'stdio',command:process.execPath,args:[stdioMcpFixture],enabled:true,applicationIds:['workspace'],computerUse:true}]});
       bodies=[];scenario='stdioComputerUse';
       const stdioRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'看看当前窗口是什么内容'},host);
       await until(()=>runs.getAiRun('fixture-owner',stdioRun.id).status==='complete');
       const stdioTool=bodies[0].tools.find(tool=>tool.function.name.startsWith('mcp_stdio_cua_'));
       assert.ok(stdioTool);
       const stdioPid=Number(/PID (\\d+)/u.exec(stdioTool.function.description)?.[1]);
       assert.ok(Number.isInteger(stdioPid));
       await until(()=>{try{process.kill(stdioPid,0);return false;}catch(error){return error.code==='ESRCH';}});
       assert.match(runs.getAiRun('fixture-owner',stdioRun.id).message.content,/我看到了当前窗口/u);
       assert.ok(bodies[1].messages.some(message=>message.role==='tool'&&Array.isArray(message.content)&&message.content.some(part=>part.type==='image_url')));
       settings.saveUserSettings('fixture-owner','computer-control',{enabled:false});
       bodies=[];scenario='stdioComputerUseDisabled';
       const disabledStdioRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'查看当前桌面'},host);
       await until(()=>runs.getAiRun('fixture-owner',disabledStdioRun.id).status==='complete');
       assert.ok(bodies.every(body=>!body.tools?.some(tool=>tool.function.name.startsWith('mcp_stdio_cua_'))));
       settings.saveUserSettings('fixture-owner','plugins',{enabled:true,mcpServers:[]});
       settings.saveUserSettings('fixture-owner','computer-control',{enabled:false});
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
      const questionAnswerResult=runs.answerAiRunQuestion('fixture-owner',askRun.id,pendingQuestion.questionId,'启动生存服',false);
      assert.deepEqual(questionAnswerResult,{mode:'answered'});
      const answeredActivity=runs.getAiRun('fixture-owner',askRun.id).message.activity.find(item=>item.questionId===pendingQuestion.questionId);
      assert.equal(answeredActivity.status,'complete','成功提交后立即持久化原助手消息内的回答状态');
      assert.equal(answeredActivity.detail,'你的回答：启动生存服');
      await until(()=>runs.getAiRun('fixture-owner',askRun.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',askRun.id).status,'complete',JSON.stringify({run:runs.getAiRun('fixture-owner',askRun.id),messages:bodies.map(body=>body.messages.filter(item=>item.role==='tool'||item.role==='user'))}));
      assert.match(runs.getAiRun('fixture-owner',askRun.id).message.content,/已按你的选择继续/u);
      const completedQuestion=runs.getAiRun('fixture-owner',askRun.id).message.activity.find(item=>item.kind==='question'&&item.status==='complete');
      assert.ok(completedQuestion);
      assert.equal(completedQuestion.detail,'你的回答：启动生存服');
      assert.ok(bodies.at(-1).messages.some(item=>item.role==='tool'&&item.tool_call_id==='fixture-question-call'));
      const clarificationUserEvents=sessionRecords.allForSession('session_events',askRun.sessionId).filter(event=>event.type==='user/message'&&event.data.runId===askRun.id);
      assert.deepEqual(clarificationUserEvents,[],'澄清答案不得创建普通 user/message');
      const followupTurn=sessions.createAiTurn('fixture-owner','workspace',askRun.sessionId,'继续处理');
      const clarificationCall=followupTurn.history.find(item=>item.role==='assistant'&&item.tool_calls?.some(call=>call.function.name==='lfaa_ask_user'));
      assert.ok(clarificationCall,'后续上下文仍包含澄清 assistant tool-call');
      const clarificationCallId=clarificationCall.tool_calls.find(call=>call.function.name==='lfaa_ask_user').id;
      const clarificationToolResult=followupTurn.history.find(item=>item.role==='tool'&&item.tool_call_id===clarificationCallId);
      assert.ok(clarificationToolResult,'后续上下文仍包含配对的 tool result');
      assert.equal(JSON.parse(clarificationToolResult.content).answer,'启动生存服');
      assert.equal(followupTurn.history.some(item=>item.role==='user'&&item.content?.includes('此前澄清问题')) ,false,'澄清答案不得合成为用户消息');
      sessions.finishAiAssistantMessage('fixture-owner',askRun.sessionId,followupTurn.assistantMessage.id,'','interrupted');
      settings.saveUserSettings('fixture-owner','plugins',{...settings.defaultSettings.plugins,enabled:true,mcpServers:[]});
      bodies=[];scenario='recoverPreflight';
      const preflightRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'准备失败后检查再恢复'},host);
      await until(()=>runs.getAiRun('fixture-owner',preflightRun.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',preflightRun.id).status,'complete');
      assert.equal(preflightExecutions,2,'Owner 确认没有副作用且有新检查结果后，同参数可以安全再试');
      const preflightResults=sessionRecords.allForSession('session_events',preflightRun.sessionId).filter(event=>event.type==='tool/result');
      assert.equal(preflightResults[0].data.executionState,'not_started');
      bodies=[];scenario='repeatPreflight';const beforeRepeatedPreflight=preflightExecutions;
      const noProgress=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'准备失败后没有新证据不得循环'},host);
      await until(()=>runs.getAiRun('fixture-owner',noProgress.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',noProgress.id).status,'error');
      assert.equal(preflightExecutions,beforeRepeatedPreflight+1,'没有新结果时，同参数准备只执行一次');
      bodies=[];scenario='repeatFailedTool';
      const repeatedFailure=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'验证失败工具不会被反复执行'},host);
      await until(()=>runs.getAiRun('fixture-owner',repeatedFailure.id).status!=='streaming');
      assert.equal(runs.getAiRun('fixture-owner',repeatedFailure.id).status,'error');
      assert.equal(failureExecutions,1,JSON.stringify({message:'执行结果未知的工具在同一 Run 内只派发一次',status:runs.getAiRun('fixture-owner',repeatedFailure.id).status,content:runs.getAiRun('fixture-owner',repeatedFailure.id).message.content,tools:bodies.map(body=>body.tools?.map(tool=>tool.function.name)),history:bodies.map(body=>body.messages.filter(message=>message.role==='tool'))}));
      assert.equal(bodies.length,3,'首次防重给纠正机会，继续重复才停止');
      assert.match(runs.getAiRun('fixture-owner',repeatedFailure.id).message.content,/重复请求先前已失败或结果未知/u);
      const failureCalls=sessionRecords.allForSession('session_events',repeatedFailure.sessionId).filter(event=>event.type==='tool/call'&&event.data.name==='fixture_failure_probe');
      assert.deepEqual(failureCalls.map(event=>event.data.dispatched),[true,false,false]);
      const failedUsage=sessionRecords.allForSession('session_events',repeatedFailure.sessionId).filter(event=>event.type==='usage/record');
      assert.equal(failedUsage.length,1,'失败轮次也保存用量且不重复记账');
      assert.equal(failedUsage[0].data.promptTokens,33);assert.equal(failedUsage[0].data.completionTokens,9);
      for(const scenarioName of ['invalidToolArguments','abortedTool']) {
        bodies=[];scenario=scenarioName;
        const protocolRun=runs.startAiRun('fixture-owner','admin',{appId:'workspace',sessionId:null,content:'核对拒绝与取消的协议配对'},host);
        await until(()=>runs.getAiRun('fixture-owner',protocolRun.id).status!=='streaming');
        const protocolEvents=sessionRecords.allForSession('session_events',protocolRun.sessionId);
        const calls=protocolEvents.filter(event=>event.type==='tool/call');
        const results=protocolEvents.filter(event=>event.type==='tool/result');
        assert.equal(calls.length,1,'参数失败也必须记录模型调用，但不能假称派发');
        assert.equal(results.length,1,'取消仍须保留调用与真实未知结果的配对');
        assert.equal(calls[0].data.callId,results[0].data.callId);
        assert.equal(calls[0].data.dispatched,scenarioName==='abortedTool');
        assert.equal(results[0].data.executionState,scenarioName==='abortedTool'?'unconfirmed':'not_started');
        if(scenarioName==='abortedTool')assert.equal(bodies.length,1,'取消之后不得继续请求模型或派发操作');
      }
      scenario='basic';
      assert.equal(executions,2,'原子任务和本轮准备恢复各执行一次只读核查');for(const dispose of disposers)dispose();await minecraftToolsFiber.dispose();await promptToolsFiber.dispose();await extensionsFiber.dispose();await shellFiber.dispose();assert.deepEqual(registry.listRegisteredAiTools().map(tool=>tool.id),['interaction.ask-user']);
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
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", childScript], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_HOME: join(data, "lfaa-home"), LFAA_DATA_DIR: join(data, "business-data"), JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe", timeout: 20000 });
    assert.match(output, /后台执行回归通过/);
  } finally {
    assert.equal(dirname(resolve(childScript)), parent);
    rmSync(childScript, { force: true });
    assert.equal(dirname(resolve(data)), parent);
    rmSync(data, { recursive: true, force: true });
  }
});
