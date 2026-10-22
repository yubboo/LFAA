/** 功能：回归共享默认值与严格保存。作用：验证双端一致、非法写入不落盘和偏好重启保留。关联文件：values/settings-contract.ts、settings/service.ts、validation.ts。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("所有分类共享默认值，直接保存拒绝非法值且重启不重置偏好", () => {
  const parent = resolve(cli, "../../dist/.tmp"); mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-settings-contract-"));
  const imports = `
    import assert from 'node:assert/strict';
    const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
    const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
    const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
    const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');retireLegacyFileTables();
    const {getUserSettings,saveUserSettings,defaultSettings}=await import('lfaa-settings/src/service.js');
    const {DEFAULT_USER_SETTINGS,CARD_MOTION_EFFECT_OPTIONS,UI_MOTION_EFFECT_OPTIONS}=await import('lfaa-util-values/src/settings-contract.js');
    const close=()=>{sessionRecords.close();configuration.close();closeDatabase();};
  `;
  const run = source => execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", imports + source], {
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_HOME: join(data, "home"), LFAA_DATA_DIR: join(data, "data"), JWT_SECRET: "", LFAA_HARNESS_HOME: "" }, encoding: "utf8", stdio: "pipe", timeout: 30_000
  });
  try {
    run(`
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES('settings-a','settings-a','salt','hash','admin')").run();
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES('settings-b','settings-b','salt','hash','member')").run();
      const {DEFAULT_USER_SETTINGS:clientDefaults}=await import('lfaa-client-ui-settings-general/src/default-settings.js');
      const {settingsSchemas,validateSettingsInput}=await import('lfaa-settings/src/validation.js');
      assert.deepEqual(defaultSettings,DEFAULT_USER_SETTINGS);assert.deepEqual(clientDefaults,DEFAULT_USER_SETTINGS);
      assert.equal(defaultSettings.general.defaultMode,"ai-work","新账户默认进入小鱼工作台");
      assert.equal(defaultSettings.general.defaultStandaloneChat,true,"默认首页固定为小鱼对话区");
      assert.equal(defaultSettings.general.notificationPopupsEnabled,true,"通知总开关默认开启");
      assert.deepEqual(defaultSettings.general.hiddenApplicationNavigationIds,[],"新账户默认显示全部内置应用入口");
      assert.equal(defaultSettings.general.aiProviderReminderEnabled,true,"AI Provider 提醒默认开启");
      assert.equal(defaultSettings.general.setupReminderEnabled,true,"业务内容存储提醒默认开启");
      assert.equal(defaultSettings.aiRuntime.maxOutputTokens,0,"新账户默认跟随所选模型输出能力");
      assert.equal(defaultSettings.appearance.overlay,65,"新账户的默认壁纸表面遮罩保证卡片可读性");
      assert.equal(defaultSettings.appearance.advanced.authTransitionPluginId,"builtin","新账户默认使用 LFAA 内置登录进入动画");
      assert.equal(defaultSettings.general.cardMotionEffect,"fluid","新账户默认使用柔和流体卡片动效");
      assert.equal(defaultSettings.general.dialogMotionEffect,"fluid","新账户默认使用柔和流体弹窗动效");
      assert.deepEqual(defaultSettings.plugins.disabledSkillNames,[],'新账户默认没有停用 Skill');
      assert.deepEqual(CARD_MOTION_EFFECT_OPTIONS.map(({id})=>id),["fluid","fade","lift","none"]);
      clientDefaults.appearance.advanced.contrast=75;assert.notEqual(defaultSettings.appearance.advanced.contrast,75);
      for(const [category,key] of Object.entries({'general':'general','appearance':'appearance','shortcuts':'shortcuts','ai-runtime':'aiRuntime','minecraft-runtime':'minecraftRuntime','git':'git','permissions':'permissions','plugins':'plugins','personalization':'personalization','computer-control':'computerControl','browser-use':'browserUse'})){
        assert.equal(settingsSchemas[category].validate(DEFAULT_USER_SETTINGS[key],{convert:false}).error,undefined);
        saveUserSettings('settings-a',category,structuredClone(DEFAULT_USER_SETTINGS[key]));
      }
      const before=getUserSettings('settings-a');
      assert.equal(before.browserUse.enabled,false,'new accounts keep Agent browser control disabled');
      assert.deepEqual(before.browserUse.enabledProviderIds,[],'new accounts connect no browser by default');
      assert.equal(before.browserUse.recordRecentSites,true,'recent-site recording follows the shared account default');
      assert.equal(settingsSchemas['browser-use'].validate({...before.browserUse,enabledProviderIds:['lfaa-managed-edge']},{convert:false}).error,undefined);
      assert.ok(settingsSchemas['browser-use'].validate({...before.browserUse,enabledProviderIds:['unknown-browser']},{convert:false}).error,'browser connection IDs come from the shared provider catalog');
      assert.ok(settingsSchemas['browser-use'].validate({...before.browserUse,enabledProviderIds:['lfaa-managed-edge','lfaa-managed-edge']},{convert:false}).error,'duplicate browser connections are rejected');
      saveUserSettings('settings-a','browser-use',{enabled:true,enabledProviderIds:['lfaa-managed-edge'],showFullUrl:true,recordRecentSites:false});
      assert.deepEqual(getUserSettings('settings-a').browserUse,{enabled:true,enabledProviderIds:['lfaa-managed-edge'],showFullUrl:true,recordRecentSites:false,searchEngine:'bing'},'Browser Use preferences persist per account');
      const legacyBrowserPayload={enabled:true,enabledProviderIds:['lfaa-managed-edge'],showFullUrl:false};
      saveUserSettings('settings-a','browser-use',legacyBrowserPayload);
      assert.equal(getUserSettings('settings-a').browserUse.recordRecentSites,false,'older clients cannot reset the recent-site preference');
      assert.equal(getUserSettings('settings-b').browserUse.enabled,false,'another account keeps its disabled browser default');
      saveUserSettings('settings-a','browser-use',structuredClone(DEFAULT_USER_SETTINGS.browserUse));
      for(const {id} of UI_MOTION_EFFECT_OPTIONS){
        assert.equal(settingsSchemas.general.validate({...before.general,cardMotionEffect:id},{convert:false}).error,undefined);
        assert.equal(settingsSchemas.general.validate({...before.general,dialogMotionEffect:id},{convert:false}).error,undefined);
      }
      assert.throws(()=>saveUserSettings('settings-a','permissions',{...before.permissions,mode:'invalid'}),/格式/);
      assert.throws(()=>saveUserSettings('settings-a','general',{...before.general,unknown:true}),/格式/);
      assert.throws(()=>validateSettingsInput('__proto__',{}),/分类/);
      const hiddenApplicationsPayload={...before.general,hiddenApplicationNavigationIds:['minecraft','writing']};
      assert.equal(settingsSchemas.general.validate(hiddenApplicationsPayload,{convert:false}).error,undefined,'应用菜单只接受登记的内置入口 ID');
      assert.ok(settingsSchemas.general.validate({...before.general,hiddenApplicationNavigationIds:['not-an-app']},{convert:false}).error,'应用入口名单拒绝未登记 ID');
      assert.ok(settingsSchemas.general.validate({...before.general,hiddenApplicationNavigationIds:['minecraft','minecraft']},{convert:false}).error,'应用入口名单拒绝重复项');
      saveUserSettings('settings-a','general',hiddenApplicationsPayload);
      assert.deepEqual(getUserSettings('settings-a').general.hiddenApplicationNavigationIds,['minecraft','writing'],'内置应用可见性按账户持久化');
      const legacyApplicationPayload={...getUserSettings('settings-a').general};delete legacyApplicationPayload.hiddenApplicationNavigationIds;
      saveUserSettings('settings-a','general',legacyApplicationPayload);
      assert.deepEqual(getUserSettings('settings-a').general.hiddenApplicationNavigationIds,['minecraft','writing'],'旧客户端保存其他常规项不会重置应用菜单选择');
      const expectedWithApplicationVisibility=structuredClone(before);expectedWithApplicationVisibility.general.hiddenApplicationNavigationIds=['minecraft','writing'];
      assert.deepEqual(getUserSettings('settings-a'),expectedWithApplicationVisibility);
      assert.equal(settingsSchemas.plugins.validate({...before.plugins,disabledSkillNames:['runtime-fixture']},{convert:false}).error,undefined,'Skill 停用名单接受规范名称');
      assert.ok(settingsSchemas.plugins.validate({...before.plugins,disabledSkillNames:['../escape']},{convert:false}).error,'Skill 名称不能包含路径');
      assert.ok(settingsSchemas.plugins.validate({...before.plugins,disabledSkillNames:['runtime-fixture','runtime-fixture']},{convert:false}).error,'Skill 停用名单必须唯一');
      saveUserSettings('settings-a','plugins',{...before.plugins,disabledSkillNames:['runtime-fixture']});
      const legacyPluginPayload={...getUserSettings('settings-a').plugins};delete legacyPluginPayload.disabledSkillNames;
      saveUserSettings('settings-a','plugins',legacyPluginPayload);
      assert.deepEqual(getUserSettings('settings-a').plugins.disabledSkillNames,['runtime-fixture'],'旧客户端省略新字段不能清除已保存的 Skill 停用项');
      saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,cardMotionEffect:"lift",dialogMotionEffect:"fade"});
      const clientWithoutDialogEffect={...getUserSettings('settings-a').general};delete clientWithoutDialogEffect.dialogMotionEffect;
      saveUserSettings('settings-a','general',clientWithoutDialogEffect);
      assert.equal(getUserSettings('settings-a').general.dialogMotionEffect,"fade","只认识卡片动效的旧客户端不能重置弹窗动效");
      const clientWithoutCardEffect={...getUserSettings('settings-a').general};delete clientWithoutCardEffect.cardMotionEffect;
      saveUserSettings('settings-a','general',clientWithoutCardEffect);
      assert.equal(getUserSettings('settings-a').general.cardMotionEffect,"lift","只认识弹窗动效的旧客户端不能重置卡片动效");
      const legacyClientPayload={...getUserSettings('settings-a').general};delete legacyClientPayload.cardMotionEffect;delete legacyClientPayload.dialogMotionEffect;
      saveUserSettings('settings-a','general',legacyClientPayload);
      assert.equal(getUserSettings('settings-a').general.cardMotionEffect,"lift","旧客户端保存其他常规项时保留新动效选择");
      assert.equal(getUserSettings('settings-a').general.dialogMotionEffect,"fade","旧客户端保存其他常规项时保留弹窗动效选择");
      assert.throws(()=>saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,cardMotionEffect:"jelly"}),/格式/);
      assert.throws(()=>saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,dialogMotionEffect:"jelly"}),/格式/);
      saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,defaultMode:"normal",defaultStandaloneChat:false});
      assert.equal(getUserSettings('settings-a').general.defaultMode,"normal","固定首页不覆盖账户原有模式偏好");
      assert.equal(getUserSettings('settings-a').general.defaultStandaloneChat,false,"固定首页不覆盖账户原有独立会话偏好");
      saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,notificationPopupsEnabled:false});
      const legacyNotificationPayload={...getUserSettings('settings-a').general};delete legacyNotificationPayload.notificationPopupsEnabled;
      saveUserSettings('settings-a','general',legacyNotificationPayload);
      assert.equal(getUserSettings('settings-a').general.notificationPopupsEnabled,false,"旧客户端缺失总开关字段时保留已保存的关闭状态");
      assert.throws(()=>saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,notificationPopupsEnabled:"false"}),/格式/);
      assert.throws(()=>saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,aiProviderReminderEnabled:"false"}),/格式/);
      const legacyStoredPayload={...getUserSettings('settings-a').general};delete legacyStoredPayload.cardMotionEffect;delete legacyStoredPayload.dialogMotionEffect;
      delete legacyStoredPayload.notificationPopupsEnabled;
      delete legacyStoredPayload.aiProviderReminderEnabled;
      legacyStoredPayload.setupReminderEnabled=false;
      configuration.save('user_settings',{user_id:'settings-a',category:'general',value_json:JSON.stringify(legacyStoredPayload)});
      assert.equal(getUserSettings('settings-a').general.cardMotionEffect,"fluid","旧账户缺字段时回落到共享默认动效");
      assert.equal(getUserSettings('settings-a').general.dialogMotionEffect,"fluid","旧账户缺字段时回落到共享弹窗默认动效");
      assert.equal(getUserSettings('settings-a').general.notificationPopupsEnabled,true,"旧账户缺少通知总开关时采用默认开启");
      assert.equal(getUserSettings('settings-a').general.setupReminderEnabled,false,"旧账户保留既有业务存储提醒关闭偏好");
      assert.equal(getUserSettings('settings-a').general.aiProviderReminderEnabled,false,"旧账户缺少 AI 提醒字段时沿用既有提醒偏好");
      saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,aiProviderReminderEnabled:true});
      saveUserSettings('settings-a','appearance',{...before.appearance,overlay:42,updateSurfaceOpacity:85,advanced:{...before.appearance.advanced,contrast:75,reducedMotion:'on'}});
      const legacyAppearance={...getUserSettings('settings-a').appearance,advanced:{...getUserSettings('settings-a').appearance.advanced}};delete legacyAppearance.advanced.authTransitionPluginId;
      configuration.save('user_settings',{user_id:'settings-a',category:'appearance',value_json:JSON.stringify(legacyAppearance)});
      const migratedAppearance=getUserSettings('settings-a').appearance;
      assert.equal(migratedAppearance.advanced.authTransitionPluginId,"builtin","旧账户补充内置动画默认值");
      assert.equal(migratedAppearance.advanced.contrast,75,"兼容动画字段时保留已保存的外观对比度");
      assert.equal(migratedAppearance.overlay,42,"兼容动画字段时保留已保存的遮罩偏好");
      saveUserSettings('settings-a','appearance',{...migratedAppearance,advanced:{...migratedAppearance.advanced,authTransitionPluginId:"user-animation/auth-entry"}});
      saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,cardMotionEffect:"fade",dialogMotionEffect:"lift"});
      saveUserSettings('settings-a','ai-runtime',{...before.aiRuntime,commandTimeoutSeconds:0});close();
    `);
    run(`const saved=getUserSettings('settings-a');assert.equal(saved.appearance.advanced.contrast,75);assert.equal(saved.appearance.advanced.reducedMotion,'on');assert.equal(saved.appearance.advanced.authTransitionPluginId,"user-animation/auth-entry");assert.equal(saved.appearance.overlay,42,'显式保存的旧遮罩偏好不被默认值更改覆盖');assert.equal(saved.appearance.updateSurfaceOpacity,85);assert.equal(saved.general.cardMotionEffect,"fade");assert.equal(saved.general.dialogMotionEffect,"lift");assert.deepEqual(saved.general.hiddenApplicationNavigationIds,['minecraft','writing'],'内置应用开关重启后保留');assert.equal(saved.general.defaultMode,"normal");assert.equal(saved.general.defaultStandaloneChat,false);assert.equal(saved.general.aiProviderReminderEnabled,true,'AI Provider 提醒偏好重启后保留');assert.equal(saved.general.setupReminderEnabled,false,'业务存储提醒偏好重启后保留');assert.deepEqual(saved.plugins.disabledSkillNames,['runtime-fixture'],'Skill 停用偏好重启后保留');assert.equal(getUserSettings('settings-b').general.cardMotionEffect,"fluid");assert.equal(getUserSettings('settings-b').general.dialogMotionEffect,"fluid");assert.equal(saved.aiRuntime.commandTimeoutSeconds,0);close();`);
  } finally { assert.equal(dirname(data), parent); rmSync(data, { recursive: true, force: true }); }
});
