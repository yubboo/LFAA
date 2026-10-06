import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_USER_SETTINGS, resolveAppearanceBackgrounds, resolveShortcutSettings } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { appearanceBackgroundSlotForRoute } from "lfaa-client-ui-layout/src/appearance-background-slot.js";
import { getClientRenderErrorSummary } from "lfaa-client-ui-renderer/src/render-error-summary.js";

test("快捷键兼容补齐缺失设置并保留用户主动清空的数组", () => {
  const defaults = DEFAULT_USER_SETTINGS.shortcuts;
  const resolved = resolveShortcutSettings({
    toggleSidebar: ["Ctrl+M"],
    openSideChat: []
  });

  assert.deepEqual(resolved.toggleSidebar, ["Ctrl+M"]);
  assert.deepEqual(resolved.openSideChat, []);
  assert.deepEqual(resolved.toggleContextPanel, defaults.toggleContextPanel);
  assert.deepEqual(resolveShortcutSettings(undefined), defaults);
  assert.deepEqual(resolveShortcutSettings(null).switchNormalMode, defaults.switchNormalMode);
});

test("快捷键兼容拒绝非字符串项但不改动其它设置", () => {
  const resolved = resolveShortcutSettings({ toggleSidebar: ["Ctrl+M", 42] });

  assert.deepEqual(resolved.toggleSidebar, DEFAULT_USER_SETTINGS.shortcuts.toggleSidebar);
  assert.deepEqual(resolved.openSideChat, DEFAULT_USER_SETTINGS.shortcuts.openSideChat);
});

test("缺失外观背景回退到现有默认值并保留合法选择", () => {
  const defaults = DEFAULT_USER_SETTINGS.appearance.backgrounds;
  const resolved = resolveAppearanceBackgrounds({ appCenter: "none", minecraft: "user-saved-room" });

  assert.equal(resolved.appCenter, "none");
  assert.equal(resolved.minecraft, "user-saved-room");
  assert.equal(resolved.steamcmd, defaults.steamcmd);
  assert.equal(resolveAppearanceBackgrounds({ appCenter: undefined }).appCenter, defaults.appCenter);
  assert.deepEqual(resolveAppearanceBackgrounds(null), defaults);
});

test("联机常规模式复用应用中心背景槽且 Minecraft 继续使用自身背景", () => {
  assert.equal(appearanceBackgroundSlotForRoute("/apps/connectivity/normal"), "appCenter");
  assert.equal(appearanceBackgroundSlotForRoute("/apps/connectivity/ai-work"), "appCenter");
  assert.equal(appearanceBackgroundSlotForRoute("/apps/minecraft/normal"), "minecraft");
});

test("客户端错误摘要保留异常类型并隐藏路径、链接和凭据样式值", () => {
  const summary = getClientRenderErrorSummary(new TypeError("Cannot read token=abc123 at C:\\Users\\yu\\app.js from https://example.test/a?q=secret"));

  assert.match(summary, /^TypeError: Cannot read token=\[已隐藏\]/u);
  assert.doesNotMatch(summary, /abc123|C:\\Users|https:\/\/|secret/u);
  assert.equal(getClientRenderErrorSummary("render failed"), "Error: render failed");
});

test("客户端错误摘要限制长度且不读取堆栈", () => {
  const error = new Error("x".repeat(500));
  error.stack = "secret stack";
  const summary = getClientRenderErrorSummary(error);

  assert.ok(summary.length <= 250);
  assert.doesNotMatch(summary, /secret stack/u);
});
