/** 功能：锁定浏览器设置页与真实 Browser Owner 的能力接线。作用：防止清单设置只停留在无效 UI。关联文件：packages/client/ui-settings/src/SettingsPage.tsx、browser-use、browser-controller。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const settingsPage = readFileSync(resolve(import.meta.dirname, "../../../packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");
const settingsCss = readFileSync(resolve(import.meta.dirname, "../../../packages/client/ui-settings/src/SettingsPage.css"), "utf8");
const browserTools = readFileSync(resolve(import.meta.dirname, "../../../packages/browser-use/browser-use/src/browser-tools.ts"), "utf8");
const browserController = readFileSync(resolve(import.meta.dirname, "../../../packages/api/browser-controller/src/index.ts"), "utf8");
const nativeBrowser = readFileSync(resolve(import.meta.dirname, "../../../apps/desktop-electron/src/native-browser-workspace.mjs"), "utf8");
const browserSessionManager = readFileSync(resolve(import.meta.dirname, "../../../packages/browser-use/browser-use/src/session-manager.ts"), "utf8");

test("native browser Agent integration reports source wiring and keeps the existing explicit provider opt-in", () => {
  assert.match(settingsPage, /Agent 浏览器控制开启后会自动复用当前选中标签/u);
  assert.match(settingsPage, /const providerStatus = !provider\.available[\s\S]*?personalControlMissing[\s\S]*?builtIn/u);
  assert.match(settingsPage, /disabled=\{!provider\.available\}/u);
  assert.match(settingsPage, /Permission Owner/u);
});

test("browser settings connect data cleanup, downloads, website permissions, and developer controls to real owners", () => {
  assert.match(settingsPage, /clearBrowserSessionData\(\)/u);
  assert.match(browserController, /router\.delete\("\/browser\/data"/u);
  assert.match(settingsPage, /title="下载历史记录"/u);
  assert.match(settingsPage, /title="下载前询问保存位置"[\s\S]*?askBeforeDownload/u);
  assert.match(settingsPage, /title="默认使用网站工具"[\s\S]*?useWebsiteToolsByDefault/u);
  assert.match(settingsPage, /title="网站设置"/u);
  assert.match(settingsPage, /title="开发者模式"/u);
  assert.match(settingsPage, /title="完整 CDP 访问权限"[\s\S]*?fullCdpAccess/u);
  assert.match(browserSessionManager, /Storage\.clearDataForOrigin/u);
  assert.match(nativeBrowser, /setPreferences\(value\)/u);
  assert.match(nativeBrowser, /askBeforeDownload/u);
});

test("browser address preferences continue to use the existing account settings", () => {
  assert.match(settingsPage, /settings\.browserUse\.searchEngine/u);
  assert.match(settingsPage, /settings\.browserUse\.showFullUrl/u);
  assert.match(settingsPage, /settings\.permissions\.mode/u);
});

test("Agent browser location settings expose internal and current-browser routes with the CUA dependency", () => {
  assert.match(settingsPage, /title="网页 URL 和链接打开位置"[\s\S]*?settings\.browserUse\.webUrlOpenLocation/u);
  assert.match(settingsPage, /title="本地开发站点默认打开位置"[\s\S]*?settings\.browserUse\.localUrlOpenLocation/u);
  assert.match(settingsPage, /当前已打开的浏览器/u);
  assert.match(settingsPage, /该选择不会替你开启电脑操控/u);
  assert.match(settingsPage, /工作区 HTML\/HTM 文件仍由 LFAA 受限预览器打开/u);
});

test("settings categories share a centered column and inherit common gutters and responsive row rules", () => {
  assert.match(settingsPage, /className="settings-content settings-content--browser"/u);
  assert.match(settingsPage, /className=\{`settings-content settings-content--plugin-workspace/u);
  const sharedLayoutTokens = settingsCss.slice(settingsCss.indexOf(".settings-page {"), settingsCss.indexOf(".settings-page--plugin-standalone"));
  assert.match(sharedLayoutTokens, /--settings-content-max-width:\s*760px/u);
  assert.match(sharedLayoutTokens, /--settings-page-padding-inline:\s*clamp\(18px,\s*5%,\s*64px\)/u);
  assert.match(sharedLayoutTokens, /--settings-row-inline-padding:\s*24px/u);
  assert.match(sharedLayoutTokens, /@media\s*\(max-width:\s*900px\)[\s\S]*?--settings-page-padding-inline:\s*24px/u);
  assert.match(sharedLayoutTokens, /@media\s*\(max-width:\s*620px\)[\s\S]*?--settings-page-padding-inline:\s*18px[\s\S]*?--settings-row-inline-padding:\s*18px/u);
  assert.match(settingsCss, /--settings-browser-row-gap-compact:\s*12px/u);
  assert.match(settingsCss, /\.settings-content\s*\{[^}]*width:\s*min\(100%,\s*var\(--settings-content-max-width\)\)/u);
  assert.match(settingsCss, /\.settings-content--plugin-workspace\s*\{[^}]*width:\s*min\(100%,\s*var\(--settings-content-max-width\)\)[^}]*max-width:\s*var\(--settings-content-max-width\)/u);
  assert.match(settingsCss, /\.settings-plugin-standalone__content--workspace\s*>\s*\.settings-content--plugin-workspace\s*\{[^}]*width:\s*100%[^}]*max-width:\s*none/u);
  assert.doesNotMatch(settingsCss, /\.settings-content--browser\s*\{[^}]*width:/u);
  assert.match(settingsCss, /\.settings-content--browser \.settings-row \{[^}]*grid-template-columns:[^}]*gap:\s*var\(--settings-browser-row-gap-compact\)/u);
  assert.doesNotMatch(settingsCss, /\.settings-content--browser \.settings-row\s*\{[^}]*padding:/u);
  assert.match(settingsCss, /\.settings-main__content\s*\{[^}]*padding:\s*var\(--settings-page-padding-block\)\s+var\(--settings-page-padding-inline\)/u);
  assert.match(settingsCss, /\.settings-row\s*\{[^}]*padding:\s*var\(--settings-row-padding\)/u);
  assert.match(settingsCss, /@container settings-browser \(max-width:\s*620px\)/u);
  assert.match(settingsCss, /\.settings-content--browser > \.settings-group:first-of-type \.settings-group__rows/u);
  assert.match(settingsPage, /title="密码管理器"/u);
  assert.match(settingsPage, /title="联系信息"/u);
  assert.match(settingsPage, /title="扩展程序管理器"/u);
});

test("browser history is viewable and removable, while Agent access requires its separate user setting", () => {
  assert.match(settingsPage, /title="浏览历史"/u);
  assert.match(settingsPage, /loadBrowserRecentSites\(50\)/u);
  assert.match(settingsPage, /deleteBrowserRecentSite\(url\)/u);
  assert.match(settingsPage, /title="Agent 可访问浏览历史"[\s\S]*?settings\.browserUse\.allowAgentHistoryAccess/u);
  assert.match(browserTools, /requiresBrowserHistoryAccess:\s*true/u);
  assert.match(browserTools, /if \(!settings\.allowAgentHistoryAccess\)/u);
  assert.match(browserController, /router\.delete\("\/browser\/recent-sites\/item"/u);
});

test("Agent screenshot capture follows the persisted browser screenshot policy", () => {
  assert.match(settingsPage, /title="发送页面截图供 Agent 理解"[\s\S]*?settings\.browserUse\.annotateScreenshots/u);
  assert.match(browserTools, /policy === "always" \|\| \(policy === "on-demand" && parameters\.includeScreenshot === true\)/u);
  assert.match(browserTools, /snapshotResult\(snapshot, includeScreenshot\)/u);
});
