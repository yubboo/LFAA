/**
 * 功能：验证普通聊天分支由模型压缩上下文，并以有限记忆创建空白子会话。
 * 作用：覆盖 Provider 无工具摘要、JSONL 记忆持久化、后续上下文、嵌套分支和来源关系。
 * 关联文件：packages/core/agent-loop/src/branch-memory.ts、packages/core/session/src/sessions.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = resolve(cli, "../..");
function run(dataDirectory, script) {
  return execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_HOME: `${dataDirectory}-home`, LFAA_DATA_DIR: dataDirectory, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe"
  });
}
const setup = `
  const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
  const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
  const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
  const sessions=await import('lfaa-session/src/sessions.js');
  const close=()=>{configuration.close();sessionRecords.close();closeDatabase();};
`;

test("当前 Provider 以无工具请求压缩分支记忆并记录真实用量", async () => {
  const { summarizeBranchMemory } = await import("lfaa-agent-loop/src/branch-memory.js");
  const { createAiCompletionService } = await import("lfaa-llm/src/completion.js");
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(options.body) });
      const frames = [
        { choices: [{ delta: { content: "# 当前目标\n继续完成已确定的方案。" }, finish_reason: "stop" }], usage: { prompt_tokens: 41, completion_tokens: 18 } },
        { choices: [], usage: { prompt_tokens: 41, completion_tokens: 18 } }
      ];
      return new Response(frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    };
    const result = await summarizeBranchMemory({
      messages: [{ role: "user", content: "已经确认的目标" }, { role: "assistant", content: "已完成前置工作" }],
      account: { accountId: "fixture-account", providerId: "fixture-provider", modelId: "fixture-model", maxOutputTokens: 700, contextWindow: 4096, reasoningMode: "default", maxTokensField: "max_tokens", chatUrl: "https://provider.example/v1/chat/completions", keyHeader: "Authorization", keyPrefix: "Bearer ", secret: "fixture-secret" },
      applicationId: "workspace",
      permissionMode: "full_access",
      settings: { speed: "balanced", maxOutputTokens: 640, contextWindowTokens: 4096, requestTimeoutSeconds: 5 },
      signal: new AbortController().signal,
      llm: createAiCompletionService()
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://provider.example/v1/chat/completions");
    assert.equal(Object.hasOwn(requests[0].body, "tools"), false);
    assert.equal(requests[0].body.max_tokens, 614);
    assert.equal(requests[0].body.messages.filter(message => message.role === "user").length, 1);
    assert.match(requests[0].body.messages[0].content, /不可信的历史资料/u);
    assert.equal(result.summary, "# 当前目标\n继续完成已确定的方案。");
    assert.deepEqual(result.usage, [{ providerId: "fixture-provider", modelId: "fixture-model", promptTokens: 41, completionTokens: 18, cacheReadTokens: null }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("记忆分支只保存摘要和来源，重载及嵌套分支继续携带记忆", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-branch-memory-"));
  try {
    const output = run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('memory-owner',41,'memory-owner','salt','hash','admin',1),('memory-other',42,'memory-other','salt','hash','member',0)").run();
      const source=sessions.createAiTurn('memory-owner','workspace',null,'原始父问题');
      sessions.finishAiAssistantMessage('memory-owner',source.session.id,source.assistantMessage.id,'原始父回复','complete');
      sessions.setAiSessionPlanMode('memory-owner',source.session.id,true);
      const seed=sessions.prepareAiSessionBranchSeed('memory-owner',source.session.id,source.assistantMessage.id,200000);
      assert.deepEqual(seed.messages.map(message=>message.content),['原始父问题','原始父回复']);
      const summary='当前目标：继续完成确认后的方案；约束是保持已有决定。';
      const branch=sessions.createAiSessionBranchWithMemory('memory-owner',seed,summary,[{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:25,completionTokens:11}]);
      assert.ok(branch);assert.match(branch.title,/记忆分支/u);assert.equal(branch.planMode,true);
      assert.deepEqual(sessions.getAiSessionMessages('memory-owner',branch.id),[]);
      assert.equal(sessions.createAiSessionBranchWithMemory('memory-other',seed,summary,[{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:25,completionTokens:11}]),null);
      const branchEvents=sessionRecords.allForSession('session_events',branch.id);
      assert.deepEqual(branchEvents.map(event=>event.type).filter(type=>['user/message','assistant/message','tool/result','request/context'].includes(type)),[]);
      const marker=branchEvents.find(event=>event.type==='session/branch-memory');
      assert.equal(marker.data.summary,summary);assert.equal(marker.data.sourceSessionId,source.session.id);assert.ok(marker.data.sourceEventId);
      assert.equal(sessionRecords.allForSession('ai_usage',branch.id).length,1);
      const next=sessions.createAiTurn('memory-owner','workspace',branch.id,'分支新问题');
      assert.equal(next.history.length,2);
      assert.match(next.history[0].content,/当前目标：继续完成确认后的方案/u);
      assert.doesNotMatch(next.history[0].content,/原始父问题|原始父回复/u);
      assert.equal(next.history[1].content,'分支新问题');
      sessions.finishAiAssistantMessage('memory-owner',branch.id,next.assistantMessage.id,'分支独立回复','complete');
      const nestedSeed=sessions.prepareAiSessionBranchSeed('memory-owner',branch.id,next.assistantMessage.id,200000);
      assert.deepEqual(nestedSeed.messages.map(message=>message.role),['memory','user','assistant']);
      assert.match(nestedSeed.messages[0].content,/当前目标：继续完成确认后的方案/u);
      const nested=sessions.createAiSessionBranchWithMemory('memory-owner',nestedSeed,'嵌套分支只保留再压缩后的记忆',[{providerId:'fixture-provider',modelId:'fixture-model',promptTokens:31,completionTokens:12}]);
      assert.ok(nested);assert.deepEqual(sessions.getAiSessionMessages('memory-owner',nested.id),[]);
      await sessions.flushAiSession('memory-owner',source.session.id);await sessions.flushAiSession('memory-owner',branch.id);await sessions.flushAiSession('memory-owner',nested.id);
      console.log(JSON.stringify({sourceId:source.session.id,branchId:branch.id,nestedId:nested.id}));close();
    `);
    const ids = JSON.parse(output);
    run(data, `${setup}
      const ids=${JSON.stringify(ids)};
      const page=await sessions.getAiSessionMessagesPage('memory-owner',ids.branchId,undefined,50);
      assert.deepEqual(page.messages.map(message=>message.content),['分支新问题','分支独立回复']);
      assert.equal(page.branchSource.session.id,ids.sourceId);
      const next=sessions.createAiTurn('memory-owner','workspace',ids.branchId,'重载后的新问题');
      assert.match(next.history[0].content,/当前目标：继续完成确认后的方案/u);
      assert.equal(next.history.some(message=>message.content==='原始父问题'||message.content==='原始父回复'),false);
      sessions.finishAiAssistantMessage('memory-owner',ids.branchId,next.assistantMessage.id,'','interrupted');
      const nestedPage=await sessions.getAiSessionMessagesPage('memory-owner',ids.nestedId,undefined,50);
      assert.equal(nestedPage.branchSource.session.id,ids.branchId);
      assert.equal(sessionRecords.allForSession('session_events',ids.nestedId).some(event=>event.type==='user/message'||event.type==='assistant/message'),false);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-branch-memory-"));
    assert.equal(dirname(resolve(`${data}-home`)), parent);
    assert.ok(basename(`${data}-home`).startsWith("lfaa-session-branch-memory-"));
    rmSync(data, { recursive: true, force: true });
    rmSync(`${data}-home`, { recursive: true, force: true });
  }
});

test("Agent Loop 摘要成功才创建分支，Provider 失败或工具调用均不产生子会话", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-agent-branch-memory-"));
  try {
    run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('loop-owner',51,'loop-owner','salt','hash','admin',1)").run();
      const account={accountId:'fixture-account',providerId:'fixture-provider',modelId:'fixture-model',maxOutputTokens:700,contextWindow:4096,reasoningMode:'default',maxTokensField:'max_tokens',chatUrl:'https://provider.example/v1/chat/completions',keyHeader:'Authorization',keyPrefix:'Bearer ',secret:'fixture-secret'};
      const questions={registerAnswerer:()=>()=>{}};
      const runs=await import('lfaa-agent-loop/src/runs.js');
      const {createAiCompletionService}=await import('lfaa-llm/src/completion.js');
      runs.initializeAiRuns({resolve:userId=>userId==='loop-owner'?account:null},{},questions,createAiCompletionService());
      const frames=[{choices:[{delta:{content:'压缩后的稳定记忆。'},finish_reason:'stop'}],usage:{prompt_tokens:32,completion_tokens:12}},{choices:[],usage:{prompt_tokens:32,completion_tokens:12}}];
      globalThis.fetch=async(_url,options)=>{globalThis.__branchMemoryRequestBody=JSON.parse(options.body);return new Response(frames.map(frame=>'data: '+JSON.stringify(frame)+'\\n\\n').join('')+'data: [DONE]\\n\\n',{headers:{'content-type':'text/event-stream'}})};
      const source=sessions.createAiTurn('loop-owner','workspace',null,'原始问题');
      sessions.finishAiAssistantMessage('loop-owner',source.session.id,source.assistantMessage.id,'原始回复','complete');
      const branch=await runs.createAiSessionBranchWithMemory('loop-owner',source.session.id,source.assistantMessage.id);
      assert.ok(branch);assert.deepEqual(sessions.getAiSessionMessages('loop-owner',branch.id),[]);
      assert.equal(sessionRecords.allForSession('ai_usage',branch.id).length,1);
      const success=sessionRecords.allForSession('session_events',branch.id).find(event=>event.type==='session/branch-memory');
      assert.equal(success.data.summary,'压缩后的稳定记忆。');
      const requestBody=globalThis.__branchMemoryRequestBody;
      assert.equal(Object.hasOwn(requestBody,'tools'),false);
      const cancelledSource=sessions.createAiTurn('loop-owner','workspace',null,'取消竞态问题');
      sessions.finishAiAssistantMessage('loop-owner',cancelledSource.session.id,cancelledSource.assistantMessage.id,'取消竞态回复','complete');
      const beforeCancel=sessions.listAiSessions('loop-owner',false).length;
      const cancellation=new AbortController();const nativeThrowIfAborted=cancellation.signal.throwIfAborted.bind(cancellation.signal);let abortChecks=0;
      Object.defineProperty(cancellation.signal,'throwIfAborted',{configurable:true,value(){abortChecks++;if(abortChecks===2)cancellation.abort();nativeThrowIfAborted();}});
      await assert.rejects(runs.createAiSessionBranchWithMemory('loop-owner',cancelledSource.session.id,cancelledSource.assistantMessage.id,{signal:cancellation.signal}),error=>error.name==='AbortError');
      assert.equal(sessions.listAiSessions('loop-owner',false).length,beforeCancel,'摘要完成后请求取消不能留下新分支');
      const failedSource=sessions.createAiTurn('loop-owner','workspace',null,'失败路径问题');
      sessions.finishAiAssistantMessage('loop-owner',failedSource.session.id,failedSource.assistantMessage.id,'失败路径回复','complete');
      const beforeFailure=sessions.listAiSessions('loop-owner',false).length;
      globalThis.fetch=async()=>new Response('provider down',{status:503});
      await assert.rejects(runs.createAiSessionBranchWithMemory('loop-owner',failedSource.session.id,failedSource.assistantMessage.id),/Provider 暂时不可用/u);
      assert.equal(sessions.listAiSessions('loop-owner',false).length,beforeFailure);
      globalThis.fetch=async()=>new Response('data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,id:'unexpected-call',type:'function',function:{name:'unexpected_tool',arguments:'{}'}}]},finish_reason:'tool_calls'}]})+'\\n\\ndata: [DONE]\\n\\n',{headers:{'content-type':'text/event-stream'}});
      await assert.rejects(runs.createAiSessionBranchWithMemory('loop-owner',failedSource.session.id,failedSource.assistantMessage.id),/不允许工具调用/u);
      assert.equal(sessions.listAiSessions('loop-owner',false).length,beforeFailure);
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-agent-branch-memory-"));
    assert.equal(dirname(resolve(`${data}-home`)), parent);
    assert.ok(basename(`${data}-home`).startsWith("lfaa-agent-branch-memory-"));
    rmSync(data, { recursive: true, force: true });
    rmSync(`${data}-home`, { recursive: true, force: true });
  }
});

test("普通会话与 Worktree 分支 API 都将摘要交给 Agent Loop，保留认证和项目归属校验", () => {
  const sessionController=readFileSync(resolve(repository,"packages/api/session-controller/src/index.ts"),"utf8");
  const workspaceController=readFileSync(resolve(repository,"packages/api/workspace-controller/src/index.ts"),"utf8");
  const clientApi=readFileSync(resolve(repository,"packages/client/connection/src/api.ts"),"utf8");
  assert.match(sessionController,/router\.post\("\/ai\/sessions\/:sessionId\/fork",\s*requireAuthentication,\s*limitAiInference/u);
  assert.match(sessionController,/createAiSessionBranchWithMemory\(request\.auth!\.user\.id, request\.params\.sessionId, body\.messageId, \{ signal: controller\.signal \}\)/u);
  assert.match(workspaceController,/router\.post\("\/workspace\/sessions\/:sessionId\/fork",\s*requireAuthentication,\s*limitAiBranchMemory/u);
  assert.match(workspaceController,/createAiSessionBranchWithMemory\(userId, sourceSession\.id, body\.messageId, \{ projectContext, signal: controller\.signal \}\)/u);
  assert.match(workspaceController,/worktree\.sourceProjectId !== sourceProject\.id/u);
  assert.match(clientApi,/createAiSessionBranchFromMessage\([^)]*\)[\s\S]*?\/ai\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/fork/u);
  assert.match(clientApi,/createAiSessionBranchFromMessageInWorktree\([^)]*\)[\s\S]*?\/workspace\/sessions\/\$\{encodeURIComponent\(sessionId\)\}\/fork/u);
});
