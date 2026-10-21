/** 功能：回归 AI 与模型设置中的上下文开关说明及独立行布局。作用：阻止嵌套设置行在窄容器中挤压成竖排，并保证关闭状态可发现。关联文件：packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-chat/src/AiUsageFooter.tsx。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const settingsPage = readFileSync(resolve(repositoryRoot, "packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");
const usageFooter = readFileSync(resolve(repositoryRoot, "packages/client/ui-chat/src/AiUsageFooter.tsx"), "utf8");
const aiWorkChat = readFileSync(resolve(repositoryRoot, "packages/client/ui-chat/src/AiWorkChat.tsx"), "utf8");

test("上下文显示、自动压缩和未知模型容量为同级设置行", () => {
  const aiSection = settingsPage.split('if (activeSection === "ai") return (')[1]?.split('if (activeSection === "minecraft")')[0] ?? "";
  const runtimeGroup = aiSection.split('<SettingGroup title="推理参数">')[1]?.split("</SettingGroup>")[0] ?? "";
  const rowTitles = [...runtimeGroup.matchAll(/<SettingRow title="([^"]+)"/gu)].map(match => match[1]);
  const contextIndex = rowTitles.indexOf("显示上下文使用情况");
  assert.deepEqual(rowTitles.slice(contextIndex, contextIndex + 3), ["显示上下文使用情况", "自动压缩较早上下文", "模型窗口未知时的上下文容量"]);
  for (const title of rowTitles.slice(contextIndex, contextIndex + 3)) {
    const rowStart = runtimeGroup.indexOf(`<SettingRow title="${title}"`);
    const rowEnd = runtimeGroup.indexOf("</SettingRow>", rowStart);
    const nextRow = runtimeGroup.indexOf("<SettingRow", rowStart + 1);
    assert.ok(rowEnd >= 0 && (nextRow < 0 || rowEnd < nextRow), `${title} 不得嵌套其他设置行`);
  }
  assert.match(runtimeGroup, /当前已[\s\S]*?Token 总量和缓存命中统计不受此开关影响/u);
});

test("工作台关闭上下文详情时仍明确提示当前状态和设置位置", () => {
  assert.match(usageFooter, /上下文用量已关闭/u);
  assert.match(usageFooter, /设置中心「AI 与模型」中开启/u);
  assert.match(usageFooter, /上下文已关闭/u);
  assert.match(usageFooter, /Token 与缓存统计仍会正常显示/u);
  assert.match(usageFooter, /hasAssistantMessage, onOpenContextSettings/u);
  assert.match(aiWorkChat, /<AiUsageFooter[\s\S]*?onOpenContextSettings=\{\(\) => onOpenSettings\("ai", "ai-context-usage-setting"\)\}/u);
  assert.match(usageFooter, /打开 AI 与模型设置/u);
  assert.match(settingsPage, /id="ai-context-usage-setting"/u);
  assert.match(settingsPage, /scrollIntoView\(\{ block: "center" \}\)/u);
});
