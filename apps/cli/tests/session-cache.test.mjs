/** 功能：回归 JSONL 正文冷缓存与有界会话列表。作用：验证淘汰后读取、重启、账户隔离和链损坏拒绝。关联文件：session-persistence-jsonl/repository.ts、persistence.ts。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("多个会话不常驻全部正文，缓存淘汰和重启保留权威历史与隔离", () => {
  const parent = resolve(cli, "../../dist/.tmp"); mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-cache-"));
  const setup = `
    import assert from 'node:assert/strict';
    const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
    const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
    const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
    const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js'); retireLegacyFileTables();
    const close=()=>{sessionRecords.close();configuration.close();closeDatabase();};
  `;
  const run = script => execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", setup + script], {
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_HOME: join(data, "home"), LFAA_HARNESS_HOME: join(data, "home"), LFAA_DATA_DIR: join(data, "business-data"), JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe", timeout: 60_000
  });
  try {
    run(`
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('cache-a',1,'cache-a','salt','hash','admin',1),('cache-b',2,'cache-b','salt','hash','member',0)").run();
      const content='正文'.repeat(20000);
      const largeContent='正文'.repeat(800000);
      for(let index=0;index<215;index++){
        const id='cache-session-'+index, user=index===214?'cache-b':'cache-a';
        sessionRecords.commit(id,[{table:'ai_sessions',key:id,value:{id,user_id:user,app_id:'workspace',title:id,archived:0,created_at:new Date().toISOString(),updated_at:new Date(Date.now()+index).toISOString()}},
          {table:'ai_messages',key:'message-'+index,value:{id:'message-'+index,session_id:id,user_id:user,role:'assistant',content:index<10?largeContent:content,status:index===0?'streaming':'complete',created_at:new Date().toISOString()}}]);
        assert.ok(sessionRecords.cacheStats().sessions<=8); assert.ok(sessionRecords.cacheStats().bytes<=32*1024*1024);
        if(index===7)assert.ok(sessionRecords.cacheStats().sessions<8,'字节预算应先于会话数量上限淘汰');
      }
      const longId='cache-long-session', baseTime=Date.now()-130000;
      const longMessages=Array.from({length:130},(_,index)=>({table:'ai_messages',key:'long-message-'+index,value:{id:'long-message-'+index,session_id:longId,user_id:'cache-a',role:index%2?'assistant':'user',content:'long-'+index,status:'complete',created_at:new Date(baseTime+index*1000).toISOString(),_order:index,activity_json:'[]'}}));
      sessionRecords.commit(longId,[{table:'ai_sessions',key:longId,value:{id:longId,user_id:'cache-a',app_id:'workspace',title:longId,archived:0,created_at:new Date(baseTime).toISOString(),updated_at:new Date().toISOString()}},...longMessages]);
      const {getAiSessionMessagesPage,submitAiMessageFeedback}=await import('lfaa-session/src/sessions.js');
      submitAiMessageFeedback('cache-a',longId,'long-message-129',{rating:'positive',reasons:['accurate'],detail:'页内反馈'});
      const first=await getAiSessionMessagesPage('cache-a',longId,undefined,50);
      assert.equal(first.messages.length,50); assert.equal(first.messages[0].content,'long-80'); assert.equal(first.messages.at(-1).content,'long-129'); assert.ok(first.nextCursor);
      assert.equal(first.messages.at(-1).feedback.detail,'页内反馈');
      const second=await getAiSessionMessagesPage('cache-a',longId,first.nextCursor,50);
      assert.equal(second.messages[0].content,'long-30'); assert.equal(second.messages.at(-1).content,'long-79'); assert.ok(second.nextCursor);
      const third=await getAiSessionMessagesPage('cache-a',longId,second.nextCursor,50);
      assert.equal(third.messages.length,30); assert.equal(third.messages[0].content,'long-0'); assert.equal(third.nextCursor,null);
      assert.equal(await getAiSessionMessagesPage('cache-b',longId,undefined,50),null);
      await assert.rejects(getAiSessionMessagesPage('cache-a',longId,'not-a-cursor',50),/游标无效/);
      assert.equal(sessionRecords.get('ai_messages','message-0').content,largeContent);
      assert.equal(sessionRecords.listHeaders('cache-a',false).length,200);
      assert.equal(sessionRecords.listHeaders('cache-b',false).length,1);
      sessionRecords.commit('cache-session-0',[{table:'ai_messages',key:'message-0',value:{...sessionRecords.get('ai_messages','message-0'),content:'冷会话更新',status:'streaming'}}]);
      const {listAiSessions,setAiSessionPlanMode}=await import('lfaa-session/src/sessions.js');
      setAiSessionPlanMode('cache-a','cache-session-0',true,{allowActiveRun:true});
      sessionRecords.commit('cache-session-0',[{table:'ai_sessions',key:'cache-session-0',value:{...sessionRecords.get('ai_sessions','cache-session-0'),updated_at:new Date(Date.now()+1000).toISOString()}}]);
      const original=sessionRecords.allForSession.bind(sessionRecords);
      sessionRecords.allForSession=()=>{throw new Error('标题列表不得冷读正文');};
      assert.equal(listAiSessions('cache-a',false).find(row=>row.id==='cache-session-0').planMode,true);
      sessionRecords.allForSession=original;
      close();
    `);
    run(`
      assert.equal(sessionRecords.get('ai_messages','message-0').content,'冷会话更新');
      assert.equal(sessionRecords.get('ai_messages','message-0').status,'interrupted');
      assert.equal(sessionRecords.planMode('cache-session-0'),true);
      assert.equal(sessionRecords.allForSession('ai_messages','cache-session-214').length,1);
      assert.ok(sessionRecords.cacheStats().sessions<=8);
      sessionRecords.removeUser('cache-b');
      database.prepare("DELETE FROM users WHERE id='cache-b'").run();
      assert.equal(sessionRecords.get('ai_messages','message-214'),undefined);
      close();
    `);
    run(`
      const {readFileSync,writeFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');
      const path=process.env.LFAA_HOME+'/sessions/'+createHash('sha256').update('cache-session-0').digest('hex')+'/events.jsonl';
      // 先读取其他会话，使目标正文离开缓存，再篡改冷日志；冷恢复必须重新验证链。
      for(let i=1;i<20;i++)sessionRecords.allForSession('ai_messages','cache-session-'+i);
      writeFileSync(path,readFileSync(path,'utf8').replace('冷会话更新','伪造历史'));
      assert.throws(()=>sessionRecords.get('ai_messages','message-0'),/完整性/);
      assert.throws(()=>sessionRecords.listHeaders('cache-a',false),/提交失败/);
      close();
    `);
  } finally { assert.equal(dirname(data), parent); rmSync(data, { recursive: true, force: true }); }
});
