/** 功能：验证 Session 内核事件与现有 LFAA 会话/账户/App JSONL Owner 原子持久化。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function run(dataDirectory, script) {
  return execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: dataDirectory, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe"
  });
}
const setup = `
  const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
  const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
  const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
  const sessions=await import('lfaa-session/src/sessions.js');
  const close=()=>{configuration.close();sessionRecords.close();closeDatabase();};
`;

test("真实 Agent 请求、Tool 中断修复、精确 fork 与重启沿用唯一 JSONL Owner", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-kernel-"));
  try {
    run(data, `${setup}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('kernel-owner',1,'kernel-owner','salt','hash','admin',1),('kernel-other',2,'kernel-other','salt','hash','member',0)").run();
      const turn=sessions.createAiTurn('kernel-owner','writing',null,'查询当前项目状态');
      sessions.recordAiSessionStep('kernel-owner',turn.session.id,turn.assistantMessage.id,1,'start');
      sessions.recordAiSessionRequest('kernel-owner',turn.session.id,turn.assistantMessage.id,{providerId:'provider-a',modelId:'model-a',permissionMode:'ask',settings:{maxTokens:1024},tools:[{type:'function',function:{name:'read_status',description:'读取状态',parameters:{type:'object',properties:{}}}}]},[{role:'system',content:'真实系统提示词'},{role:'user',content:'查询当前项目状态'}]);
      sessions.recordAiSessionAttempt('kernel-owner',turn.session.id,turn.assistantMessage.id,['部分回答'],new Error('Provider 暂时中断'));
      sessions.recordAiModelResponse('kernel-owner',turn.session.id,turn.assistantMessage.id,'',[{id:'call-1',name:'read_status',arguments:'{}'}],['选择工具'],{promptTokens:3,completionTokens:2});
      sessions.recordAiToolCall('kernel-owner',turn.session.id,turn.assistantMessage.id,'call-1','read_status','{}',true);
      const beforeRecovery=sessionRecords.allForSession('session_events',turn.session.id);
      assert.equal(beforeRecovery.every((event,index)=>event.seq===index+1),true);
      const call=beforeRecovery.find(event=>event.type==='tool/call');
      assert.equal(call.data.headerSeq,beforeRecovery.find(event=>event.type==='request/header').seq);
      assert.equal(beforeRecovery.find(event=>event.type==='assistant/attempt').data.error.message,'Provider 暂时中断');
      assert.deepEqual(beforeRecovery.find(event=>event.type==='assistant/response').data.stream,['选择工具']);
      assert.equal(beforeRecovery.find(event=>event.type==='assistant/response').data.usage.promptTokens,3);
      assert.equal(sessions.getAiSession('kernel-other',turn.session.id),null);
      assert.throws(()=>sessions.recordAiToolResult('kernel-other',turn.session.id,turn.assistantMessage.id,'call-1','{}',false,'complete'),/找不到/);
      sessions.finishAiAssistantMessage('kernel-owner',turn.session.id,turn.assistantMessage.id,'已中断','interrupted');
      const recovered=sessionRecords.allForSession('session_events',turn.session.id);
      const repair=recovered.find(event=>event.type==='tool/result');
      assert.equal(repair.data.executionState,'unconfirmed');
      assert.equal(repair.data.repaired,true);
      assert.equal(recovered.at(-1).type,'turn/end');
      const branch=sessions.forkAiSession('kernel-owner',turn.session.id,call.seq);
      assert.ok(branch); assert.equal(branch.appId,'writing');
      const branchEvents=sessionRecords.allForSession('session_events',branch.id);
      assert.equal(branchEvents.at(-1).seq,branchEvents.length);
      assert.equal(branchEvents.some(event=>event.type==='tool/result'&&event.data.executionState==='unconfirmed'),true);
      assert.equal(sessions.getAiSessionMessages('kernel-owner',branch.id).length,1);
      assert.equal(sessions.getAiSessionMessages('kernel-other',branch.id),null);
      await sessions.flushAiSession('kernel-owner',turn.session.id);
      close();
    `);
    run(data, `${setup}
      const header=sessionRecords.all('ai_sessions',row=>row.user_id==='kernel-owner').find(row=>row.title==='查询当前项目状态');
      assert.ok(header);
      const events=sessionRecords.allForSession('session_events',header.id);
      assert.equal(events.every((event,index)=>event.seq===index+1),true);
      assert.equal(events.some(event=>event.type==='tool/result'&&event.data.executionState==='unconfirmed'),true);
      assert.equal(sessions.getAiSessionMessages('kernel-owner',header.id).at(-1).status,'interrupted');
      await sessions.flushAiSession('kernel-owner',header.id);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-kernel-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("旧会话首次读取幂等导入消息、Tool 历史、项目与真实用量", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-legacy-"));
  try {
    run(data, `${setup}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('legacy-owner',3,'legacy-owner','salt','hash','admin',1),('legacy-other',4,'legacy-other','salt','hash','member',0)").run();
      const time='2026-10-04T00:00:00.000Z';
      const modelHistory=[
        {role:'assistant',content:null,tool_calls:[{id:'legacy-call',type:'function',function:{name:'read_status',arguments:'{}'}}]}
      ];
      sessionRecords.commit('legacy-session',[
        {table:'ai_sessions',key:'legacy-session',value:{id:'legacy-session',user_id:'legacy-owner',app_id:'writing',title:'旧会话',archived:0,created_at:time,updated_at:time,workspace_project_id:'legacy-project',workspace_node_id:null,workspace_directory:'H:/projects/writing',workspace_title:'旧项目'}},
        {table:'ai_messages',key:'legacy-user',value:{id:'legacy-user',session_id:'legacy-session',_order:1,role:'user',content:'旧输入',status:'complete',created_at:time,activity_json:'[]'}},
        {table:'ai_messages',key:'legacy-assistant',value:{id:'legacy-assistant',session_id:'legacy-session',_order:2,role:'assistant',content:'部分回复',status:'interrupted',created_at:time,activity_json:'[]',model_history:modelHistory}},
        {table:'ai_usage',key:'legacy-usage',value:{id:'legacy-usage',user_id:'legacy-owner',session_id:'legacy-session',message_id:'legacy-assistant',provider_id:'provider-a',model_id:'model-a',prompt_tokens:7,completion_tokens:4,created_at:time}}
      ]);
      const original=sessionRecords.allForSession('ai_messages','legacy-session');
      assert.equal(sessions.getAiSession('legacy-owner','legacy-session').projectId,'legacy-project');
      const visible=sessions.getAiSessionMessages('legacy-owner','legacy-session');
      assert.deepEqual(visible.map(message=>message.content),['旧输入','部分回复']);
      const once=sessionRecords.allForSession('session_events','legacy-session');
      assert.equal(once.some(event=>event.type==='tool/call'&&event.data.callId==='legacy-call'),true);
      assert.equal(once.find(event=>event.type==='tool/result').data.executionState,'unconfirmed');
      assert.equal(once.find(event=>event.type==='usage/record').data.promptTokens,7);
      sessions.getAiSessionMessages('legacy-owner','legacy-session');
      const twice=sessionRecords.allForSession('session_events','legacy-session');
      assert.equal(twice.length,once.length);
      assert.deepEqual(sessionRecords.allForSession('ai_messages','legacy-session'),original);
      assert.equal(sessions.getAiSessionMessages('legacy-other','legacy-session'),null);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-legacy-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("回答反馈由 Session Owner 持久化，分支只继承所选完整回答的上下文前缀", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-message-actions-"));
  try {
    run(data, `${setup}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('feedback-owner',5,'feedback-owner','salt','hash','admin',1),('feedback-other',6,'feedback-other','salt','hash','member',0)").run();
      const first=sessions.createAiTurn('feedback-owner','writing',null,'第一个问题');
      sessions.finishAiAssistantMessage('feedback-owner',first.session.id,first.assistantMessage.id,'第一个完整回答','complete');
      const submitted=sessions.submitAiMessageFeedback('feedback-owner',first.session.id,first.assistantMessage.id,{rating:'positive',reasons:['解决了我的问题'],detail:'说明清楚'});
      assert.equal(submitted.rating,'positive');
      assert.deepEqual(submitted.reasons,['解决了我的问题']);
      assert.equal(sessions.submitAiMessageFeedback('feedback-owner',first.session.id,first.assistantMessage.id,{rating:'negative',reasons:['回答不够准确'],detail:''}).rating,'positive');
      assert.equal(sessions.submitAiMessageFeedback('feedback-other',first.session.id,first.assistantMessage.id,{rating:'positive',reasons:['快速高效'],detail:''}),null);
      const second=sessions.createAiTurn('feedback-owner','writing',first.session.id,'第二个问题');
      assert.equal(sessions.forkAiSessionFromMessage('feedback-owner',first.session.id,second.assistantMessage.id),null);
      const branch=sessions.forkAiSessionFromMessage('feedback-owner',first.session.id,first.assistantMessage.id);
      assert.ok(branch);
      assert.equal(branch.appId,'writing');
      assert.deepEqual(sessions.getAiSessionMessages('feedback-owner',branch.id).map(message=>message.content),['第一个问题','第一个完整回答']);
      assert.equal(sessions.getAiSessionMessages('feedback-owner',branch.id).at(-1).feedback,undefined);
      assert.equal(sessions.getAiSessionMessages('feedback-owner',first.session.id).at(-3).feedback.rating,'positive');
      const feedbackEvents=sessionRecords.allForSession('session_events',first.session.id).filter(event=>event.type==='message/feedback');
      assert.equal(feedbackEvents.length,1);
      assert.equal(sessions.forkAiSessionFromMessage('feedback-other',first.session.id,first.assistantMessage.id),null);
      const sourceProject={id:'minecraft-source',appId:'minecraft',nodeId:'daemon-a',path:'H:/projects/source',title:'源项目'};
      const sourceTurn=sessions.createAiTurn('feedback-owner','minecraft',null,'工作树分支上下文');
      sessions.finishAiAssistantMessage('feedback-owner',sourceTurn.session.id,sourceTurn.assistantMessage.id,'继续在隔离工作树中处理','complete');
      assert.equal(sessions.setAiSessionProject('feedback-owner',sourceTurn.session.id,sourceProject).projectId,sourceProject.id);
      const targetProject={id:'minecraft-worktree',appId:'minecraft',nodeId:'daemon-a',path:'H:/projects/source-worktree',title:'源项目 · AI Worktree'};
      const worktreeBranch=sessions.forkAiSessionFromMessage('feedback-owner',sourceTurn.session.id,sourceTurn.assistantMessage.id,targetProject);
      assert.equal(worktreeBranch.projectId,targetProject.id);
      assert.deepEqual(sessions.getAiSessionMessages('feedback-owner',worktreeBranch.id).map(message=>message.content),['工作树分支上下文','继续在隔离工作树中处理']);
      assert.equal(sessions.getAiSession('feedback-owner',sourceTurn.session.id).projectId,sourceProject.id);
      assert.deepEqual(sessions.getAiSessionWorkspaceContext('feedback-owner',worktreeBranch.id),targetProject);
      await sessions.flushAiSession('feedback-owner',first.session.id);
      await sessions.flushAiSession('feedback-owner',sourceTurn.session.id);
      close();
    `);
    run(data, `${setup}
      const source=sessionRecords.all('ai_sessions',row=>row.user_id==='feedback-owner'&&row.title==='第一个问题').find(row=>!row.archived);
      assert.ok(source);
      const messages=sessions.getAiSessionMessages('feedback-owner',source.id);
      assert.equal(messages.at(-3).feedback.rating,'positive');
      assert.equal(messages.at(-3).feedback.detail,'说明清楚');
      assert.equal(sessionRecords.allForSession('session_events',source.id).filter(event=>event.type==='message/feedback').length,1);
      const worktreeBranch=sessionRecords.all('ai_sessions',row=>row.user_id==='feedback-owner'&&row.workspace_project_id==='minecraft-worktree').find(row=>row.title==='工作树分支上下文（分支）');
      assert.ok(worktreeBranch);
      assert.deepEqual(sessions.getAiSessionWorkspaceContext('feedback-owner',worktreeBranch.id),{id:'minecraft-worktree',appId:'minecraft',nodeId:'daemon-a',path:'H:/projects/source-worktree',title:'源项目 · AI Worktree'});
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-message-actions-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("活动 AI Work 会话可创建侧聊快照，保留已记录上下文且不改变主任务", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-side-chat-"));
  try {
    run(data, `${setup}
      const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('side-owner',21,'side-owner','salt','hash','admin',1),('side-other',22,'side-other','salt','hash','member',0)").run();
      const source=sessions.createAiTurn('side-owner','workspace',null,'先分析项目');
      sessions.finishAiAssistantMessage('side-owner',source.session.id,source.assistantMessage.id,'已记录的完整回答','complete');
      const active=sessions.createAiTurn('side-owner','workspace',source.session.id,'当前正在执行的任务');
      sessions.recordAiModelResponse('side-owner',source.session.id,active.assistantMessage.id,'部分生成内容',[],['尚未完成的流式片段']);
      const sourceEventsBefore=sessionRecords.allForSession('session_events',source.session.id);
      const side=sessions.forkAiSessionForSideChat('side-owner',source.session.id);
      assert.ok(side);
      assert.equal(side.appId,'workspace');
      assert.match(side.title,/^侧边聊天/);
      assert.equal(sessions.getAiSideChatParentSessionId('side-owner',side.id),source.session.id);
      assert.equal(sessions.getAiSideChatParentSessionId('side-other',side.id),null);
      assert.equal(sessions.forkAiSessionForSideChat('side-other',source.session.id),null);
      const sideEvents=sessionRecords.allForSession('session_events',side.id);
      const marker=sideEvents.find(event=>event.type==='session/side-chat');
      assert.equal(marker.data.parentSessionId,source.session.id);
      assert.equal(marker.data.snapshotSeq,sourceEventsBefore.length);
      assert.equal(sessionRecords.allForSession('session_events',source.session.id).some(event=>event.type==='session/side-chat'),false);
      assert.deepEqual(sessions.getAiSessionMessages('side-owner',side.id).map(message=>message.content),['先分析项目','已记录的完整回答','当前正在执行的任务']);
      assert.equal(sessions.getAiSessionMessages('side-owner',side.id).some(message=>message.content.includes('部分生成内容')),false);
      assert.equal(sessions.getAiSessionMessages('side-owner',source.session.id).at(-1).status,'streaming');
      assert.equal(sessions.forkAiSessionForSideChat('side-owner',side.id),null);
      const sideTurn=sessions.createAiTurn('side-owner','workspace',side.id,'解释当前任务');
      sessions.finishAiAssistantMessage('side-owner',side.id,sideTurn.assistantMessage.id,'这是独立的解释回答','complete');
      assert.equal(sessions.getAiSessionMessages('side-owner',source.session.id).at(-1).status,'streaming');
      sessions.finishAiAssistantMessage('side-owner',source.session.id,active.assistantMessage.id,'主任务完成','complete');
      assert.equal(sessions.getAiSessionMessages('side-owner',side.id).at(-1).content,'这是独立的解释回答');
      await sessions.flushAiSession('side-owner',source.session.id);
      await sessions.flushAiSession('side-owner',side.id);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-side-chat-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("编辑用户问题只从该轮之前分支，拒绝活动运行和 run 内引导消息", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-edit-message-"));
  try {
    run(data, `${setup}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('edit-owner',7,'edit-owner','salt','hash','admin',1),('edit-other',8,'edit-other','salt','hash','member',0)").run();
      const first=sessions.createAiTurn('edit-owner','writing',null,'第一个问题');
      sessions.finishAiAssistantMessage('edit-owner',first.session.id,first.assistantMessage.id,'第一个完整回答','complete');
      const second=sessions.createAiTurn('edit-owner','writing',first.session.id,'需要改写的问题');
      assert.throws(()=>sessions.forkAiSessionBeforeUserMessage('edit-owner',first.session.id,second.userMessage.id),/活动任务/);
      sessions.finishAiAssistantMessage('edit-owner',first.session.id,second.assistantMessage.id,'旧回复','interrupted');
      const sourceBefore=sessions.getAiSessionMessages('edit-owner',first.session.id).map(message=>message.content);
      const editedBranch=sessions.forkAiSessionBeforeUserMessage('edit-owner',first.session.id,second.userMessage.id);
      assert.ok(editedBranch);
      assert.equal(editedBranch.appId,'writing');
      assert.deepEqual(sessions.getAiSessionMessages('edit-owner',editedBranch.id).map(message=>message.content),['第一个问题','第一个完整回答']);
      assert.deepEqual(sessions.getAiSessionMessages('edit-owner',first.session.id).map(message=>message.content),sourceBefore);
      assert.equal(sessions.forkAiSessionBeforeUserMessage('edit-other',first.session.id,second.userMessage.id),null);
      assert.equal(sessions.forkAiSessionBeforeUserMessage('edit-owner',first.session.id,'00000000-0000-4000-8000-000000000001'),null);

      const third=sessions.createAiTurn('edit-owner','writing',first.session.id,'第三个问题');
      const steering=sessions.appendAiSteeringInput('edit-owner',third.assistantMessage.id,'补充引导');
      sessions.finishAiAssistantMessage('edit-owner',first.session.id,third.assistantMessage.id,'第三个回答','complete');
      assert.equal(sessions.forkAiSessionBeforeUserMessage('edit-owner',first.session.id,steering.id),null);

      const projectTurn=sessions.createAiTurn('edit-owner','minecraft',null,'保留项目上下文');
      sessions.finishAiAssistantMessage('edit-owner',projectTurn.session.id,projectTurn.assistantMessage.id,'已完成项目上下文','complete');
      const project={id:'edit-project',appId:'minecraft',nodeId:'daemon-edit',path:'H:/projects/edit',title:'编辑回归项目'};
      assert.equal(sessions.setAiSessionProject('edit-owner',projectTurn.session.id,project).projectId,project.id);
      const projectInput=sessions.createAiTurn('edit-owner','minecraft',projectTurn.session.id,'项目内待改问题');
      sessions.finishAiAssistantMessage('edit-owner',projectTurn.session.id,projectInput.assistantMessage.id,'项目内旧回复','interrupted');
      const projectBranch=sessions.forkAiSessionBeforeUserMessage('edit-owner',projectTurn.session.id,projectInput.userMessage.id);
      assert.equal(projectBranch.projectId,project.id);
      assert.equal(projectBranch.appId,'minecraft');
      assert.deepEqual(sessions.getAiSessionWorkspaceContext('edit-owner',projectBranch.id),project);
      await sessions.flushAiSession('edit-owner',first.session.id);
      await sessions.flushAiSession('edit-owner',editedBranch.id);
      await sessions.flushAiSession('edit-owner',projectTurn.session.id);
      await sessions.flushAiSession('edit-owner',projectBranch.id);
      close();
    `);
    run(data, `${setup}
      const branch=sessionRecords.all('ai_sessions',row=>row.user_id==='edit-owner'&&row.title==='第一个问题（分支）').find(row=>!row.archived);
      assert.ok(branch);
      assert.deepEqual(sessions.getAiSessionMessages('edit-owner',branch.id).map(message=>message.content),['第一个问题','第一个完整回答']);
      const projectBranch=sessionRecords.all('ai_sessions',row=>row.user_id==='edit-owner'&&row.workspace_project_id==='edit-project').find(row=>!row.archived);
      assert.ok(projectBranch);
      assert.deepEqual(sessions.getAiSessionWorkspaceContext('edit-owner',projectBranch.id),{id:'edit-project',appId:'minecraft',nodeId:'daemon-edit',path:'H:/projects/edit',title:'编辑回归项目'});
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-edit-message-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("计划模式由 Session JSONL 持久化、按账户隔离并随分支恢复", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-plan-mode-"));
  try {
    const output=run(data, `${setup}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('plan-owner',31,'plan-owner','salt','hash','admin',1),('plan-other',32,'plan-other','salt','hash','member',0)").run();
      const {aiChatMessageSchema,aiSessionPlanModeSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
      assert.equal(aiChatMessageSchema.validate({appId:'writing',sessionId:null,content:'计划目标',planMode:true}).error,undefined);
      assert.ok(aiChatMessageSchema.validate({appId:'writing',sessionId:null,content:'计划目标',planMode:[]}).error);
      assert.equal(aiSessionPlanModeSchema.validate({active:false}).error,undefined);
      const active=sessions.createAiTurn('plan-owner','writing',null,'先整理方案');
      assert.throws(()=>sessions.setAiSessionPlanMode('plan-owner',active.session.id,true),/活动任务/);
      sessions.finishAiAssistantMessage('plan-owner',active.session.id,active.assistantMessage.id,'先整理方案','complete');
      const enabled=sessions.setAiSessionPlanMode('plan-owner',active.session.id,true);
      assert.equal(enabled.planMode,true);
      assert.equal(sessions.getAiSessionPlanMode('plan-owner',active.session.id),true);
      assert.equal(sessions.getAiSessionPlanMode('plan-other',active.session.id),false);
      assert.equal(sessions.setAiSessionPlanMode('plan-other',active.session.id,false),null);
      const next=sessions.createAiTurn('plan-owner','writing',active.session.id,'补充方案约束');
      sessions.finishAiAssistantMessage('plan-owner',active.session.id,next.assistantMessage.id,'已补充','complete');
      const branch=sessions.forkAiSessionFromMessage('plan-owner',active.session.id,next.assistantMessage.id);
      assert.equal(branch.planMode,true);
      const side=sessions.forkAiSessionForSideChat('plan-owner',active.session.id);
      assert.ok(side);
      assert.equal(sessions.setAiSessionPlanMode('plan-owner',side.id,false),null);
      const events=sessionRecords.allForSession('session_events',active.session.id).filter(event=>event.type==='session/plan-mode');
      assert.deepEqual(events.map(event=>event.data.active),[true]);
      assert.equal(sessions.setAiSessionArchived('plan-owner',active.session.id,true).archived,true);
      assert.equal(sessions.setAiSessionPlanMode('plan-owner',active.session.id,false),null);
      await sessions.flushAiSession('plan-owner',active.session.id);
      await sessions.flushAiSession('plan-owner',branch.id);
      await sessions.flushAiSession('plan-owner',side.id);
      console.log(JSON.stringify({sessionId:active.session.id,branchId:branch.id}));
      close();
    `);
    run(data, `${setup}
      const ids=${JSON.stringify(JSON.parse(output))};
      assert.equal(sessions.getAiSession('plan-owner',ids.sessionId).planMode,true);
      const branch=sessionRecords.all('ai_sessions',row=>row.user_id==='plan-owner'&&row.id===ids.branchId)[0];
      assert.ok(branch);
      assert.equal(sessions.getAiSession('plan-owner',branch.id).planMode,true);
      assert.equal(sessions.getAiSession('plan-other',ids.sessionId),null);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-plan-mode-"));
    rmSync(data, { recursive: true, force: true });
  }
});
