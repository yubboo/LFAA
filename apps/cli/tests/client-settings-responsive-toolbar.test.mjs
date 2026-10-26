/** 功能：回归设置中心窄容器工具栏、外观标题/强调色行和通知说明的响应式布局。作用：防止保存操作孤立换行、品牌预览占据独立标题行、强调色行浪费纵向空间或窄栏通知提示占用过多高度。关联文件：packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-settings/src/SettingsPage.css。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const settingsPage = readFileSync(resolve(repositoryRoot, "packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");
const settingsStyles = readFileSync(resolve(repositoryRoot, "packages/client/ui-settings/src/SettingsPage.css"), "utf8");

test("设置工具栏按容器宽度成组排列状态和保存操作", () => {
  assert.match(settingsStyles, /@container settings-main \(max-width: 760px\)[\s\S]*?\.settings-toolbar\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(settingsStyles, /\.settings-toolbar__start\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;/u);
  assert.match(settingsStyles, /\.settings-toolbar__status\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/u);
  assert.match(settingsStyles, /\.settings-toolbar__actions\s*\{[^}]*display:\s*grid;[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*2;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(settingsStyles, /\.settings-toolbar__actions\s*>\s*\.ant-btn\s*\{[^}]*width:\s*100%;/u);
  assert.match(settingsStyles, /\.settings-toolbar__actions\s*>\s*\.ant-btn\s*\{[^}]*width:\s*100%;/u);
});

test("外观标题在窄容器与 LFAA 标识左右并排，桌面仍保留右侧预览", () => {
  const appearanceSection = settingsPage.split('if (activeSection === "appearance") return (')[1]?.split('<SettingGroup title="主题">')[0] ?? "";
  assert.match(appearanceSection, /settings-content__heading--appearance/u);
  assert.match(appearanceSection, /settings-content__heading-title-row[\s\S]*?<Typography\.Title level=\{2\}>外观<\/Typography\.Title>[\s\S]*?settings-preview[\s\S]*?>LFAA</u);
  assert.match(settingsStyles, /\.settings-content__heading--appearance \.settings-preview\s*\{[^}]*position:\s*absolute;/u);
  assert.match(settingsStyles, /@container settings-main \(max-width: 620px\)[\s\S]*?\.settings-content__heading--appearance \.settings-content__heading-title-row\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*space-between;/u);
  assert.match(settingsStyles, /@container settings-main \(max-width: 620px\)[\s\S]*?\.settings-content__heading--appearance \.settings-preview\s*\{[^}]*position:\s*static;/u);
});

test("强调色设置按实际可用宽度先左右排列，窄容器再上下换行", () => {
  const appearanceSection = settingsPage.split('if (activeSection === "appearance") return (')[1]?.split('<SettingGroup title="字体大小">')[0] ?? "";
  assert.match(appearanceSection, /settings-content--appearance/u);
  assert.match(appearanceSection, /SettingRow id="appearance-accent-color" title="强调色"/u);
  assert.match(settingsStyles, /\.settings-content--appearance #appearance-accent-color\.settings-row\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*13rem\),\s*1fr\)\)/u);
  assert.match(settingsStyles, /\.settings-content--appearance #appearance-accent-color \.settings-color-options\s*\{[^}]*flex-wrap:\s*wrap;/u);
  assert.match(settingsStyles, /@container settings-main \(max-width: 460px\)[\s\S]*?justify-content:\s*flex-start;/u);
});

test("通知说明保留真实接入边界并避免窄栏冗长枚举", () => {
  const notificationSection = settingsPage.split('if (activeSection === "notifications") return (')[1]?.split('if (activeSection === "wallpaperEngine")')[0] ?? "";
  assert.match(notificationSection, /message="当前接入 LFAA 自身通知"/u);
  assert.match(notificationSection, /description="目前仅接入小鱼智能体回复通知；ChatGPT\/Codex 等外部事件暂无连接器。"/u);
  assert.match(notificationSection, /notificationGroup/u);
  assert.doesNotMatch(notificationSection, /健康数据、群聊、营销、资料库和项目邀请/u);
});
