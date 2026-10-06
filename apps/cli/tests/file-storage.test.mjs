/**
 * 功能：长期回归文件配置与 JSONL 会话迁移。
 * 作用：在隔离数据中验证无损导入、旧表退役、账户隔离、重启、日志完整性和单写者约束。
 * 关联文件：storage-domain、session-persistence-jsonl、core/session；所有合成账户只用于本用例。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDataDirectory } from "../../../packages/util/home-paths/src/resolve-data-directory.mjs";
import { resolveDataPaths, resolveUserDataPaths } from "../../../packages/util/home-paths/src/data-layout.mjs";

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

test("分类目录使用既有数据根且不改用户级/项目级根解析", () => {
  const root = resolve("H:\\LFAA-test-data");
  const paths = resolveDataPaths(root);
  assert.equal(paths.root, root);
  assert.equal(paths.database, join(root, "database"));
  assert.equal(paths.users, join(root, "users"));
  assert.equal(paths.models, join(root, "models"));
  assert.equal(paths.games, join(root, "games"));
  const owner = resolveUserDataPaths(root, "owner-id");
  assert.equal(owner.settings, join(owner.root, "settings"));
  assert.equal(owner.backgrounds, join(owner.root, "assets", "backgrounds"));
  assert.equal(owner.workflows("minecraft"), join(owner.root, "projects", "minecraft", "workflows"));
  assert.notEqual(owner.root, resolveUserDataPaths(root, "other-owner").root);
  assert.throws(() => owner.workflows("../outside"));
  assert.equal(resolveDataDirectory("H:\\project", "data", { platform: "win32", driveType: "Fixed", userProfile: "C:\\Users\\yu" }), "C:\\Users\\yu\\.LFAA\\data");
  assert.equal(resolveDataDirectory("H:\\project", "data", { platform: "win32", driveType: "Removable", userProfile: "C:\\Users\\yu" }), "H:\\project\\data");
  assert.equal(resolveDataDirectory("/repo", "data", { platform: "linux" }), "/repo/data");
});

test("AI Work 回复聚焦虚化外观设置通过账户保存，旧设置补默认并保留其他偏好", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-appearance-focus-blur-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('appearance-owner',1,'appearance-owner','test-salt','test-hash','admin',1)").run();
      ${files}
      const {appearanceSettingsSchema}=await import('lfaa-api-remotes/src/route-contracts.js');
      assert.deepEqual(settings.defaultSettings.appearance.wallpaperEngine,{enabled:false,projectId:''});
      assert.equal(settings.defaultSettings.appearance.advanced.aiWorkOutputFocusBlurIdleSeconds,60);
      const legacy=structuredClone(settings.defaultSettings.appearance);
      delete legacy.wallpaperEngine;
      assert.equal(appearanceSettingsSchema.validate(legacy).error,undefined);
      assert.deepEqual(appearanceSettingsSchema.validate(legacy).value.wallpaperEngine,{enabled:false,projectId:''});
      assert.equal(appearanceSettingsSchema.validate({...legacy,wallpaperEngine:{enabled:true,projectId:'1234567890'}}).error,undefined);
      assert.equal(appearanceSettingsSchema.validate({...legacy,wallpaperEngine:{enabled:true,projectId:'workshop_scene-01'}}).error,undefined);
      assert.equal(appearanceSettingsSchema.validate({...legacy,wallpaperEngine:{enabled:true,projectId:'invalid id'}}).error?.details[0].path.join('.'),'wallpaperEngine.projectId');
      assert.equal(appearanceSettingsSchema.validate({...legacy,wallpaperEngine:{enabled:true,projectId:'x'.repeat(181)}}).error?.details[0].path.join('.'),'wallpaperEngine.projectId');
      legacy.theme='dark'; legacy.blur=19; legacy.advanced.interfaceFontSize=17;
      delete legacy.advanced.aiWorkOutputFocusBlurEnabled;
      delete legacy.advanced.aiWorkOutputFocusBlurPercent;
      delete legacy.advanced.aiWorkOutputFocusBlurIdleSeconds;
      const legacyValidation=appearanceSettingsSchema.validate(legacy);
      assert.equal(legacyValidation.error,undefined);
      assert.equal(legacyValidation.value.advanced.aiWorkOutputFocusBlurEnabled,true);
      assert.equal(legacyValidation.value.advanced.aiWorkOutputFocusBlurPercent,undefined);
      assert.equal(legacyValidation.value.advanced.aiWorkOutputFocusBlurIdleSeconds,60);
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurIdleSeconds:59}}).error?.details[0].type,'number.min');
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurIdleSeconds:3601}}).error?.details[0].type,'number.max');
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurIdleSeconds:90}}).error?.details[0].type,'number.multiple');
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurIdleSeconds:60}}).error,undefined);
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurIdleSeconds:3600}}).error,undefined);
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurPercent:101}}).error?.details[0].type,'number.max');
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurPercent:100}}).error,undefined);
      assert.equal(appearanceSettingsSchema.validate({...legacy,advanced:{...legacy.advanced,aiWorkOutputFocusBlurAmount:25}}).error?.details[0].type,'number.max');
      settings.saveUserSettings('appearance-owner','appearance',legacy);
      const restored=settings.getUserSettings('appearance-owner').appearance;
      assert.equal(restored.theme,'dark');
      assert.equal(restored.blur,19);
      assert.deepEqual(restored.wallpaperEngine,{enabled:false,projectId:''});
      assert.equal(restored.advanced.interfaceFontSize,17);
      assert.equal(restored.advanced.aiWorkOutputFocusBlurEnabled,true);
      assert.equal(restored.advanced.aiWorkOutputFocusBlurPercent,33);
      assert.equal(restored.advanced.aiWorkOutputFocusBlurIdleSeconds,60);
      assert.equal(restored.advanced.aiWorkOutputFocusBlurAmount,undefined);
      const oldPixels={...restored,advanced:{...restored.advanced,aiWorkOutputFocusBlurPercent:undefined,aiWorkOutputFocusBlurAmount:13}};
      settings.saveUserSettings('appearance-owner','appearance',oldPixels);
      const migrated=settings.getUserSettings('appearance-owner').appearance;
      assert.equal(migrated.advanced.aiWorkOutputFocusBlurPercent,54);
      assert.equal(migrated.advanced.aiWorkOutputFocusBlurAmount,undefined);
      const updated={...migrated,advanced:{...migrated.advanced,aiWorkOutputFocusBlurEnabled:false,aiWorkOutputFocusBlurPercent:54,aiWorkOutputFocusBlurIdleSeconds:180}};
      updated.wallpaperEngine={enabled:true,projectId:'a'.repeat(32)};
      settings.saveUserSettings('appearance-owner','appearance',updated);
      assert.equal(settings.getUserSettings('appearance-owner').appearance.advanced.aiWorkOutputFocusBlurEnabled,false);
      assert.equal(settings.getUserSettings('appearance-owner').appearance.advanced.aiWorkOutputFocusBlurPercent,54);
      assert.equal(settings.getUserSettings('appearance-owner').appearance.advanced.aiWorkOutputFocusBlurIdleSeconds,180);
      assert.deepEqual(settings.getUserSettings('appearance-owner').appearance.wallpaperEngine,{enabled:true,projectId:'a'.repeat(32)});
      ${close}
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-appearance-focus-blur-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("旧外观背景 BLOB 校验后迁入用户素材目录，新图片不在 SQLite 保存字节", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-background-files-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('background-owner',1,'background-owner','salt','hash','admin',1)").run();
      const image=Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(image); image.writeUInt32BE(1,16); image.writeUInt32BE(1,20);
      database.prepare("INSERT INTO appearance_backgrounds(user_id,id,display_name,mime_type,image_data) VALUES (?,?,?,?,?)").run('background-owner','user-00000000-0000-4000-8000-000000000001','旧背景','image/png',image);
      ${files}
      const old=settings.getUserBackground('background-owner','user-00000000-0000-4000-8000-000000000001');
      assert.ok(old.data.equals(image));
      assert.equal(database.prepare("SELECT length(image_data) AS size FROM appearance_backgrounds WHERE id=?").get('user-00000000-0000-4000-8000-000000000001').size,0);
      const {resolveUserDataPaths}=await import('lfaa-home-paths/src/data-layout.mjs');
      const {existsSync,readdirSync,readFileSync,writeFileSync}=await import('node:fs');
      const {resolve}=await import('node:path');
      const directory=resolveUserDataPaths(process.env.LFAA_DATA_DIR,'background-owner').backgrounds;
      assert.ok(readdirSync(directory).some(name=>name.endsWith('.png')));
      assert.ok(readdirSync(directory).some(name=>name.endsWith('.meta.json')));
      const uploaded=settings.saveUserBackground('background-owner','data:image/png;base64,'+image.toString('base64'),'新背景');
      assert.ok(settings.getUserBackground('background-owner',uploaded.id).data.equals(image));
      assert.equal(database.prepare("SELECT length(image_data) AS size FROM appearance_backgrounds WHERE id=?").get(uploaded.id).size,0);
      const path=resolve(directory,uploaded.id+'.png');
      const original=readFileSync(path); writeFileSync(path,Buffer.alloc(24));
      assert.throws(()=>settings.getUserBackground('background-owner',uploaded.id),/摘要不匹配/);
      writeFileSync(path,original);
      settings.deleteUserBackground('background-owner',uploaded.id);
      assert.equal(existsSync(path),false);
      ${close}
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-background-files-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("重复账户设置不刷盘；真实修改仅递增用户文件修订并在重启后恢复", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-configuration-performance-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('performance-owner',1,'performance-owner','test-salt','test-hash','admin',1)").run();
      ${files}
      const {readFileSync,statSync}=await import('node:fs');
      const {JsonStorageBackend}=await import('lfaa-storage-json/src/index.js');
      const {resolveUserDataPaths}=await import('lfaa-home-paths/src/data-layout.mjs');
      const path=resolveUserDataPaths(process.env.LFAA_DATA_DIR,'performance-owner').settingsDocument;
      const prefs={user_id:'performance-owner',selected_app:'writing',selected_mode:'normal'};
      configuration.save('user_preferences',prefs);
      const appearance=settings.getUserSettings('performance-owner').appearance;
      settings.saveUserSettings('performance-owner','appearance',appearance);
      const before=readFileSync(path,'utf8'),time=statSync(path).mtimeMs,revision=JSON.parse(before).revision,sqliteRevision=Number(database.prepare('SELECT revision FROM configuration_storage_state WHERE id=1').get().revision);
      let writes=0;
      const original=JsonStorageBackend.prototype.write;
      JsonStorageBackend.prototype.write=function(...args){writes+=1;return original.apply(this,args);};
      for(let index=0;index<1000;index++){
        configuration.save('user_preferences',prefs);
        settings.saveUserSettings('performance-owner','appearance',appearance);
        configuration.update('user_preferences',row=>row.user_id==='performance-owner',{selected_mode:'normal'});
        configuration.remove('user_preferences',row=>row.user_id==='missing-owner');
      }
      configuration.transaction(()=>configuration.save('user_preferences',prefs));
      assert.equal(writes,0);
      assert.equal(readFileSync(path,'utf8'),before);
      assert.equal(statSync(path).mtimeMs,time);
      assert.throws(()=>configuration.save('user_preferences',{...prefs,user_id:'missing-owner'}),/账户不存在/);
      assert.throws(()=>configuration.transaction(()=>configuration.update('user_preferences',()=>true,{selected_mode:'invalid'})),/偏好记录无效/);
      assert.equal(readFileSync(path,'utf8'),before);
      configuration.update('user_preferences',row=>row.user_id==='performance-owner',{selected_mode:'ai-work'});
      assert.equal(writes,0);
      assert.equal(JSON.parse(readFileSync(path,'utf8')).revision,revision+1);
      assert.equal(JSON.parse(readFileSync(path,'utf8')).preferences.selected_mode,'ai-work');
      assert.equal(Number(database.prepare('SELECT revision FROM configuration_storage_state WHERE id=1').get().revision),sqliteRevision);
      configuration.transaction(()=>{configuration.remove('user_preferences',()=>true);configuration.save('user_preferences',prefs);});
      assert.equal(writes,0);
      assert.equal(JSON.parse(readFileSync(path,'utf8')).revision,revision+2);
      assert.equal(Number(database.prepare('SELECT revision FROM configuration_storage_state WHERE id=1').get().revision),sqliteRevision);
      assert.equal(configuration.get('user_preferences',()=>true).selected_mode,'normal');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM configuration_records WHERE table_name IN ('user_settings','user_preferences')").get().count,0);
      JsonStorageBackend.prototype.write=original;
      ${close}
    `);
    run(data, `${imports}${files}
      assert.equal(configuration.get('user_preferences',row=>row.user_id==='performance-owner').selected_mode,'normal');
      ${close}
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-configuration-performance-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("会话提交不遍历其他历史索引，重复键提交、失败回滚和重启回读保持隔离", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-performance-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('session-owner',1,'session-owner','test-salt','test-hash','admin',1),('other-owner',2,'other-owner','test-salt','test-hash','member',0)").run();
      ${files}
      const first=sessions.createAiTurn('session-owner','writing',null,'索引回归');
      const other=sessions.createAiTurn('other-owner','writing',null,'其他账户');
      sessions.finishAiAssistantMessage('other-owner',other.session.id,other.assistantMessage.id,'其他账户正文','complete');
      const row=sessionRecords.get('ai_messages',first.assistantMessage.id);
      const unaffected=sessionRecords.get('ai_messages',other.assistantMessage.id);
      let scans=0;
      const indexes=[...sessionRecords.records.values()];
      for(const index of indexes){
        const iterator=index[Symbol.iterator];
        index[Symbol.iterator]=function(){scans+=1;return iterator.call(this);};
      }
      sessionRecords.commit(first.session.id,[
        {table:'ai_messages',key:row.id,value:{...row,content:'中间值'}},
        {table:'ai_messages',key:row.id,value:{...row,content:'最终值',status:'complete'}}
      ]);
      assert.equal(scans,0);
      assert.equal(sessionRecords.get('ai_messages',row.id).content,'最终值');
      assert.deepEqual(sessionRecords.get('ai_messages',other.assistantMessage.id),unaffected);
      for(const index of indexes) delete index[Symbol.iterator];
      const {JsonlSessionPersistence}=await import('lfaa-session-persistence-jsonl/src/persistence.js');
      const original=JsonlSessionPersistence.prototype.append;
      JsonlSessionPersistence.prototype.append=()=>{throw new Error('日志刷盘故障夹具');};
      assert.throws(()=>sessionRecords.commit(first.session.id,[
        {table:'ai_messages',key:row.id,value:{...row,content:'错误值一'}},
        {table:'ai_messages',key:row.id,value:{...row,content:'错误值二'}},
        {table:'ai_messages',key:'new-failure-message',value:{...row,id:'new-failure-message'}}
      ]),/日志刷盘故障/);
      assert.equal(sessionRecords.records.get('ai_messages').get(row.id).content,'最终值');
      assert.equal(sessionRecords.records.get('ai_messages').has('new-failure-message'),false);
      assert.deepEqual(sessionRecords.records.get('ai_messages').get(other.assistantMessage.id),unaffected);
      assert.throws(()=>sessionRecords.get('ai_messages',row.id),/必须重启/);
      JsonlSessionPersistence.prototype.append=original;
      ${close}
    `);
    run(data, `${imports}${files}
      const rows=sessionRecords.all('ai_messages');
      assert.ok(rows.some(row=>row.content==='最终值'));
      assert.ok(rows.some(row=>row.content==='其他账户正文'));
      assert.equal(rows.some(row=>row.content==='错误值一'||row.content==='错误值二'||row.id==='new-failure-message'),false);
      ${close}
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-performance-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("长会话展示保留最近 500 条及最新状态，不复制内部工具历史且不跨账户读取", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-session-view-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('view-owner',1,'view-owner','test-salt','test-hash','admin',1)").run();
      ${files}
      const turn=sessions.createAiTurn('view-owner','writing',null,'长会话开始');
      const changes=Array.from({length:550},(_,index)=>{
        const id='history-'+index;
        return {table:'ai_messages',key:id,value:{id,session_id:turn.session.id,_order:index+3,role:'assistant',content:'历史正文'+index,status:index===549?'queued':'complete',created_at:new Date(Date.now()+index+1000).toISOString(),activity_json:'[]',model_history:[{role:'tool',content:'内部工具历史夹具'}]}};
      });
      sessionRecords.commit(turn.session.id,changes);
      const saved=sessionRecords.records.get('ai_messages').get('history-0');
      const history=saved.model_history;
      Object.defineProperty(saved,'model_history',{configurable:true,get(){throw new Error('展示不得复制内部模型历史');}});
      const view=sessions.getAiSessionMessages('view-owner',turn.session.id);
      assert.equal(view.length,500); assert.equal(view[0].id,'history-50');
      assert.equal(view.at(-1).id,'history-549'); assert.equal(view.at(-1).status,'queued');
      assert.equal(view.some(row=>'model_history' in row),false);
      assert.equal(sessions.getAiSessionMessages('other-owner',turn.session.id),null);
      Object.defineProperty(saved,'model_history',{configurable:true,writable:true,value:history});
      assert.deepEqual(sessionRecords.get('ai_messages','history-0').model_history,history);
      ${close}
    `);
    run(data, `${imports}${files}
      assert.equal(sessionRecords.get('ai_messages','history-0').model_history[0].content,'内部工具历史夹具');
      assert.equal(sessionRecords.get('ai_messages','history-549').status,'queued');
      ${close}
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-session-view-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("旧 SQLite/JSON 用户设置迁入账户文件，SQLite 控制数据与 JSONL 会话仍可恢复", () => {
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
      // schema 仍停在 v47；用户设置文件与 Session JSONL 均由各自 Owner 管理。
      assert.equal(database.prepare('PRAGMA user_version').get().user_version,47);
      assert.ok(database.prepare('PRAGMA table_info(ai_sessions)').all().some(column=>column.name==='jsonl_revision'));
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('ai_messages','ai_usage','user_settings','ai_accounts','user_preferences')").get().count,0);
      assert.equal(configuration.get('user_preferences',row=>row.user_id==='fixture-owner').selected_mode,'ai-work');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM configuration_records WHERE table_name IN ('user_settings','user_preferences')").get().count,0);
      const {resolveUserDataPaths}=await import('lfaa-home-paths/src/data-layout.mjs');
      const {readFileSync}=await import('node:fs');
      const userSettingsPath=resolveUserDataPaths(process.env.LFAA_DATA_DIR,'fixture-owner').settingsDocument;
      assert.equal(JSON.parse(readFileSync(userSettingsPath,'utf8')).preferences.selected_mode,'ai-work');
      const saved=settings.getUserSettings('fixture-owner');
      saved.appearance.theme='dark'; saved.appearance.blur=17; saved.permissions.mode='full_access';
      settings.saveUserSettings('fixture-owner','appearance',saved.appearance);
      settings.saveUserSettings('fixture-owner','permissions',saved.permissions);
      const turn=sessions.createAiTurn('fixture-owner','writing','fixture-session','新增输入');
      sessions.finishAiAssistantMessage('fixture-owner',turn.session.id,turn.assistantMessage.id,'真实结果夹具','complete');
      sessions.recordAiUsage('fixture-owner',turn.session.id,turn.assistantMessage.id,'test-provider','test-model',2,7);
      assert.equal(sessions.getAiUsageSummary('fixture-owner').promptTokens,5);
      assert.equal(sessions.getAiUsageSummary('fixture-owner').completionTokens,12);
      // 用与当前 Owner 一致的快照模拟升级前 v31–v46 用户，再验证 v47 到用户文件的安全迁移。
      const {writeFileSync}=await import('node:fs');
      const {resolve}=await import('node:path');
      const {encode}=await import('lfaa-storage-json/src/index.js');
      const tableNames=['user_settings','user_preferences','ai_accounts','minecraft_storage_settings_defaults','minecraft_storage_node_settings','steamcmd_configuration_defaults','steamcmd_configuration_node_settings','steamcmd_storage_defaults','steamcmd_storage_node_settings'];
      const state=database.prepare('SELECT revision FROM configuration_storage_state WHERE id=1').get();
      const snapshot={version:1,revision:Number(state.revision),tables:Object.fromEntries(tableNames.map(table=>[table,configuration.all(table)])),credential_records:configuration.listCredentialRecords('fixture-owner')};
      writeFileSync(resolve(process.env.LFAA_DATA_DIR,'storages/configuration.json'),encode(snapshot));
      database.exec('DROP TABLE configuration_storage_state; DROP TABLE configuration_credentials; DROP TABLE configuration_records; PRAGMA user_version = 46;');
      ${close}
    `);
    const sourcePath = join(data, "storages", "configuration.json");
    const validSource = readFileSync(sourcePath);
    writeFileSync(sourcePath, "{迁移来源损坏");
    assert.throws(() => run(data, `${imports}${files}${close}`));
    writeFileSync(sourcePath, validSource);
    run(data, `${imports}${files}
      assert.equal(database.prepare('PRAGMA user_version').get().user_version,47);
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
    const saved = readFileSync(sourcePath);
    writeFileSync(sourcePath, "{迁移完成后的旧文件已损坏");
    run(data, `${imports}${files}
      assert.equal(settings.getUserSettings('fixture-owner').appearance.theme,'dark');
      ${close}
    `);
    writeFileSync(sourcePath, saved);
    run(data, `${imports}${files}
      assert.equal(settings.getUserSettings('fixture-owner').appearance.theme,'dark');
      ${close}
    `);
    assert.equal(readdirSync(join(data, "credentials", "storage-migration-backups")).filter(name => name.endsWith(".sqlite")).length, 1);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-file-storage-"));
    rmSync(data, { recursive: true, force: true });
  }
});

test("Provider 密文、激活事务、账户删除和 SQLite 写入失败保护", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-file-storage-"));
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('fixture-admin',1,'fixture-admin','test-salt','test-hash','admin',1),('fixture-member',2,'fixture-member','test-salt','test-hash','member',0)").run();
      const {randomBytes,createCipheriv}=await import('node:crypto');
      const {mkdirSync,rmSync,writeFileSync}=await import('node:fs');
      const {resolve}=await import('node:path');
      const {resolveUserDataPaths}=await import('lfaa-home-paths/src/data-layout.mjs');
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
      const {mkdirSync,rmSync}=await import('node:fs');
      const {resolveUserDataPaths}=await import('lfaa-home-paths/src/data-layout.mjs');
      assert.equal(settings.resolveActiveAiModelConfiguration('fixture-member').secret,'long-term-test-only-secret');
      const auth=await import('lfaa-identity-auth/src/service.js');
      auth.deleteManagedUser('fixture-admin','fixture-member');
      assert.equal(database.prepare("SELECT id FROM users WHERE id='fixture-member'").get(),undefined);
      assert.deepEqual(configuration.all('ai_accounts'),[]);
      assert.deepEqual(sessionRecords.all('ai_sessions'),[]);
      const settingsBefore=settings.getUserSettings('fixture-admin');
      const settingsPath=resolveUserDataPaths(process.env.LFAA_DATA_DIR,'fixture-admin').settingsDocument;
      mkdirSync(settingsPath,{recursive:true});
      assert.throws(()=>settings.saveUserSettings('fixture-admin','appearance',settingsBefore.appearance));
      assert.throws(()=>settings.getUserSettings('fixture-admin'),/必须重启/);
      rmSync(settingsPath,{recursive:true,force:true});
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
