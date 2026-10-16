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
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, JWT_SECRET: "", LFAA_HARNESS_HOME: "" }, encoding: "utf8", stdio: "pipe", timeout: 30_000
  });
  try {
    run(`
      database.prepare("INSERT INTO users(id,username,password_salt,password_hash,role) VALUES('settings-a','settings-a','salt','hash','admin')").run();
      const {DEFAULT_USER_SETTINGS:clientDefaults}=await import('lfaa-client-ui-settings-general/src/default-settings.js');
      const {settingsSchemas,validateSettingsInput}=await import('lfaa-settings/src/validation.js');
      assert.deepEqual(defaultSettings,DEFAULT_USER_SETTINGS);assert.deepEqual(clientDefaults,DEFAULT_USER_SETTINGS);
      assert.equal(defaultSettings.general.defaultMode,"ai-work","新账户默认进入小鱼工作台");
      assert.equal(defaultSettings.general.defaultStandaloneChat,true,"默认首页固定为小鱼对话区");
      assert.equal(defaultSettings.aiRuntime.maxOutputTokens,0,"新账户默认跟随所选模型输出能力");
      assert.equal(defaultSettings.general.cardMotionEffect,"fluid","新账户默认使用柔和流体卡片动效");
      assert.equal(defaultSettings.general.dialogMotionEffect,"fluid","新账户默认使用柔和流体弹窗动效");
      assert.deepEqual(CARD_MOTION_EFFECT_OPTIONS.map(({id})=>id),["fluid","fade","lift","none"]);
      clientDefaults.appearance.advanced.contrast=75;assert.notEqual(defaultSettings.appearance.advanced.contrast,75);
      for(const [category,key] of Object.entries({'general':'general','appearance':'appearance','shortcuts':'shortcuts','ai-runtime':'aiRuntime','minecraft-runtime':'minecraftRuntime','git':'git','permissions':'permissions','plugins':'plugins','personalization':'personalization','computer-control':'computerControl'})){
        assert.equal(settingsSchemas[category].validate(DEFAULT_USER_SETTINGS[key],{convert:false}).error,undefined);
        saveUserSettings('settings-a',category,structuredClone(DEFAULT_USER_SETTINGS[key]));
      }
      const before=getUserSettings('settings-a');
      for(const {id} of UI_MOTION_EFFECT_OPTIONS){
        assert.equal(settingsSchemas.general.validate({...before.general,cardMotionEffect:id},{convert:false}).error,undefined);
        assert.equal(settingsSchemas.general.validate({...before.general,dialogMotionEffect:id},{convert:false}).error,undefined);
      }
      assert.throws(()=>saveUserSettings('settings-a','permissions',{...before.permissions,mode:'invalid'}),/格式/);
      assert.throws(()=>saveUserSettings('settings-a','general',{...before.general,unknown:true}),/格式/);
      assert.throws(()=>validateSettingsInput('__proto__',{}),/分类/);
      assert.deepEqual(getUserSettings('settings-a'),before);
      saveUserSettings('settings-a','general',{...before.general,cardMotionEffect:"lift",dialogMotionEffect:"fade"});
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
      const legacyStoredPayload={...getUserSettings('settings-a').general};delete legacyStoredPayload.cardMotionEffect;delete legacyStoredPayload.dialogMotionEffect;
      configuration.save('user_settings',{user_id:'settings-a',category:'general',value_json:JSON.stringify(legacyStoredPayload)});
      assert.equal(getUserSettings('settings-a').general.cardMotionEffect,"fluid","旧账户缺字段时回落到共享默认动效");
      assert.equal(getUserSettings('settings-a').general.dialogMotionEffect,"fluid","旧账户缺字段时回落到共享弹窗默认动效");
      saveUserSettings('settings-a','appearance',{...before.appearance,updateSurfaceOpacity:85,advanced:{...before.appearance.advanced,contrast:75,reducedMotion:'on'}});
      saveUserSettings('settings-a','general',{...getUserSettings('settings-a').general,cardMotionEffect:"fade",dialogMotionEffect:"lift"});
      saveUserSettings('settings-a','ai-runtime',{...before.aiRuntime,commandTimeoutSeconds:0});close();
    `);
    run(`const saved=getUserSettings('settings-a');assert.equal(saved.appearance.advanced.contrast,75);assert.equal(saved.appearance.advanced.reducedMotion,'on');assert.equal(saved.appearance.updateSurfaceOpacity,85);assert.equal(saved.general.cardMotionEffect,"fade");assert.equal(saved.general.dialogMotionEffect,"lift");assert.equal(saved.general.defaultMode,"normal");assert.equal(saved.general.defaultStandaloneChat,false);assert.equal(getUserSettings('settings-b').general.cardMotionEffect,"fluid");assert.equal(getUserSettings('settings-b').general.dialogMotionEffect,"fluid");assert.equal(saved.aiRuntime.commandTimeoutSeconds,0);close();`);
  } finally { assert.equal(dirname(data), parent); rmSync(data, { recursive: true, force: true }); }
});
