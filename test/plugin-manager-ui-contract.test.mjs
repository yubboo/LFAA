import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const settings = fs.readFileSync("packages/client/app-shell/src/workbench/settings/view/SettingsPage.tsx", "utf8");
const panel = fs.readFileSync("packages/client/app-shell/src/workbench/settings/view/PluginSettingsPanel.tsx", "utf8");
const bridge = fs.readFileSync("packages/api/plugin-controller/src/plugin-manager-bridge.ts", "utf8");

test("settings exposes one plugin-and-capability management surface", () => {
  assert.match(settings, /插件与能力/);
  assert.match(settings, /PluginSettingsPanel/);
  assert.match(panel, /检查/);
  assert.match(panel, /安装完成后默认保持禁用/);
  assert.match(panel, /立即启用/);
  assert.match(panel, /允许这些构建脚本并重试/);
});

test("web plugin writes are same-origin and delegate to one PluginManager", () => {
  assert.match(bridge, /new PluginManager/);
  assert.match(bridge, /isSameOrigin/);
  assert.match(bridge, /127\.0\.0\.1/);
  assert.match(bridge, /manager\.install/);
  assert.match(bridge, /manager\.setEnabled/);
  assert.match(bridge, /manager\.remove/);
  assert.doesNotMatch(panel, /from ["']node:|import\s+.*(?:pnpm|child_process|node:fs)/);
});
