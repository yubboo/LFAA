/** 功能：回归 AI Work 模型入口的推理/模型目录分层。作用：锁住简洁默认视图、有限模型目录、全局输出长度仅由设置中心配置及账户直达。关联文件：packages/client/ui-chat/src/AiWorkChat.tsx、ai-work-chat.css、packages/client/ui-settings/src/SettingsPage.tsx。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const chat = readFileSync(resolve(repositoryRoot, "packages/client/ui-chat/src/AiWorkChat.tsx"), "utf8");
const chatStyles = readFileSync(resolve(repositoryRoot, "packages/client/ui-chat/src/ai-work-chat.css"), "utf8");
const settings = readFileSync(resolve(repositoryRoot, "packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");
const picker = chat.split("const modelPickerContent = (")[1]?.split("const composerMoreContent = (")[0] ?? "";

test("模型入口默认打开紧凑推理卡片，点击当前模型后进入独立目录", () => {
  assert.match(chat, /useState<"reasoning" \| "models">\("reasoning"\)/u);
  assert.match(picker, /data-view=\{modelPickerView\}/u);
  assert.match(picker, /modelPickerView === "reasoning" \? <>/u);
  assert.match(picker, /WorkbenchIcon name="bolt"/u);
  assert.match(picker, /WorkbenchIcon name="refresh"/u);
  assert.match(picker, /模型思考力度/u);
  assert.match(chatStyles, /\.ai-work-chat__model-card-range\s*\{[^}]*height:\s*32px/u);
  const reasoningView = picker.split('modelPickerView === "reasoning" ? <>')[1]?.split('</> : <>')[0] ?? "";
  assert.doesNotMatch(reasoningView, /模型管理/u, "模型管理只放在模型目录视图底部");
  assert.match(picker, /返回推理设置/u);
  assert.match(picker, /选择模型/u);
  assert.match(picker, /role="listbox" aria-label="模型目录"/u);
  assert.match(chat, /slice\(0, modelResultLimit\)/u, "目录继续使用有限首屏结果和显式加载更多");
});

test("模型选择弹层只呈现模型与推理档位，输出长度留在设置中心", () => {
  assert.match(picker, /className="ai-work-chat__model-card-model-name">\{model\.name\}/u);
  assert.match(picker, /className="ai-work-chat__model-card-model-account">\{account\.displayName\} · \{account\.providerId\}/u);
  assert.doesNotMatch(picker, /ai-work-chat__model-card-model-metadata|<Tag color="blue">/u);
  assert.doesNotMatch(chat, /ai-work-chat__model-version-tag/u);
  assert.doesNotMatch(picker, /回复长度策略|model-card-speed|aiRuntime\.speed/u);
  assert.match(settings, /<SettingRow title="输出长度策略"/u);
  assert.match(settings, /value=\{settings\.aiRuntime\.speed\}/u);
  assert.match(settings, /updateSettings\("aiRuntime"/u);
  assert.match(chatStyles, /\.ai-work-chat__model-card\[data-view="models"\]/u);
  assert.match(picker, /activeReasoningLevels\.map\(\(option, index\) => index === displayedReasoningIndex \? null/u);
  assert.match(picker, /selectReasoningMode\(option\.value\)/u);
  assert.match(picker, /hasResolvedReasoningIndex \? `linear-gradient/u);
  assert.match(picker, /selectReasoningMode\("default"\)/u);
  assert.match(chatStyles, /overscroll-behavior: contain/u);
});

test("管理模型定位当前账户的 AI 与模型设置", () => {
  const reasoningView = picker.split('modelPickerView === "reasoning" ? <>')[1]?.split('</> : <>')[0] ?? "";
  const modelsView = picker.split('</> : <>')[1] ?? "";
  assert.doesNotMatch(reasoningView, /onOpenSettings/u);
  assert.match(modelsView, /模型管理/u);
  assert.match(modelsView, /onOpenSettings\("ai", activeAccount \? `settings-ai-account-\$\{activeAccount\.id\}` : undefined\)/u);
  assert.match(settings, /id=\{`settings-ai-account-\$\{account\.id\}`\}/u);
  assert.match(chat, /selectAiAccountModel\(targetAccount\.id, modelId\)/u);
  assert.match(chat, /updateAiAccountReasoningMode\(activeAccount\.id, reasoningMode\)/u);
});

test("入口工具提示只显示已配置快捷键，Composer 使用当前模型及 Provider 真实档位", () => {
  const tooltip = chat.match(/const modelPickerTooltipTitle = ([\s\S]*?)\n  const modelPickerContent/u)?.[1] ?? "";
  const composerLabel = chat.match(/const composerModelLabel = ([\s\S]*?)\n  const modelPickerShortcutLabel/u)?.[1] ?? "";

  assert.match(tooltip, /选择推理强度/u);
  assert.match(tooltip, /<kbd>\{modelPickerShortcutLabel\}<\/kbd>/u);
  assert.match(chat, /const modelPickerShortcutLabel = settings\.shortcuts\.openModelPicker\.filter\(Boolean\)\.join\(" \/ "\)/u);
  assert.doesNotMatch(tooltip, /account\.displayName|providerId|model\.id|activeAccount\.modelId/u);
  assert.match(composerLabel, /activeModel\.name/u);
  assert.match(composerLabel, /composerReasoningLabel/u);
  assert.match(chat, /providerDefaultReasoningMode \? reasoningModeLabel\(providerDefaultReasoningMode\)/u);
  assert.match(chat, /reasoningModeLabel\(activeModel\.thinking\.value\)/u);
  assert.match(chat, /<span className="ai-work-chat__composer-control-label">\{composerModelLabel\}<\/span>/u);
  assert.match(chat, /const openModelPicker = useCallback\(\(\) => \{\s*setModelPickerTooltipOpen\(false\);\s*setModelPickerOpen\(true\);\s*\}, \[\]\)/u, "以快捷键或命令打开选择器时清除悬浮提示状态");
  assert.match(chat, /open=\{modelPickerTooltipOpen && !modelPickerOpen\} onOpenChange=\{setModelPickerTooltipOpen\}/u, "模型面板关闭后不主动恢复提示，只等下次悬停触发");
  assert.match(chatStyles, /\.ai-work-chat__model-picker-tooltip > kbd/u);
});

test("模型选择快捷键沿用设置中心绑定及共享匹配器，并清理窗口监听", () => {
  assert.match(chat, /settings\.shortcuts\.openModelPicker\.some\(\(chord\) => chord && shortcutMatches\(event, chord\)\)/u);
  assert.match(chat, /window\.addEventListener\("keydown", handleModelPickerShortcut\)/u);
  assert.match(chat, /return \(\) => window\.removeEventListener\("keydown", handleModelPickerShortcut\)/u);
  assert.match(settings, /<ShortcutRow title="打开模型与推理选择" value=\{settings\.shortcuts\.openModelPicker\}/u);
});
