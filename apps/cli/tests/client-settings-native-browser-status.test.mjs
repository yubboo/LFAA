/** 功能：锁定浏览器设置页的原生浏览器能力状态。作用：阻止未验收的桌面能力或未接入的 Agent 同页控制被展示为可用。关联文件：packages/client/ui-settings/src/SettingsPage.tsx。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const settingsPage = readFileSync(resolve(import.meta.dirname, "../../../packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");

test("native browser Agent integration reports source wiring and keeps the existing explicit provider opt-in", () => {
  assert.match(settingsPage, /认证 Browser Owner 按账户、LFAA Session 和当前标签 Target 接入 Agent/u);
  assert.match(settingsPage, /启用后可控制同一标签/u);
  assert.match(settingsPage, /const providerStatus = !provider\.available[\s\S]*?provider\.isolation === "app-session"/u);
  assert.match(settingsPage, /disabled=\{!provider\.available\}/u);
  assert.match(settingsPage, /用户当前选中的 Target 绑定/u);
  assert.match(settingsPage, /Permission Owner/u);
});

test("native desktop capability rows report pending runtime acceptance without claiming the runtime was exercised", () => {
  assert.match(settingsPage, /真实桌面窗口尚未运行验收/u);
  assert.match(settingsPage, /真实桌面弹窗及下载结果尚未验收/u);
  assert.match(settingsPage, /CDP 端点不提供给 Renderer 或 Agent Tool/u);
  assert.match(settingsPage, /status="桌面实页待验"/u);
  assert.match(settingsPage, /title="Agent 原生页面控制"[\s\S]*?status="源码已接入 · 桌面实测待验"/u);
  assert.match(settingsPage, /清除 LFAA 原生浏览器本次运行期间的 Cookie、缓存、本地站点数据和网站权限决定/u);
  assert.match(settingsPage, /原生网站数据不跨应用重启保存/u);
  assert.match(settingsPage, /title="清除网站数据"[\s\S]*?清除数据/u);
});

test("browser address preferences continue to use the existing account settings", () => {
  assert.match(settingsPage, /settings\.browserUse\.searchEngine/u);
  assert.match(settingsPage, /settings\.browserUse\.showFullUrl/u);
  assert.match(settingsPage, /settings\.permissions\.mode/u);
});
