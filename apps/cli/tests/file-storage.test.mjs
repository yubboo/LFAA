/**
 * 功能：长期回归文件配置与 JSONL 会话迁移。
 * 作用：在隔离数据中验证无损导入、旧表退役、账户隔离、重启、日志完整性和单写者约束。
 * 关联文件：storage-domain、session-persistence-jsonl、core/session；所有合成账户只用于本用例。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function run(dataDirectory, script) {
  return execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: dataDirectory, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe"
  });
}
const imports = `
  import assert from 'node:assert/strict';
  const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
`;
const files = `
  const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
  const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
  const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');
  retireLegacyFileTables();
  const settings=await import('lfaa-settings/src/service.js');
  const sessions=await import('lfaa-session/src/sessions.js');
`;
const close = `configuration.close();sessionRecords.close();closeDatabase();`;

test("JSON/JSONL 混合存储无损迁移、重启和损坏保护", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-file-storage-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('fixture-owner',1,'fixture-owner','test-salt','test-hash','admin',1)").run();
      database.prepare("INSERT INTO user_preferences(user_id,selected_app,selected_mode) VALUES ('fixture-owner','writing','ai-work')").run();
      database.prepare("INSERT INTO ai_sessions(id,user_id,app_id,title) VALUES ('fixture-session','fixture-owner','writing','迁移夹具')").run();
      database.prepare("INSERT INTO ai_messages(id,session_id,role,content) VALUES ('fixture-message','fixture-session','user','保留原文\\n第二行')").run();
      database.prepare("INSERT INTO ai_usage(id,user_id,session_id,message_id,provider_id,model_id,prompt_tokens,completion_tokens) VALUES ('fixture-usage','fixture-owner','fixture-session','fixture-message','test-provider','test-model',3,5)").run();
      ${files}
      const prefs=await import('lfaa-settings/src/preferences/service.js');
      assert.deepEqual(prefs.getUserPreferences('fixture-owner'),{selectedApp:'writing',selectedMode:'ai-work'});
      assert.equal(sessions.getAiSessionMessages('fixture-owner','fixture-session')[0].content,'保留原文\\n第二行');
      assert.equal(sessions.getAiSessionMessages('different-owner','fixture-session'),null);
      // 文件存储在 v31 完成；后续 Agent 业务可继续升级，仍须保留日志修订投影。
      assert.ok(database.prepare('PRAGMA user_version').get().user_version>=31);
      assert.ok(database.prepare('PRAGMA table_info(ai_sessions)').all().some(column=>column.name==='jsonl_revision'));
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('ai_messages','ai_usage','user_settings','ai_accounts','user_preferences')").get().count,0);
      const saved=settings.getUserSettings('fixture-owner');
      saved.appearance.theme='dark'; saved.appearance.blur=17; saved.permissions.mode='full_access';
      settings.saveUserSettings('fixture-owner','appearance',saved.appearance);
      settings.saveUserSettings('fixture-owner','permissions',saved.permissions);
      const turn=sessions.createAiTurn('fixture-owner','writing','fixture-session','新增输入');
      sessions.finishAiAssistantMessage('fixture-owner',turn.session.id,turn.assistantMessage.id,'真实结果夹具','complete');
      sessions.recordAiUsage('fixture-owner',turn.session.id,turn.assistantMessage.id,'test-provider','test-model',2,7);
      assert.equal(sessions.getAiUsageSummary('fixture-owner').promptTokens,5);
      assert.equal(sessions.getAiUsageSummary('fixture-owner').completionTokens,12);
      ${close}
    `);
    run(data, `${imports}${files}
      assert.equal(settings.getUserSettings('fixture-owner').appearance.theme,'dark');
      assert.equal(settings.getUserSettings('fixture-owner').appearance.blur,17);
      assert.equal(settings.getUserSettings('fixture-owner').permissions.mode,'full_access');
      assert.equal(sessions.getAiSessionMessages('fixture-owner','fixture-session').at(-1).content,'真实结果夹具');
      const {execFileSync}=await import('node:child_process');
      assert.throws(()=>execFileSync(process.execPath,['--import','tsx','--import','./register-package-loader.mjs','--input-type=module','-e',"await import('lfaa-storage-domain/src/configuration.js')"],{cwd:process.cwd(),env:process.env,stdio:'pipe'}));
      ${close}
    `);
    const directories = readdirSync(join(data, "sessions")).filter(name => /^[a-f0-9]{64}$/u.test(name));
    assert.equal(directories.length, 1);
    const log = join(data, "sessions", directories[0], "events.jsonl");
    const original = readFileSync(log, "utf8");
    appendFileSync(log, '{"未完成末行":');
    run(data, `${imports}${files} assert.equal(sessions.getAiUsageSummary('fixture-owner').requestCount,2); ${close}`);
    assert.equal(readFileSync(log, "utf8"), original);
    const lines = original.trimEnd().split("\n");
    writeFileSync(log, `${lines.slice(0, -1).join("\n")}\n`);
    assert.throws(() => run(data, `${imports}${files}${close}`));
    writeFileSync(log, original);
    const tampered = JSON.parse(lines[0]);
    tampered.changes[0].value.title = "被篡改的夹具";
    writeFileSync(log, `${JSON.stringify(tampered)}\n${lines.slice(1).join("\n")}\n`);
    assert.throws(() => run(data, `${imports}${files}${close}`));
    writeFileSync(log, original);
    const config = join(data, "storages", "configuration.json");
    const saved = readFileSync(config);
    writeFileSync(config, "{损坏");
    assert.throws(() => run(data, `${imports}${files}${close}`));
    writeFileSync(config, saved);
    run(data, `${imports}${files}${close}`);
    assert.equal(readdirSync(join(data, "credentials", "storage-migration-backups")).filter(name => name.endsWith(".sqlite")).length, 1);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-file-storage-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("Provider 密文、激活事务、账户删除和配置写入失败保护", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-file-storage-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('fixture-admin',1,'fixture-admin','test-salt','test-hash','admin',1),('fixture-member',2,'fixture-member','test-salt','test-hash','member',0)").run();
      const {randomBytes,createCipheriv}=await import('node:crypto');
      const {mkdirSync,writeFileSync}=await import('node:fs');
      const {resolve}=await import('node:path');
      const key=randomBytes(32), iv=randomBytes(12), plaintext='long-term-test-only-secret';
      mkdirSync(resolve(process.env.LFAA_DATA_DIR,'credentials'),{recursive:true});
      writeFileSync(resolve(process.env.LFAA_DATA_DIR,'credentials/settings.key'),key);
      const cipher=createCipheriv('aes-256-gcm',key,iv);
      const encrypted=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
      const account={user_id:'fixture-member',provider_id:'openai',display_name:'长期夹具 A',options_json:'{}',model_id:'fixture-model',models_json:'[{"id":"fixture-model","name":"长期夹具","thinking":null}]',reasoning_mode:'default',secret_ciphertext:encrypted.toString('base64url'),secret_iv:iv.toString('base64url'),secret_tag:cipher.getAuthTag().toString('base64url')};
      ${files}
      configuration.insert('ai_accounts',{...account,id:'fixture-account-a'});
      configuration.insert('ai_accounts',{...account,id:'fixture-account-b',display_name:'长期夹具 B'});
      settings.activateAiAccount('fixture-member','fixture-account-a');
      settings.activateAiAccount('fixture-member','fixture-account-b');
      assert.equal(settings.resolveActiveAiModelConfiguration('fixture-member').secret,plaintext);
      assert.equal(settings.listAiAccounts('fixture-member').filter(row=>row.active).length,1);
      assert.deepEqual(settings.listAiAccounts('fixture-admin'),[]);
      assert.throws(()=>settings.activateAiAccount('fixture-admin','fixture-account-b'));
      assert.throws(()=>configuration.transaction(()=>configuration.update('ai_accounts',()=>true,{is_active:1})));
      assert.equal(settings.resolveActiveAiModelConfiguration('fixture-member').secret,plaintext);
      const turn=sessions.createAiTurn('fixture-member','writing',null,'长期删除夹具');
      sessions.finishAiAssistantMessage('fixture-member',turn.session.id,turn.assistantMessage.id,'夹具回复','complete');
      ${close}
    `);
    assert.equal(readFileSync(join(data, "storages/configuration.json"), "utf8").includes("long-term-test-only-secret"), false);
    run(data, `${imports}${files}
      assert.equal(settings.resolveActiveAiModelConfiguration('fixture-member').secret,'long-term-test-only-secret');
      const auth=await import('lfaa-identity-auth/src/service.js');
      auth.deleteManagedUser('fixture-admin','fixture-member');
      assert.equal(database.prepare("SELECT id FROM users WHERE id='fixture-member'").get(),undefined);
      assert.deepEqual(configuration.all('ai_accounts'),[]);
      assert.deepEqual(sessionRecords.all('ai_sessions'),[]);
      const {JsonStorageBackend}=await import('lfaa-storage-json/src/index.js');
      const original=JsonStorageBackend.prototype.write;
      JsonStorageBackend.prototype.write=()=>{throw new Error('长期夹具模拟磁盘写失败');};
      const settingsBefore=settings.getUserSettings('fixture-admin');
      assert.throws(()=>settings.saveUserSettings('fixture-admin','appearance',settingsBefore.appearance));
      assert.throws(()=>settings.getUserSettings('fixture-admin'),/必须重启/);
      JsonStorageBackend.prototype.write=original;
      ${close}
    `);
    run(data, `${imports}${files} assert.equal(settings.getUserSettings('fixture-admin').appearance.theme,'system'); ${close}`);
    assert.equal(readdirSync(join(data, "sessions")).filter(name => /^[a-f0-9]{64}$/u.test(name)).length, 0);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-file-storage-"));
    rmSync(data, { recursive: true, force: true });
  }
});
