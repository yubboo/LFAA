/** 功能：回归设置中心账号 Tab 结构。作用：保持资料、安全、账号管理的共享导航与旧路由。关联文件：packages/client/ui-settings/src/SettingsPage.tsx。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const settingsPagePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/client/ui-settings/src/SettingsPage.tsx");
const settingsPage = readFileSync(settingsPagePath, "utf8");
const settingsStylesPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/client/ui-settings/src/SettingsPage.css");
const settingsStyles = readFileSync(settingsStylesPath, "utf8");
const settingsMenuCatalogPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/util/values/src/settings-menu-catalog.ts");
const settingsMenuCatalog = readFileSync(settingsMenuCatalogPath, "utf8");

test("资料、安全与账号管理共用带键盘操作的账号 Tab 面板", () => {
  assert.match(settingsPage, /const ACCOUNT_SETTINGS_TABS:[\s\S]*?\{ id: "profile", label: "个人资料" \}[\s\S]*?\{ id: "security", label: "安全" \}[\s\S]*?\{ id: "account", label: "账号管理" \}/);
  assert.match(settingsPage, /role="tablist" aria-label="账号设置分类"/);
  assert.match(settingsPage, /event\.key === "ArrowRight"[\s\S]*?event\.key === "ArrowLeft"[\s\S]*?event\.key === "Home"[\s\S]*?event\.key === "End"/);

  for (const section of ["profile", "security", "account"]) {
    assert.match(settingsPage, new RegExp(`activeSection === "${section}"\\) return \\(\\s*<section className="settings-content settings-content--account" role="tabpanel" id="settings-account-panel" aria-labelledby="settings-account-tab-${section}"`));
    assert.match(settingsPage, new RegExp(`activeSection === "${section}"[\\s\\S]*?<AccountSettingsTabs activeSection=\\{activeSection\\} onSelect=\\{selectSection\\} \\/>`));
  }

  assert.match(settingsPage, /function isSettingsSection\(value: string \| null\): value is SectionId/);
  assert.match(settingsPage, /function getInitialSettingsSection\([\s\S]*?get\("section"\)/);
});

test("侧栏仅呈现账号入口，旧分类名称仍能搜索到账号页并适配窄栏", () => {
  assert.match(settingsPage, /const sections:[\s\S]*?= SETTINGS_CENTER_MENUS\.map\(/);
  assert.match(settingsMenuCatalog, /\{ id: "account", label: "账号", group: "个人", access: "tools"/);
  assert.match(settingsPage, /section\.id !== "profile" && section\.id !== "security"/);
  assert.match(settingsPage, /function getSettingsSectionSearchText\(section: \{ id: string; title: string; group: string \}\): string[\s\S]*?section\.id === "account" \? "账户 个人资料 安全 账号管理"/);
  assert.equal([...settingsPage.matchAll(/getSettingsSectionSearchText\(section\)/g)].length, 2, "候选过滤与分组展开必须复用同一组账号搜索别名");
  assert.match(settingsPage, /item\.id === "account" && isAccountSettingsSection\(activeSection\)/);
  assert.match(settingsPage, /if \(layout\.mode === "mobile"\) setSidebarCollapsed\(true\)/);
  assert.match(settingsStyles, /\.settings-account-tabs\s*\{[^}]*overflow-x:\s*auto/s);
});
