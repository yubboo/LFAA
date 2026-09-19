/**
 * 文件：settings-shell.test.mjs
 * 作用：防回归检查独立设置中心、个人中心聚焦层与三态主题交互合同。
 * 负责：静态验证 UI/App Shell 长期结构，不依赖浏览器截图。
 * 不负责：替代用户视觉验收或真实浏览器 E2E。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync("packages/app-shell/src/AgentWorkbench.tsx", "utf8");
const shellCss = fs.readFileSync("packages/app-shell/src/agent-workbench.css", "utf8");
const settings = fs.readFileSync("packages/ui/src/features/settings/SettingsPage.tsx", "utf8");
const aiPanel = fs.readFileSync("packages/ui/src/features/settings/ai/AiSettingsPanel.tsx", "utf8");
const themeMenu = fs.readFileSync("packages/ui/src/features/appearance/ThemeModeMenu.tsx", "utf8");

 test("Settings 是独立 Surface，不再替换 workbench center", () => {
  assert.match(shell, /surface === "settings"/);
  assert.match(shell, /<SettingsPage/);
  assert.doesNotMatch(shell, /center=\{surface ===/);
});

test("个人中心使用侧栏内联聚焦整体与模糊背景", () => {
  assert.match(shell, /agent-profile-overlay/);
  assert.match(shell, /agent-profile-backdrop/);
  assert.match(shell, /agent-profile-focus-shell/);
  assert.match(shell, /--agent-left-live-width/);
  assert.match(shellCss, /backdrop-filter:blur\(4px\)/);
  assert.match(shellCss, /width:calc\(var\(--agent-left-live-width,15rem\) - 1\.25rem\)/);
  assert.match(shellCss, /agent-profile-focus-shell \.agent-profile/);
});

test("个人菜单禁止固定宽度并复用底部 ProfileBar", () => {
  const userMenuCss = fs.readFileSync("packages/ui/src/features/account/user-menu.css", "utf8");
  assert.doesNotMatch(userMenuCss, /18rem/);
  assert.match(userMenuCss, /width:100%/);
  assert.ok((shell.match(/<ProfileBar/g) ?? []).length >= 2, "正常侧栏与聚焦层必须复用同一个 ProfileBar");
});

test("主题支持 system light dark 并监听系统主题", () => {
  for (const token of ["system", "light", "dark"]) assert.ok(themeMenu.includes(`\"${token}\"`));
  assert.match(shell, /prefers-color-scheme: dark/);
  assert.match(shell, /addEventListener\("change"/);
  assert.match(shell, /data-theme-preference/);
});

test("左下角保留用户按钮，并列更新和主题入口", () => {
  assert.match(shell, /agent-profile-actions/);
  const refresh = shell.indexOf('name="refresh"');
  const theme = shell.indexOf('name={themeIcon}');
  assert.ok(refresh >= 0 && theme > refresh, "更新入口必须位于主题入口左侧");
});

test("Settings 左侧导航包含 AI 服务，AI 内容仍由 ViewModel 驱动", () => {
  assert.match(settings, /AI 服务/);
  assert.match(settings, /AiSettingsPanel/);
  assert.match(settings, /返回应用/);
  assert.doesNotMatch(aiPanel, /https?:\/\//);
  assert.doesNotMatch(aiPanel, /fetch\s*\(/);
});
