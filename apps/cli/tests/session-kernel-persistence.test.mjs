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
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_HOME: join(dataDirectory, "home"), LFAA_DATA_DIR: join(dataDirectory, "business-data"), JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe"
  });
}
const setup = `
  const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
  const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
  const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
  const sessions=await import('lfaa-session/src/sessions.js');
  const close=()=>{configuration.close();sessionRecords.close();closeDatabase();};
`;

test("图片附件引用经近期缓存、历史分页和进程重启保持一致", () => {
  const parent = resolve(cli, "../../dist/.tmp"); mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-attachments-"));
  try {
    const output = run(data, `${setup}
      import assert from 'node:assert/strict';
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('image-owner','image-owner','salt','hash','admin')").run();
      const refs=[{id:'11111111-1111-4111-8111-111111111111',name:'测试图片.png'}];
      let id=null;
      for(let i=0;i<60;i++){
        const turn=sessions.createAiTurn('image-owner','workspace',id,'图片 '+i,false,null,undefined,refs);
        id=turn.session.id;
        assert.deepEqual(turn.userMessage.attachments,refs);
        sessions.finishAiAssistantMessage('image-owner',id,turn.assistantMessage.id,'收到','complete');
      }
      const page=await sessions.getAiSessionMessagesPage('image-owner',id,undefined,50);
      assert.deepEqual(page.messages.find(m=>m.role==='user').attachments,refs);
      console.log(JSON.stringify({id}));close();
    `);
    run(data, `${setup}
      import assert from 'node:assert/strict';
      const {id}=${output.trim()};
      const refs=[{id:'11111111-1111-4111-8111-111111111111',name:'测试图片.png'}];
      const first=await sessions.getAiSessionMessagesPage('image-owner',id,undefined,50);
      const older=await sessions.getAiSessionMessagesPage('image-owner',id,first.nextCursor,50);
      for(const page of [first,older]) for(const message of page.messages.filter(m=>m.role==='user')) assert.deepEqual(message.attachments,refs);
      for(const message of sessions.getAiSessionMessages('image-owner',id).filter(m=>m.role==='user')) assert.deepEqual(message.attachments,refs);
      assert.equal(await sessions.getAiSessionMessagesPage('another-owner',id,undefined,50),null);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith('lfaa-session-attachments-'));
    rmSync(data, { recursive: true, force: true });
  }
});

test("正文分段和审批记录经 JSONL 重启与分页保留，非法范围拒绝", () => {
  const parent = resolve(cli, "../../dist/.tmp"); mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-response-parts-"));
  try {
    const output = run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('parts-owner','parts-owner','salt','hash','admin')").run();
      const turn=sessions.createAiTurn('parts-owner','workspace',null,'检查分段');
      const parts=[{id:'first',start:0,end:2,kind:'commentary'},{id:'last',start:2,end:4,kind:'final'}];
      assert.throws(()=>sessions.finishAiAssistantMessage('parts-owner',turn.session.id,turn.assistantMessage.id,'阶段结果','complete',[{id:'bad',start:0,end:9,kind:'final'}]),/分段无效/);
      sessions.recordAiSessionRequest('parts-owner',turn.session.id,turn.assistantMessage.id,{providerId:'fixture-provider',modelId:'fixture-model',permissionMode:'ask',settings:{maxTokens:null},tools:[]},[{role:'system',content:'测试系统提示词'},{role:'user',content:'检查分段'}],{providerId:'fixture-provider',modelId:'fixture-model',contextWindow:64000,contextWindowSource:'model-catalog',promptTokens:null,estimatedPromptTokens:80,systemTokens:20,toolsTokens:0,messageTokens:60,includesImages:false});
      sessions.recordAiModelResponse('parts-owner',turn.session.id,turn.assistantMessage.id,'阶段结果',[],['阶段结果'],{promptTokens:120,completionTokens:18});
      sessions.saveAiAssistantActivity('parts-owner',turn.session.id,turn.assistantMessage.id,[{id:'approval',kind:'command',title:'真实审批',detail:'执行完成',status:'complete',startedAt:turn.assistantMessage.createdAt,completedAt:turn.assistantMessage.createdAt,durationMs:0,contentOffset:2,approvalId:'approval-id',approvalQuestion:'允许执行本次操作吗？',approvalAnswer:'approved'}]);
      sessions.finishAiAssistantMessage('parts-owner',turn.session.id,turn.assistantMessage.id,'阶段结果','complete',parts);
      sessions.recordAiUsage('parts-owner',turn.session.id,turn.assistantMessage.id,'fixture-provider','fixture-model',120,18,96);
      assert.deepEqual(sessions.getAiSessionMessages('parts-owner',turn.session.id).at(-1).parts,parts);
      assert.deepEqual(sessions.getAiSessionMessages('parts-owner',turn.session.id).at(-1).usage,{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:120,completionTokens:18,cacheReadTokens:96});
      console.log(JSON.stringify({id:turn.session.id}));close();
    `);
    run(data, `${setup}
      const ids=${JSON.stringify(JSON.parse(output))};
      for(const id of [ids.id]){
        const page=await sessions.getAiSessionMessagesPage('parts-owner',id,undefined,100);
        const reply=page.messages.at(-1);
        assert.deepEqual(reply.parts.map(part=>part.kind),['commentary','final']);
        assert.deepEqual(reply.usage,{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:120,completionTokens:18,cacheReadTokens:96});
        assert.deepEqual(page.usageSummary,{requestCount:1,requestCountExact:false,promptTokens:120,completionTokens:18,cacheReadTokens:96,models:[{providerId:'fixture-provider',modelId:'fixture-model',requestCount:1,requestCountExact:false,promptTokens:120,completionTokens:18,cacheReadTokens:96,cacheReadReportedTokens:null,cacheReadReportedRequestCount:null}]});
        assert.deepEqual(page.contextUsage,{providerId:'fixture-provider',modelId:'fixture-model',contextWindow:64000,contextWindowSource:'model-catalog',promptTokens:120,estimatedPromptTokens:80,systemTokens:20,toolsTokens:0,messageTokens:60,includesImages:false});
        assert.equal(reply.activity[0].contentOffset,2);assert.equal(reply.activity[0].approvalAnswer,'approved');
        assert.equal(await sessions.getAiSessionMessagesPage('other-owner',id,undefined),null);
      }close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent); assert.ok(basename(data).startsWith("lfaa-session-response-parts-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("私有 Provider 续接协议经 JSONL 重启恢复，消息、查询与导出始终只返回公开字段", () => {
  const parent = resolve(cli, '../../dist/.tmp');
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, 'lfaa-session-provider-replay-'));
  try {
    const output = run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('replay-owner','replay-owner','salt','hash','admin')").run();
      const turn=sessions.createAiTurn('replay-owner','workspace',null,'合成首问');
      const replay={accountId:'fixture-account',providerId:'fixture-provider',modelId:'fixture-model',reasoningContent:'private-durable-replay'};
      sessions.recordAiModelResponse('replay-owner',turn.session.id,turn.assistantMessage.id,'公开回答',[],['公开回答'],undefined,replay);
      sessions.saveAiModelHistory('replay-owner',turn.session.id,turn.assistantMessage.id,[{role:'assistant',content:'公开回答',providerReplay:replay}]);
      sessions.finishAiAssistantMessage('replay-owner',turn.session.id,turn.assistantMessage.id,'公开回答','complete');
      console.log(JSON.stringify({sessionId:turn.session.id}));close();
    `);
    run(data, `${setup}
      const {exportSessionLog}=await import('lfaa-session-log-export');
      const ids=${JSON.stringify(JSON.parse(output))};
      const turn=sessions.createAiTurn('replay-owner','workspace',ids.sessionId,'合成后续问题');
      assert.equal(turn.history.find(message=>message.role==='assistant').providerReplay.reasoningContent,'private-durable-replay');
      const page=await sessions.getAiSessionMessagesPage('replay-owner',ids.sessionId,undefined,100);
      assert.ok(page.messages.length>=3);
      const events=await sessions.getAiQueryEventsPage('replay-owner',ids.sessionId,ids.sessionId,{after:0,limit:100});
      const exported=exportSessionLog({header:sessions.getAiSession('replay-owner',ids.sessionId),messages:page.messages});
      assert.doesNotMatch(JSON.stringify([page,events,exported]),/private-durable-replay|providerReplay/u);
      assert.throws(()=>sessions.recordAiModelResponse('replay-owner',ids.sessionId,turn.assistantMessage.id,'',[],undefined,undefined,{accountId:'fixture-account',providerId:'fixture-provider',modelId:123,reasoningContent:'invalid'}),/载荷无效/u);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    rmSync(data, { recursive: true, force: true });
  }
});

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
      const failedTurn=sessions.createAiTurn('kernel-owner','writing',null,'Provider 失败终态');
      sessions.recordAiModelResponse('kernel-owner',failedTurn.session.id,failedTurn.assistantMessage.id,'部分输出',[
        {id:'failed-dispatched',name:'local_execute_command',arguments:'{}'},
        {id:'failed-not-started',name:'host_execute_command',arguments:'{}'}
      ]);
      sessions.recordAiToolCall('kernel-owner',failedTurn.session.id,failedTurn.assistantMessage.id,'failed-dispatched','local_execute_command','{}',true);
      sessions.recordAiToolCall('kernel-owner',failedTurn.session.id,failedTurn.assistantMessage.id,'failed-not-started','host_execute_command','{}',false);
      sessions.finishAiAssistantMessage('kernel-owner',failedTurn.session.id,failedTurn.assistantMessage.id,'部分输出（失败）','error');
      const failedEvents=sessionRecords.allForSession('session_events',failedTurn.session.id);
      assert.equal(failedEvents.at(-1).type,'turn/end');
      assert.equal(failedEvents.at(-1).data.status,'error');
      assert.deepEqual(failedEvents.filter(event=>event.type==='tool/result').map(event=>event.data.executionState),['unconfirmed','not_started']);
      assert.equal(sessions.getAiSessionMessages('kernel-owner',failedTurn.session.id).at(-1).status,'error');
      await sessions.flushAiSession('kernel-owner',turn.session.id);
      await sessions.flushAiSession('kernel-owner',failedTurn.session.id);
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

test("进程恢复会关闭未完成的活动卡片并持久化真实中断状态", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-interrupted-activity-"));
  try {
    const output = run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('activity-owner','activity-owner','salt','hash','admin')").run();
      const turn=sessions.createAiTurn('activity-owner','workspace',null,'恢复中断的 Agent 运行');
      const startedAt='2026-10-25T00:00:00.000Z';
      sessions.recordAiModelResponse('activity-owner',turn.session.id,turn.assistantMessage.id,'检查中断状态',[
        {id:'call-dispatched',name:'local_execute_command',arguments:'{}'},
        {id:'call-not-started',name:'host_execute_command',arguments:'{}'}
      ]);
      sessions.recordAiToolCall('activity-owner',turn.session.id,turn.assistantMessage.id,'call-dispatched','local_execute_command','{}',true);
      sessions.recordAiToolCall('activity-owner',turn.session.id,turn.assistantMessage.id,'call-not-started','host_execute_command','{}',false);
      sessions.saveAiAssistantActivity('activity-owner',turn.session.id,turn.assistantMessage.id,[
        {id:'running-tool',kind:'tool',title:'调用 LFAA 工具',status:'running',detail:'参数校验通过；将按当前权限模式执行。',startedAt,completedAt:null,durationMs:null},
        {id:'pending-approval',kind:'command',title:'等待审批',status:'approval_required',detail:'审批尚未完成。',startedAt,completedAt:null,durationMs:null,approvalId:'approval-fixture'},
        {id:'pending-question',kind:'question',title:'等待补充信息',status:'waiting_input',detail:'问题尚未回答。',startedAt,completedAt:null,durationMs:null,questionId:'question-fixture',question:'选择目标？',options:['A','B']},
        {id:'finished',kind:'status',title:'已完成阶段',status:'complete',detail:'已完成。',startedAt,completedAt:startedAt,durationMs:0}
      ]);
      console.log(JSON.stringify({sessionId:turn.session.id}));close();
    `);
    const { sessionId } = JSON.parse(output);
    run(data, `${setup}
      const sessionId=${JSON.stringify(sessionId)};
      const reply=sessions.getAiSessionMessages('activity-owner',sessionId).at(-1);
      assert.equal(reply.status,'interrupted');
      assert.deepEqual(reply.activity.map(item=>item.status),['unavailable','unavailable','unavailable','complete']);
      assert.ok(reply.activity.slice(0,3).every(item=>item.completedAt && Number.isFinite(item.durationMs)));
      assert.match(reply.activity[0].detail,/结果未确认|未确认/u);
      assert.match(reply.activity[1].detail,/未批准|中断/u);
      assert.match(reply.activity[2].detail,/中断|重新发起/u);
      const events=sessionRecords.allForSession('session_events',sessionId);
      const resultByCall=new Map(events.filter(event=>event.type==='tool/result').map(event=>[event.data.callId,event.data]));
      assert.equal(resultByCall.get('call-dispatched').executionState,'unconfirmed');
      assert.equal(resultByCall.get('call-dispatched').repaired,true);
      assert.equal(resultByCall.get('call-not-started').executionState,'not_started');
      assert.equal(resultByCall.get('call-not-started').repaired,true);
      assert.equal(events.at(-1).type,'turn/end');
      assert.equal(events.at(-1).data.status,'interrupted');
      const count=events.length;
      assert.equal(sessions.getAiSessionMessages('activity-owner',sessionId).at(-1).status,'interrupted');
      assert.equal(sessionRecords.allForSession('session_events',sessionId).length,count);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-interrupted-activity-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("已闭合的中断事件仍会修复旧消息投影中的运行卡片", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-stale-interruption-projection-"));
  try {
    const output = run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('projection-owner','projection-owner','salt','hash','admin')").run();
      const turn=sessions.createAiTurn('projection-owner','workspace',null,'恢复已修复过的中断运行');
      const startedAt='2026-10-25T00:00:00.000Z';
      sessions.recordAiModelResponse('projection-owner',turn.session.id,turn.assistantMessage.id,'检查中断状态',[{id:'call-already-repaired',name:'lfaa_terminal',arguments:'{}'}]);
      sessions.recordAiToolCall('projection-owner',turn.session.id,turn.assistantMessage.id,'call-already-repaired','lfaa_terminal','{}',true);
      sessions.saveAiAssistantActivity('projection-owner',turn.session.id,turn.assistantMessage.id,[
        {id:'running-tool',kind:'tool',title:'调用 LFAA 工具',status:'running',detail:'工具派发后未收到结果。',startedAt,completedAt:null,durationMs:null}
      ]);
      sessions.appendAiSessionEvents('projection-owner',turn.session.id,[
        {type:'assistant/message',data:{messageId:turn.assistantMessage.id,content:'',status:'interrupted',runId:turn.assistantMessage.id}},
        {type:'tool/result',data:{runId:turn.assistantMessage.id,callId:'call-already-repaired',content:'工具结果未确认。',isError:true,executionState:'unconfirmed',repaired:true}},
        {type:'turn/end',data:{turnId:turn.assistantMessage.id,status:'interrupted'}}
      ]);
      console.log(JSON.stringify({sessionId:turn.session.id}));close();
    `);
    const { sessionId } = JSON.parse(output);
    run(data, `${setup}
      const sessionId=${JSON.stringify(sessionId)};
      const before=sessionRecords.allForSession('session_events',sessionId);
      assert.equal(before.at(-1).type,'turn/end');
      assert.equal(before.at(-1).data.status,'interrupted');
      const reply=sessions.getAiSessionMessages('projection-owner',sessionId).at(-1);
      assert.equal(reply.status,'interrupted');
      assert.equal(reply.activity[0].status,'unavailable');
      assert.ok(reply.activity[0].completedAt);
      const after=sessionRecords.allForSession('session_events',sessionId);
      assert.equal(after.filter(event=>event.type==='tool/result').length,1);
      assert.equal(after.filter(event=>event.type==='turn/end').length,1);
      assert.equal(after.at(-1).type,'activity/change');
      assert.equal(after.at(-1).data.activity[0].status,'unavailable');
      const count=after.length;
      sessions.getAiSessionMessages('projection-owner',sessionId);
      assert.equal(sessionRecords.allForSession('session_events',sessionId).length,count);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-stale-interruption-projection-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("Session 活动持久化有界文件路径并拒绝不安全的变更路径", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-file-activity-"));
  try {
    run(data, `${setup}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('file-owner',20,'file-owner','salt','hash','admin',1)").run();
      const turn=sessions.createAiTurn('file-owner','writing',null,'检查文件改动');
      const activity={id:'file-change',kind:'tool',title:'操作项目文件',status:'complete',detail:'已返回真实结果。',startedAt:'2026-10-10T00:00:00.000Z',completedAt:'2026-10-10T00:00:01.000Z',durationMs:1000,fileChanges:[{operation:'modified',path:'packages/core/example.ts',projectId:'project-file-owner'}]};
      sessions.saveAiAssistantActivity('file-owner',turn.session.id,turn.assistantMessage.id,[activity]);
      const visible=sessions.getAiSessionMessages('file-owner',turn.session.id).at(-1).activity;
      assert.deepEqual(visible[0].fileChanges,activity.fileChanges);
      const event=sessionRecords.allForSession('session_events',turn.session.id).find(row=>row.type==='activity/change');
      assert.deepEqual(event.data.activity[0].fileChanges,activity.fileChanges);
      assert.doesNotMatch(JSON.stringify(visible),/file contents|oldText|newText/u);
      sessions.saveAiAssistantActivity('file-owner',turn.session.id,turn.assistantMessage.id,[{...activity,fileChanges:[{operation:'modified',path:'../outside.txt',projectId:'project-file-owner'}]}]);
      assert.deepEqual(sessions.getAiSessionMessages('file-owner',turn.session.id).at(-1).activity,[]);
      await sessions.flushAiSession('file-owner',turn.session.id);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-file-activity-"));
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

test("回答反馈由 Session Owner 持久化，Worktree 记忆分支绑定已校验项目", () => {
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
      assert.equal(sessions.getAiSessionMessages('feedback-owner',first.session.id).at(-1).feedback.rating,'positive');
      const feedbackEvents=sessionRecords.allForSession('session_events',first.session.id).filter(event=>event.type==='message/feedback');
      assert.equal(feedbackEvents.length,1);
      const sourceProject={id:'minecraft-source',appId:'minecraft',nodeId:'daemon-a',path:'H:/projects/source',title:'源项目'};
      const sourceTurn=sessions.createAiTurn('feedback-owner','minecraft',null,'工作树分支上下文');
      sessions.finishAiAssistantMessage('feedback-owner',sourceTurn.session.id,sourceTurn.assistantMessage.id,'继续在隔离工作树中处理','complete');
      assert.equal(sessions.setAiSessionProject('feedback-owner',sourceTurn.session.id,sourceProject).projectId,sourceProject.id);
      const targetProject={id:'minecraft-worktree',appId:'minecraft',nodeId:'daemon-a',path:'H:/projects/source-worktree',title:'源项目 · AI Worktree'};
      const worktreeSeed=sessions.prepareAiSessionBranchSeed('feedback-owner',sourceTurn.session.id,sourceTurn.assistantMessage.id,200000);
      const worktreeBranch=sessions.createAiSessionBranchWithMemory('feedback-owner',worktreeSeed,'工作树分支记忆',[{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:9,completionTokens:4}],targetProject);
      assert.equal(worktreeBranch.projectId,targetProject.id);
      assert.deepEqual(sessions.getAiSessionMessages('feedback-owner',worktreeBranch.id),[]);
      assert.equal(sessions.getAiSession('feedback-owner',sourceTurn.session.id).projectId,sourceProject.id);
      assert.deepEqual(sessions.getAiSessionWorkspaceContext('feedback-owner',worktreeBranch.id),targetProject);
      await sessions.flushAiSession('feedback-owner',sourceTurn.session.id);
      close();
    `);
    run(data, `${setup}
      const source=sessionRecords.all('ai_sessions',row=>row.user_id==='feedback-owner'&&row.title==='第一个问题').find(row=>!row.archived);
      assert.ok(source);
      const messages=sessions.getAiSessionMessages('feedback-owner',source.id);
      assert.equal(messages.at(-1).feedback.rating,'positive');
      assert.equal(messages.at(-1).feedback.detail,'说明清楚');
      assert.equal(sessionRecords.allForSession('session_events',source.id).filter(event=>event.type==='message/feedback').length,1);
      const worktreeBranch=sessionRecords.all('ai_sessions',row=>row.user_id==='feedback-owner'&&row.workspace_project_id==='minecraft-worktree').find(row=>row.title==='工作树分支上下文（记忆分支）');
      assert.ok(worktreeBranch);
      assert.deepEqual(sessions.getAiSessionMessages('feedback-owner',worktreeBranch.id),[]);
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
      const source=sessionRecords.all('ai_sessions',row=>row.user_id==='edit-owner'&&row.app_id==='writing'&&row.title==='第一个问题')[0];
      assert.ok(source);
      const branchPage=await sessions.getAiSessionMessagesPage('edit-owner',branch.id,undefined,50);
      assert.equal(branchPage.branchSource.session.id,source.id);
      assert.equal(branchPage.branchSource.session.title,'第一个问题');
      assert.equal(branchPage.branchSource.session.archived,false);
      assert.equal((await sessions.getAiSessionMessagesPage('edit-other',branch.id,undefined,50)),null);
      const nestedMessage=sessions.getAiSessionMessages('edit-owner',branch.id).at(-1);
      const nestedSeed=sessions.prepareAiSessionBranchSeed('edit-owner',branch.id,nestedMessage.id,200000);
      const nestedBranch=sessions.createAiSessionBranchWithMemory('edit-owner',nestedSeed,'嵌套的压缩记忆',[{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:8,completionTokens:3}]);
      assert.ok(nestedBranch);
      assert.deepEqual(sessions.getAiSessionMessages('edit-owner',nestedBranch.id),[]);
      const nestedPage=await sessions.getAiSessionMessagesPage('edit-owner',nestedBranch.id,undefined,50);
      assert.equal(nestedPage.branchSource.session.id,branch.id);
      const nestedEditBranch=sessions.forkAiSessionBeforeUserMessage('edit-owner',branch.id,sessions.getAiSessionMessages('edit-owner',branch.id)[0].id);
      assert.ok(nestedEditBranch);
      assert.deepEqual(sessions.getAiSessionMessages('edit-owner',nestedEditBranch.id),[]);
      const nestedEditPage=await sessions.getAiSessionMessagesPage('edit-owner',nestedEditBranch.id,undefined,50);
      assert.equal(nestedEditPage.branchSource.session.id,branch.id);
      const sourcePage=await sessions.getAiSessionMessagesPage('edit-owner',source.id,undefined,50);
      assert.equal(Object.hasOwn(sourcePage,'branchSource'),false);
      sessions.setAiSessionArchived('edit-owner',source.id,true);
      const archivedBranchPage=await sessions.getAiSessionMessagesPage('edit-owner',branch.id,undefined,50);
      assert.equal(archivedBranchPage.branchSource.title,'第一个问题');
      assert.equal(archivedBranchPage.branchSource.session.archived,true);
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
      const branchSeed=sessions.prepareAiSessionBranchSeed('plan-owner',active.session.id,next.assistantMessage.id,200000);
      const branch=sessions.createAiSessionBranchWithMemory('plan-owner',branchSeed,'计划模式记忆',[{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:10,completionTokens:4}]);
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

test("会话列表不恢复完整事件日志，已验证缓存支持历史翻页且失效后完整校验", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-history-performance-"));
  try {
    const output = run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('history-owner','history-owner','salt','hash','admin')").run();
      let turn=sessions.createAiTurn('history-owner','workspace',null,'问题 0');
      sessions.finishAiAssistantMessage('history-owner',turn.session.id,turn.assistantMessage.id,'答复 0','complete');
      const sessionId=turn.session.id;
      for(let index=1;index<56;index++){
        turn=sessions.createAiTurn('history-owner','workspace',sessionId,'问题 '+index);
        sessions.finishAiAssistantMessage('history-owner',sessionId,turn.assistantMessage.id,'答复 '+index,'complete');
      }
      sessions.setAiSessionAssociations('history-owner',sessionId,{applicationIds:['writing'],capabilityIds:['lfaa-skill:writing']});
      const earlierAssistant=sessionRecords.allForSession('ai_messages',sessionId).find(message=>message.content==='答复 30');
      sessions.recordAiUsage('history-owner',sessionId,earlierAssistant.id,'fixture-provider','fixture-model',60,10,24);
      sessions.submitAiMessageFeedback('history-owner',sessionId,earlierAssistant.id,{rating:'negative',reasons:['inaccurate'],detail:'历史页反馈'});
      sessions.submitAiMessageFeedback('history-owner',sessionId,turn.assistantMessage.id,{rating:'positive',reasons:[],detail:'回答清楚'});
      console.log(JSON.stringify({sessionId}));close();
    `);
    run(data, `${setup}
      const ids=${JSON.stringify(JSON.parse(output))};
      let fullEventReads=0, sessionReplays=0, pageReads=0;
      const originalAllForSession=sessionRecords.allForSession.bind(sessionRecords);
      const persistence=sessionRecords.persistence;
      const originalReadMessagePage=persistence.readMessagePage.bind(persistence);
      const originalReadSession=persistence.readSession.bind(persistence);
      sessionRecords.allForSession=(table,...args)=>{if(table==='session_events')fullEventReads++;return originalAllForSession(table,...args);};
      persistence.readMessagePage=(...args)=>{pageReads++;return originalReadMessagePage(...args);};
      persistence.readSession=(...args)=>{sessionReplays++;return originalReadSession(...args);};
      const listed=sessions.listAiSessions('history-owner',false,'workspace');
      assert.equal(fullEventReads,0);
      assert.equal(sessionReplays,0);
      assert.deepEqual(listed.find(row=>row.id===ids.sessionId).associations,{applicationIds:['writing'],capabilityIds:['lfaa-skill:writing']});
      const first=await sessions.getAiSessionMessagesPage('history-owner',ids.sessionId,undefined,50);
      assert.equal(pageReads,0);
      assert.equal(first.messages.length,50);
      assert.equal(first.messages[0].content,'问题 31');
      assert.equal(first.messages.at(-1).feedback.rating,'positive');
      const older=await sessions.getAiSessionMessagesPage('history-owner',ids.sessionId,first.nextCursor,50);
      assert.equal(pageReads,0,'完整恢复且修订指纹未变的会话不应为历史页重复扫描 JSONL');
      assert.equal(older.messages.length,50);
      assert.equal(older.messages.at(-1).content,'答复 30');
      assert.equal(older.messages.at(-1).feedback.rating,'negative');
      assert.deepEqual(older.messages.at(-1).usage,{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:60,completionTokens:10,cacheReadTokens:24});
      assert.equal(new Set([...first.messages,...older.messages].map(row=>row.id)).size,100);
      const originalIsCurrentRevision=persistence.isCurrentRevision.bind(persistence);
      persistence.isCurrentRevision=()=>false;
      const fallback=await sessions.getAiSessionMessagesPage('history-owner',ids.sessionId,undefined,50);
      assert.equal(pageReads,1,'修订失效后仍通过完整链扫描读取');
      assert.equal(fallback.messages[0].content,'问题 31');
      persistence.isCurrentRevision=originalIsCurrentRevision;
      const controller=new AbortController();controller.abort();
      await assert.rejects(sessions.getAiSessionMessagesPage('history-owner',ids.sessionId,older.nextCursor,50,controller.signal),error=>error.name==='AbortError');
      assert.equal(pageReads,1,'缓存路径响应预先取消时不应启动磁盘扫描');
      assert.equal(await sessions.getAiSessionMessagesPage('other-owner',ids.sessionId,undefined),null);
      // 先放入列表会返回的 200 个旧头，再超过旧 512 项投影上限；旧实现会对它们逐条读日志。
      const insertHeader=database.prepare("INSERT INTO ai_sessions(id,user_id,app_id,title,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
      for(let index=0;index<200;index++){
        const id='association-victim-'+index;
        const header={id,user_id:'history-owner',app_id:'workspace',title:'关联列表压力夹具',archived:0,created_at:'2026-10-15T00:00:00.000Z',updated_at:'2999-12-31T23:59:59.999Z'};
        sessionRecords.apply(id,[{table:'ai_sessions',key:id,value:header}]);
        insertHeader.run(id,header.user_id,header.app_id,header.title,header.archived,header.created_at,header.updated_at);
      }
      for(let index=0;index<520;index++){
        const id='association-pressure-'+index;
        sessionRecords.apply(id,[{table:'ai_sessions',key:id,value:{id,user_id:'history-owner',app_id:'minecraft',title:'关联压力夹具',archived:0,created_at:'2026-10-15T00:00:00.000Z',updated_at:'2026-10-15T00:00:00.000Z'}}]);
      }
      const pressuredList=sessions.listAiSessions('history-owner',false,'workspace');
      assert.equal(pressuredList.length,200);
      assert.ok(pressuredList.every(row=>row.associations.applicationIds.length===0&&row.associations.capabilityIds.length===0));
      assert.deepEqual(sessionRecords.associations(ids.sessionId),{applicationIds:['writing'],capabilityIds:['lfaa-skill:writing']});
      assert.equal(sessionReplays,0);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-history-performance-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("4,000 条历史消息的缓存翻页不重复读取 JSONL", { timeout: 30_000 }, t => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-cache-pages-performance-"));
  try {
    const script = `
      const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
      const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
      const {appendFileSync,mkdirSync,writeFileSync,statSync}=await import('node:fs');
      const {join}=await import('node:path');
      const {createHash}=await import('node:crypto');
      const {performance}=await import('node:perf_hooks');
      const {encode}=await import('lfaa-storage-json/src/index.js');
      const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('history-owner','history-owner','salt','hash','admin')").run();
      const sessionId='00000000-0000-4000-8000-000000000189';
      const directory=join(process.env.LFAA_HOME,'sessions',createHash('sha256').update(sessionId).digest('hex'));
      mkdirSync(directory,{recursive:true});
      const path=join(directory,'events.jsonl');
      const lines=[];let sequence=0;let previous='';
      const append=changes=>{
        sequence+=1;
        const content={format:1,sessionId,transaction:'fixture-'+sequence,changes,sequence,previous};
        const checksum=createHash('sha256').update(encode(content)).digest('hex');
        lines.push(encode({...content,checksum}).replace(/\\n\\s*/gu,'')+'\\n');
        previous=checksum;
      };
      const createdAt=new Date(Date.UTC(2026,0,1)).toISOString();
      append([{table:'ai_sessions',key:sessionId,value:{id:sessionId,user_id:'history-owner',app_id:'workspace',title:'四千条历史夹具',archived:0,created_at:createdAt,updated_at:createdAt}}]);
      for(let start=0;start<4000;start+=20){
        const changes=[];
        for(let index=start;index<Math.min(4000,start+20);index++){
          const id='message-'+index;
          changes.push({table:'ai_messages',key:id,value:{id,session_id:sessionId,user_id:'history-owner',role:index%2?'assistant':'user',content:'历史消息 '+index,status:'complete',created_at:new Date(Date.UTC(2026,0,1)+index*1000).toISOString(),_order:index,activity_json:'[]'}});
        }
        append(changes);
      }
      writeFileSync(path,lines.join(''),{encoding:'utf8',mode:0o600});
      const logBytes=statSync(path).size;
      sessionRecords.allForSession('ai_messages',sessionId);
      const sessions=await import('lfaa-session/src/sessions.js');
      let fullScans=0;
      const persistence=sessionRecords.persistence;
      const readPage=persistence.readMessagePage.bind(persistence);
      persistence.readMessagePage=(...args)=>{fullScans+=1;return readPage(...args);};
      const samples=[];let cursor;
      for(let pageIndex=0;pageIndex<20;pageIndex++){
        const started=performance.now();
        const page=await sessions.getAiSessionMessagesPage('history-owner',sessionId,cursor,50);
        samples.push(performance.now()-started);
        const expectedLast=3999-pageIndex*50;
        assert.equal(page.messages.length,50);
        assert.equal(page.messages[0].content,'历史消息 '+(expectedLast-49));
        assert.equal(page.messages.at(-1).content,'历史消息 '+expectedLast);
        assert.ok(page.nextCursor);
        cursor=page.nextCursor;
      }
      const sorted=[...samples].sort((left,right)=>left-right);
      const percentile=value=>sorted[Math.ceil(value*sorted.length)-1];
      assert.equal(fullScans,0,'完整校验后，缓存内的 20 页翻阅不得再次读取整个 JSONL');
      console.log(JSON.stringify({pageCount:samples.length,logBytes,fullScans,p50Ms:percentile(0.5),p95Ms:percentile(0.95),avoidedFullScanBytes:logBytes*samples.length}));
      for(let index=0;index<8;index++){
        const otherId='00000000-0000-4000-8000-00000000019'+index;
        const otherContent={format:1,sessionId:otherId,transaction:'fixture-1',sequence:1,previous:'',changes:[
          {table:'ai_sessions',key:otherId,value:{id:otherId,user_id:'history-owner',app_id:'workspace',title:'缓存淘汰夹具',archived:0,created_at:createdAt,updated_at:createdAt}},
          {table:'ai_messages',key:'message-'+otherId,value:{id:'message-'+otherId,session_id:otherId,user_id:'history-owner',role:'user',content:'淘汰夹具',status:'complete',created_at:createdAt,_order:0,activity_json:'[]'}}
        ]};
        const checksum=createHash('sha256').update(encode(otherContent)).digest('hex');
        const otherDirectory=join(process.env.LFAA_HOME,'sessions',createHash('sha256').update(otherId).digest('hex'));
        mkdirSync(otherDirectory,{recursive:true});
        writeFileSync(join(otherDirectory,'events.jsonl'),encode({...otherContent,checksum}).replace(/\\n\\s*/gu,'')+'\\n',{encoding:'utf8',mode:0o600});
        sessionRecords.allForSession('ai_messages',otherId);
      }
      const evictedPage=await sessions.getAiSessionMessagesPage('history-owner',sessionId,cursor,50);
      assert.equal(evictedPage.messages.length,50);
      assert.equal(evictedPage.messages.at(-1).content,'历史消息 2999');
      assert.equal(fullScans,1,'缓存淘汰后历史页仍完整扫描日志');
      appendFileSync(path,'{}\\n');
      await assert.rejects(sessions.getAiSessionMessagesPage('history-owner',sessionId,cursor,50),'文件变化后必须重新校验完整日志');
      assert.equal(fullScans,2,'文件版本变化后必须回退完整链扫描');
      configuration.close();sessionRecords.close();closeDatabase();
    `;
    const output = run(data, script);
    const measurement = JSON.parse(output.trim().split(/\r?\n/u).at(-1));
    assert.equal(measurement.pageCount, 20);
    assert.ok(measurement.logBytes > 0);
    assert.equal(measurement.fullScans, 0);
    assert.equal(measurement.avoidedFullScanBytes, measurement.logBytes * measurement.pageCount);
    t.diagnostic(`4,000 条合成历史消息、${measurement.logBytes} 字节日志，20 页缓存翻阅；全链重扫 ${measurement.fullScans} 次，避免重复读取 ${measurement.avoidedFullScanBytes} 字节；P50 ${measurement.p50Ms.toFixed(3)} ms / P95 ${measurement.p95Ms.toFixed(3)} ms。`);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-cache-pages-performance-"));
    rmSync(data, { recursive: true, force: true });
  }
});
