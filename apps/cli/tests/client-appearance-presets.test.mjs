/** 功能：长期回归外观预设 Client 快照与页签布局。作用：锁定快照白名单、原有偏好保留、页签可访问性和容器响应式。关联文件：client/ui-settings/src/SettingsPage.tsx、AppearancePresetsPanel.tsx、SettingsPage.css。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyAppearancePresetSnapshot, createAppearancePresetSnapshot } from "lfaa-util-values/src/appearance-presets.js";
import { DEFAULT_USER_SETTINGS } from "lfaa-util-values/src/settings-contract.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("外观快照只收集外观与常规视觉布局，并保留非视觉设置及预设库", () => {
  const current = structuredClone(DEFAULT_USER_SETTINGS);
  current.general.language = "en-US";
  current.general.taskFolder = "C:\\client-appearance-presets";
  current.general.notificationPopupsEnabled = false;
  current.appearance.presets = [{ id: "preset-fixture", name: "保留", description: "已保存", snapshot: createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS) }];
  const snapshot = createAppearancePresetSnapshot(current);
  assert.deepEqual(Object.keys(snapshot.general), ["defaultFullView", "showServiceStatus", "showBottomPanelControl", "navigationLayout", "hiddenApplicationNavigationIds", "cardMotionEffect", "dialogMotionEffect", "terminalPosition"]);
  assert.equal(Object.hasOwn(snapshot.appearance, "presets"), false);

  snapshot.general.navigationLayout = "focus";
  snapshot.appearance.theme = "dark";
  const applied = applyAppearancePresetSnapshot(current, snapshot);
  assert.equal(applied.general.navigationLayout, "focus");
  assert.equal(applied.appearance.theme, "dark");
  assert.equal(applied.general.language, "en-US");
  assert.equal(applied.general.taskFolder, "C:\\client-appearance-presets");
  assert.equal(applied.general.notificationPopupsEnabled, false);
  assert.deepEqual(applied.appearance.presets, current.appearance.presets);
});

test("外观预设页签可键盘操作，预设卡片和设置面板按设置容器响应", () => {
  const page = readFileSync(resolve(repo, "packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");
  const panel = readFileSync(resolve(repo, "packages/client/ui-settings/src/AppearancePresetsPanel.tsx"), "utf8");
  const styles = readFileSync(resolve(repo, "packages/client/ui-settings/src/SettingsPage.css"), "utf8");
  assert.match(page, /role="tablist" aria-label="外观设置页签"[\s\S]*?ArrowRight[\s\S]*?ArrowLeft/u);
  assert.match(page, /id="appearance-presets-panel" role="tabpanel" aria-labelledby="appearance-presets-tab"/u);
  assert.match(page, /id="appearance-settings-panel" role="tabpanel" aria-labelledby="appearance-settings-tab"/u);
  assert.match(panel, /aria-pressed=\{active\}/u);
  assert.match(panel, /保存当前外观/u);
  assert.match(panel, /另存为我的预设，原预设不会被覆盖/u);
  assert.match(panel, /preset\.id === "builtin-standard" \? "恢复默认"/u);
  assert.match(styles, /\.appearance-presets-grid\s*\{[\s\S]*?repeat\(auto-fit,\s*minmax\(min\(100%,\s*17rem\),\s*1fr\)\)/u);
  assert.match(styles, /@container settings-main \(max-width: 620px\)[\s\S]*?\.appearance-presets-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.doesNotMatch(styles, /display:\s*inline-block/u);
});
