/**
 * 功能：验证 Agent Loop 从已完成会话的第一条用户输入生成并保存简短标题。
 * 作用：隔离 SQLite/JSONL 与合成 LLM，覆盖真实 Session Owner/CAS 和标题用量写入。
 * 关联文件：packages/core/agent-loop/src/runs.ts、packages/core/session/src/sessions.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryParent = resolve(cli, "../../dist/.tmp");
const setup = `
  const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
  const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
  const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
  const sessions=await import('lfaa-session/src/sessions.js');
  const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');
  retireLegacyFileTables();
  const close=()=>{configuration.close();sessionRecords.close();closeDatabase();};
`;

test("已完成会话即使已有回复用量，也能生成并持久化自动标题", () => {
  const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-session-title-generation-"));
  try {
    const script = `${setup}
      const originalFetch=globalThis.fetch;
      try {
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('title-owner',81,'title-owner','salt','hash','admin',1)").run();
      const account={accountId:'fixture-account',providerId:'fixture-provider',modelId:'fixture-model',maxOutputTokens:1024,contextWindow:4096,reasoningMode:'default',maxTokensField:'max_tokens',chatUrl:'https://provider.example/v1/chat/completions',keyHeader:'Authorization',keyPrefix:'Bearer ',secret:'fixture-only-secret'};
      const requests=[];
      globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);requests.push({url:String(url),body});const truncated=body.max_tokens<512;const frames=[{choices:[{delta:{content:'当前任务标题'},finish_reason:truncated?'length':'stop'}],usage:{prompt_tokens:19,completion_tokens:body.max_tokens}},{choices:[],usage:{prompt_tokens:19,completion_tokens:body.max_tokens}}];return new Response(frames.map(frame=>'data: '+JSON.stringify(frame)+'\\n\\n').join('')+'data: [DONE]\\n\\n',{headers:{'content-type':'text/event-stream'}});};
      const {createAiCompletionService}=await import('lfaa-llm/src/completion.js');
      const runs=await import('lfaa-agent-loop/src/runs.js');
      runs.initializeAiRuns({resolve:userId=>userId==='title-owner'?account:null},{},{registerAnswerer:()=>()=>{}},createAiCompletionService());
      const turn=sessions.createAiTurn('title-owner','workspace',null,'请整理当前任务目标');
      sessions.finishAiAssistantMessage('title-owner',turn.session.id,turn.assistantMessage.id,'已经完成的真实回复','complete');
      sessions.recordAiUsage('title-owner',turn.session.id,turn.assistantMessage.id,'fixture-provider','fixture-model',120,45,0,'turn');
      const result=await runs.generateAiSessionTitle('title-owner',turn.session.id);
      assert.equal(result.generated,true);
      assert.equal(result.session.title,'当前任务标题');
      assert.equal(result.session.titleStatus,'generated');
      assert.equal(requests.length,1);
      assert.equal(requests[0].url,account.chatUrl);
      assert.equal(requests[0].body.max_tokens,512);
      assert.equal(Object.hasOwn(requests[0].body,'tools'),false);
      assert.equal(requests[0].body.messages.filter(message=>message.role==='user').length,1);
      assert.equal(requests[0].body.messages.at(-1).content,'请整理当前任务目标');
      const usage=sessionRecords.allForSession('ai_usage',turn.session.id);
      assert.equal(usage.length,2,'主回复与标题请求都保留各自真实用量');
      console.log(JSON.stringify({generated:result.generated,status:result.session.titleStatus,usageCount:usage.length}));
      } finally { globalThis.fetch=originalFetch; close(); }
    `;
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
      cwd: cli,
      env: { ...process.env, NODE_ENV: "test", LFAA_HOME: `${dataDirectory}-home`, LFAA_DATA_DIR: dataDirectory, JWT_SECRET: "" },
      encoding: "utf8",
      stdio: "pipe"
    });
    assert.match(output, /"generated":true,"status":"generated","usageCount":2/u);
  } finally {
    assert.equal(dirname(resolve(dataDirectory)), temporaryParent);
    assert.ok(basename(dataDirectory).startsWith("lfaa-session-title-generation-"));
    rmSync(dataDirectory, { recursive: true, force: true });
    rmSync(`${dataDirectory}-home`, { recursive: true, force: true });
  }
});
