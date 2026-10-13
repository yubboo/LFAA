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
    const {DEFAULT_USER_SETTINGS}=await import('lfaa-util-values/src/settings-contract.js');
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
      assert.equal(defaultSettings.aiRuntime.maxOutputTokens,0,"新账户默认跟随所选模型输出能力");
      clientDefaults.appearance.advanced.contrast=75;assert.notEqual(defaultSettings.appearance.advanced.contrast,75);
      for(const [category,key] of Object.entries({'general':'general','appearance':'appearance','shortcuts':'shortcuts','ai-runtime':'aiRuntime','minecraft-runtime':'minecraftRuntime','git':'git','permissions':'permissions','plugins':'plugins','personalization':'personalization','computer-control':'computerControl'})){
        assert.equal(settingsSchemas[category].validate(DEFAULT_USER_SETTINGS[key],{convert:false}).error,undefined);
        saveUserSettings('settings-a',category,structuredClone(DEFAULT_USER_SETTINGS[key]));
      }
      const before=getUserSettings('settings-a');
      assert.throws(()=>saveUserSettings('settings-a','permissions',{...before.permissions,mode:'invalid'}),/格式/);
      assert.throws(()=>saveUserSettings('settings-a','general',{...before.general,unknown:true}),/格式/);
      assert.throws(()=>validateSettingsInput('__proto__',{}),/分类/);
      assert.deepEqual(getUserSettings('settings-a'),before);
      saveUserSettings('settings-a','appearance',{...before.appearance,updateSurfaceOpacity:85,advanced:{...before.appearance.advanced,contrast:75,reducedMotion:'on'}});
      saveUserSettings('settings-a','ai-runtime',{...before.aiRuntime,commandTimeoutSeconds:0});close();
    `);
    run(`const saved=getUserSettings('settings-a');assert.equal(saved.appearance.advanced.contrast,75);assert.equal(saved.appearance.advanced.reducedMotion,'on');assert.equal(saved.appearance.updateSurfaceOpacity,85);assert.equal(saved.aiRuntime.commandTimeoutSeconds,0);close();`);
  } finally { assert.equal(dirname(data), parent); rmSync(data, { recursive: true, force: true }); }
});
