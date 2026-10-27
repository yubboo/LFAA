/** 功能：长期回归账户外观预设合同。作用：检查默认值不变、严格快照校验、原子跨分类恢复与账户背景隔离。关联文件：util/values/settings-contract.ts、settings/settings/src/service.ts、settings/settings/src/validation.ts。 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "appearance-presets");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const settings = await import("lfaa-settings/src/service.js");
const { appearancePresetSnapshotSchema, appearanceSettingsSchema } = await import("lfaa-settings/src/validation.js");
const { BUILTIN_APPEARANCE_PRESETS, createAppearancePresetSnapshot } = await import("lfaa-util-values/src/appearance-presets.js");
const { DEFAULT_USER_SETTINGS } = await import("lfaa-util-values/src/settings-contract.js");

const owner = randomUUID();
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,1,'appearance-preset-fixture','fixture','fixture','admin',1)").run(owner);

test("内置预设只提供快照，不修改 Appearance 共享默认值", () => {
  assert.equal(DEFAULT_USER_SETTINGS.appearance.presets.length, 0);
  assert.deepEqual(BUILTIN_APPEARANCE_PRESETS[0]?.snapshot, createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS));
  assert.equal(BUILTIN_APPEARANCE_PRESETS.length >= 4, true);
  assert.deepEqual(DEFAULT_USER_SETTINGS.appearance.backgrounds, {
    login: "none", appCenter: "none", steamcmd: "none", minecraft: "none", writing: "none", settings: "none"
  });
});

test("自定义预设通过 Appearance Owner 账户保存；应用精确恢复外观和布局且保留其他偏好", () => {
  const initial = settings.getUserSettings(owner);
  assert.deepEqual(initial.appearance.presets, []);
  const changed = structuredClone(initial);
  changed.appearance.theme = "dark";
  changed.appearance.accentColor = "#27845b";
  changed.appearance.backgrounds.appCenter = "forest-bridge-evening";
  changed.appearance.areaEffects.settings = { overlay: 17, blur: 9 };
  changed.appearance.advanced.interfaceFontSize = 17;
  changed.general.navigationLayout = "focus";
  changed.general.cardMotionEffect = "none";
  changed.general.terminalPosition = "right";
  changed.general.language = "en-US";
  changed.general.taskFolder = "C:\\appearance-preset-fixture";
  changed.general.notificationPopupsEnabled = false;
  const snapshot = createAppearancePresetSnapshot(changed);
  const preset = { id: `preset-${randomUUID()}`, name: "夜间专注", description: "测试账户自定义方案。", snapshot };
  settings.saveUserSettings(owner, "appearance", { ...changed.appearance, presets: [preset] });
  settings.saveUserSettings(owner, "general", changed.general);

  const beforeApply = settings.getUserSettings(owner);
  const result = settings.applyUserAppearancePreset(owner, BUILTIN_APPEARANCE_PRESETS.find(item => item.id === "builtin-standard").snapshot);
  assert.equal(result.appearance.theme, "system");
  assert.equal(result.general.navigationLayout, "three-column");
  assert.equal(result.general.cardMotionEffect, "fluid");
  assert.deepEqual(result.appearance.presets, beforeApply.appearance.presets, "应用内置方案保留账户自定义预设库");
  assert.equal(result.general.language, "en-US", "非视觉 General 字段不被覆盖");
  assert.equal(result.general.taskFolder, "C:\\appearance-preset-fixture");
  assert.equal(result.general.notificationPopupsEnabled, false);

  const restored = settings.applyUserAppearancePreset(owner, snapshot);
  assert.deepEqual(createAppearancePresetSnapshot(restored), snapshot, "主题、所有外观细节和布局字段逐项恢复");
  assert.deepEqual(restored.appearance.presets, beforeApply.appearance.presets);
  assert.equal(restored.general.language, "en-US");
  assert.equal(restored.general.taskFolder, "C:\\appearance-preset-fixture");
  assert.equal(restored.general.notificationPopupsEnabled, false);
});

test("预设快照严格校验字段范围、数值和上传背景账户归属", () => {
  const snapshot = BUILTIN_APPEARANCE_PRESETS[0].snapshot;
  assert.equal(appearancePresetSnapshotSchema.validate(snapshot, { convert: false }).error, undefined);
  assert.notEqual(appearancePresetSnapshotSchema.validate({ ...snapshot, permissions: { mode: "full_access" } }, { convert: false }).error, undefined);
  assert.notEqual(appearancePresetSnapshotSchema.validate({ ...snapshot, appearance: { ...snapshot.appearance, areaEffects: { ...snapshot.appearance.areaEffects, login: { overlay: 76 } } } }, { convert: false }).error, undefined);
  assert.notEqual(appearanceSettingsSchema.validate({ ...DEFAULT_USER_SETTINGS.appearance, presets: Array.from({ length: 21 }, (_, index) => ({ id: `preset-${randomUUID()}`, name: `预设${index}`, description: "越界", snapshot })) }, { convert: false }).error, undefined);

  const foreignBackgroundSnapshot = structuredClone(snapshot);
  foreignBackgroundSnapshot.appearance.backgrounds.appCenter = `user-${randomUUID()}`;
  assert.equal(settings.validateAppearancePresetSnapshot(foreignBackgroundSnapshot).appearance.backgrounds.appCenter, foreignBackgroundSnapshot.appearance.backgrounds.appCenter, "导入前的结构校验允许源账户私有 ID，待素材重新上传后再做当前账户归属校验");
  assert.throws(() => settings.validateUserAppearancePresetSnapshot(owner, foreignBackgroundSnapshot), /当前账户没有的背景图片/u);
  assert.throws(() => settings.applyUserAppearancePreset(owner, foreignBackgroundSnapshot), /当前账户没有的背景图片/u);
  const loginUploadSnapshot = structuredClone(snapshot);
  loginUploadSnapshot.appearance.backgrounds.login = `user-${randomUUID()}`;
  assert.throws(() => settings.applyUserAppearancePreset(owner, loginUploadSnapshot), /登录页预设背景只能使用内置图片/u);
});

test("账户背景在当前外观或自定义预设引用时保持受保护", () => {
  const current = settings.getUserSettings(owner);
  const backgroundId = `user-${randomUUID()}`;
  const snapshot = structuredClone(BUILTIN_APPEARANCE_PRESETS[0].snapshot);
  snapshot.appearance.backgrounds.settings = backgroundId;
  current.appearance.presets = [{ id: `preset-${randomUUID()}`, name: "背景保护", description: "回归。", snapshot }];
  settings.saveUserSettings(owner, "appearance", current.appearance);
  assert.equal(settings.isUserBackgroundInUse(owner, backgroundId), true);

  current.appearance.presets = [];
  current.appearance.backgrounds.settings = backgroundId;
  settings.saveUserSettings(owner, "appearance", current.appearance);
  assert.equal(settings.isUserBackgroundInUse(owner, backgroundId), true);

  current.appearance.backgrounds.settings = "none";
  settings.saveUserSettings(owner, "appearance", current.appearance);
  assert.equal(settings.isUserBackgroundInUse(owner, backgroundId), false);
});
