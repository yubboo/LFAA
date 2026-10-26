/** 功能：验证可读会话目录索引从 Session Owner 的标题投影生成并可重建。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("会话目录索引按标题映射哈希目录并可重建", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-storage-index-"));
  try {
    const created = JSON.parse(run(data, `${setup}
      const {basename}=await import('node:path');
      (await import('lfaa-storage-domain/src/migration.js')).retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES ('index-owner','index-owner','salt','hash','admin')").run();
      const turn=sessions.createAiTurn('index-owner','workspace',null,'私密消息正文不应进入索引');
      const header=sessionRecords.get('ai_sessions',turn.session.id);
      sessionRecords.commit(turn.session.id,[{table:'ai_sessions',key:turn.session.id,value:{...header,title:'人工标题\\t带换行\\n的会话'}}]);
      const folder=basename(sessionRecords.storageLocation(turn.session.id).sessionDirectory);
      console.log(JSON.stringify({id:turn.session.id,folder}));
      close();
    `).trim());
    const indexPath = join(data, "home", "sessions", "会话目录索引.txt");
    const temporaryPath = join(data, "home", "sessions", ".session-index-00000000-0000-4000-8000-000000000001.tmp");
    rmSync(indexPath);
    writeFileSync(temporaryPath, "stale index temporary");

    const output = run(data, `${setup}
      import assert from 'node:assert/strict';
      const {id,folder}=${JSON.stringify(created)};
      const {readFileSync,existsSync}=await import('node:fs');
      const {join}=await import('node:path');
      const indexPath=join(process.env.LFAA_HOME,'sessions','会话目录索引.txt');
      const index=readFileSync(indexPath,'utf8');
      assert.ok(index.includes('人工标题 带换行 的会话'));
      assert.ok(index.includes(folder));
      assert.ok(!index.includes('私密消息正文不应进入索引'));
      assert.equal(existsSync(join(process.env.LFAA_HOME,'sessions','.session-index-00000000-0000-4000-8000-000000000001.tmp')),false);
      database.prepare("DELETE FROM users WHERE id = ?").run('index-owner');
      sessionRecords.removeUser('index-owner');
      const afterRemoval=readFileSync(indexPath,'utf8');
      assert.ok(!afterRemoval.includes('人工标题'));
      assert.ok(!afterRemoval.includes(folder));
      close();
      console.log('index-rebuilt-and-cleaned');
    `);
    assert.equal(output.trim(), "index-rebuilt-and-cleaned");
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-storage-index-"));
    rmSync(data, { recursive: true, force: true });
  }
});
