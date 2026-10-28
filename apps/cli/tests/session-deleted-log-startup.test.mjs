/** 功能：会话 JSONL 被删除或修订缺失时的 Session Owner 启动边界回归。 */
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

test("整段会话 JSONL 删除后重启成功，孤立投影不再显示且其他会话保留", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-deleted-log-"));
  try {
    const ids = JSON.parse(run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('deleted-log-owner','deleted-log-owner','salt','hash','admin')").run();
      const deleted=sessions.createAiTurn('deleted-log-owner','workspace',null,'已删除会话');
      sessions.finishAiAssistantMessage('deleted-log-owner',deleted.session.id,deleted.assistantMessage.id,'已保存','complete');
      const retained=sessions.createAiTurn('deleted-log-owner','workspace',null,'保留会话');
      sessions.finishAiAssistantMessage('deleted-log-owner',retained.session.id,retained.assistantMessage.id,'仍然可读','complete');
      const orphan=database.prepare('INSERT INTO ai_sessions(id,user_id,app_id,title,archived,created_at,updated_at,jsonl_revision) VALUES (?,?,?,?,?,?,?,?)');
      for(let i=0;i<205;i++) orphan.run('deleted-cache-'+i,'deleted-log-owner','workspace','已删除索引 '+i,0,'2026-01-01T00:00:00.000Z','9999-12-31T23:59:59.000Z','missing-log');
      const deletedDirectory=sessionRecords.storageLocation(deleted.session.id).sessionDirectory;
      close();
      (await import('node:fs')).rmSync(deletedDirectory,{recursive:true,force:true});
      console.log(JSON.stringify({deletedId:deleted.session.id,retainedId:retained.session.id}));
    `));

    run(data, `${setup}
      import assert from 'node:assert/strict';
      const ids=${JSON.stringify(ids)};
      const projected=sessionRecords.all('ai_sessions').map(row=>row.id);
      assert.deepEqual(projected,[ids.retainedId]);
      assert.deepEqual(sessionRecords.listHeaders('deleted-log-owner',false).map(row=>row.id),[ids.retainedId]);
      assert.equal(database.prepare('SELECT id FROM ai_sessions WHERE id = ?').get(ids.deletedId)?.id,ids.deletedId,'启动恢复只忽略孤立投影，不清理用户数据');
      assert.equal(sessions.getAiSession('deleted-log-owner',ids.deletedId),null);
      assert.equal(sessions.getAiSessionMessages('deleted-log-owner',ids.retainedId).at(-1).content,'仍然可读');
      close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-deleted-log-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("日志仍存在但 SQLite 修订引用缺失时继续拒绝启动", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-missing-revision-"));
  try {
    const { sessionId } = JSON.parse(run(data, `${setup}
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('revision-owner','revision-owner','salt','hash','admin')").run();
      const turn=sessions.createAiTurn('revision-owner','workspace',null,'修订保护');
      sessions.finishAiAssistantMessage('revision-owner',turn.session.id,turn.assistantMessage.id,'仍需保护','complete');
      const sessionId=turn.session.id;
      database.prepare('UPDATE ai_sessions SET jsonl_revision = ? WHERE id = ?').run('missing-committed-transaction',sessionId);
      close();
      console.log(JSON.stringify({sessionId}));
    `));
    assert.ok(sessionId);
    assert.throws(() => run(data, setup), error => String(error.stderr ?? error.message).includes("会话日志缺失已提交历史"));
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-missing-revision-"));
    rmSync(data, { recursive: true, force: true });
  }
});
