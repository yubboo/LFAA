/** 功能：验证用量汇总不因历史 JSONL 用量行数而恢复会话或扫描逐条记录。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
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

test("大量历史用量可在重放后 O(Provider/模型组) 汇总，且不恢复会话记录", (t) => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-usage-summary-"));
  try {
    const result = run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('usage-owner','usage-owner','salt','hash','admin')").run();
      const expected={requestCount:0,promptTokens:0,promptTokenCount:0,completionTokens:0,completionTokenCount:0,providers:new Map()};
      for(let sessionIndex=0;sessionIndex<16;sessionIndex++){
        const turn=sessions.createAiTurn('usage-owner','workspace',null,'性能夹具');
        const changes=[];
        for(let index=0;index<250;index++){
          const ordinal=sessionIndex*250+index;
          const providerId=ordinal%2?'provider-a':'provider-b';
          const modelId=ordinal%3?'model-x':'model-y';
          const promptTokens=ordinal%5===0?null:ordinal%7;
          const completionTokens=ordinal%11===0?null:ordinal%9;
          const created_at=new Date(Date.UTC(2026,0,1,0,0,ordinal)).toISOString();
          const row={id:'usage-'+ordinal,user_id:'usage-owner',session_id:turn.session.id,message_id:turn.assistantMessage.id,provider_id:providerId,model_id:modelId,prompt_tokens:promptTokens,completion_tokens:completionTokens,created_at};
          changes.push({table:'ai_usage',key:row.id,value:row});
          expected.requestCount++;
          if(promptTokens!==null){expected.promptTokens+=promptTokens;expected.promptTokenCount++;}
          if(completionTokens!==null){expected.completionTokens+=completionTokens;expected.completionTokenCount++;}
          const key=JSON.stringify([providerId,modelId]);
          const group=expected.providers.get(key)??{providerId,modelId,requestCount:0,promptTokens:0,promptTokenCount:0,completionTokens:0,completionTokenCount:0,latestAt:''};
          group.requestCount++;
          if(promptTokens!==null){group.promptTokens+=promptTokens;group.promptTokenCount++;}
          if(completionTokens!==null){group.completionTokens+=completionTokens;group.completionTokenCount++;}
          if(created_at>group.latestAt)group.latestAt=created_at;
          expected.providers.set(key,group);
        }
        sessionRecords.commit(turn.session.id,changes);
      }
      expected.providers=[...expected.providers.values()].sort((a,b)=>b.latestAt.localeCompare(a.latestAt)).map(({providerId,modelId,requestCount,promptTokens,promptTokenCount,completionTokens,completionTokenCount})=>({providerId,modelId,requestCount,promptTokens:promptTokenCount?promptTokens:null,completionTokens:completionTokenCount?completionTokens:null}));
      expected.promptTokens=expected.promptTokenCount?expected.promptTokens:null;
      expected.completionTokens=expected.completionTokenCount?expected.completionTokens:null;
      delete expected.promptTokenCount;delete expected.completionTokenCount;
      assert.deepEqual(sessions.getAiUsageSummary('usage-owner'),expected);
      sessionRecords.replay();
      const before=sessionRecords.cacheStats();
      const originalAll=sessionRecords.all;
      sessionRecords.all=()=>{throw new Error('用量汇总不应逐会话加载历史记录');};
      const startedAt=performance.now();
      const actual=sessions.getAiUsageSummary('usage-owner');
      const summaryDurationMs=performance.now()-startedAt;
      sessionRecords.all=originalAll;
      assert.deepEqual(actual,expected);
      assert.deepEqual(sessionRecords.cacheStats(),before);
      console.log(JSON.stringify({requestCount:actual.requestCount,providerModelGroups:actual.providers.length,summaryDurationMs}));
      close();
    `);
    const measurement = JSON.parse(result);
    assert.equal(measurement.requestCount, 4000);
    assert.equal(measurement.providerModelGroups, 4);
    assert.ok(Number.isFinite(measurement.summaryDurationMs));
    t.diagnostic(`4,000 条历史用量、4 个分组：汇总读取 ${measurement.summaryDurationMs.toFixed(3)} ms；未恢复会话缓存。`);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-usage-summary-"));
    rmSync(data, { recursive: true, force: true });
  }
});
