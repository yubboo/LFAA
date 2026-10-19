/** 功能：回归设置中心窄容器工具栏与通知说明的响应式布局。作用：防止保存操作孤立换行或窄栏通知提示占用过多高度。关联文件：packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-settings/src/SettingsPage.css。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const settingsPage = readFileSync(resolve(repositoryRoot, "packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");
const settingsStyles = readFileSync(resolve(repositoryRoot, "packages/client/ui-settings/src/SettingsPage.css"), "utf8");

test("设置工具栏按容器宽度成组排列状态和保存操作", () => {
  assert.match(settingsStyles, /@container settings-main \(max-width: 760px\)[\s\S]*?\.settings-toolbar__actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto;/u);
  assert.match(settingsStyles, /@container settings-main \(max-width: 380px\)\s*\{[^}]*\.settings-toolbar__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(settingsStyles, /\.settings-toolbar__actions\s*>\s*small\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/u);
  assert.match(settingsStyles, /\.settings-toolbar__actions\s*>\s*\.ant-btn\s*\{[^}]*width:\s*100%;/u);
});

test("通知说明保留真实接入边界并避免窄栏冗长枚举", () => {
  const notificationSection = settingsPage.split('if (activeSection === "notifications") return (')[1]?.split('if (activeSection === "wallpaperEngine")')[0] ?? "";
  assert.match(notificationSection, /message="当前接入 LFAA 自身通知"/u);
  assert.match(notificationSection, /description="目前仅接入小鱼智能体回复通知；ChatGPT\/Codex 等外部事件暂无连接器。"/u);
  assert.match(notificationSection, /notificationGroup/u);
  assert.doesNotMatch(notificationSection, /健康数据、群聊、营销、资料库和项目邀请/u);
});
