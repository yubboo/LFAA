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

test("模型入口默认打开推理视图，模型目录独立呈现", () => {
  assert.match(chat, /useState<"reasoning" \| "models">\("reasoning"\)/u);
  assert.match(picker, /data-view=\{modelPickerView\}/u);
  assert.match(picker, /modelPickerView === "reasoning" \? <>/u);
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
  assert.match(chatStyles, /overscroll-behavior: contain/u);
});

test("管理模型定位当前账户的 AI 与模型设置", () => {
  assert.match(picker, /onOpenSettings\("ai", activeAccount \? `settings-ai-account-\$\{activeAccount\.id\}` : undefined\)/u);
  assert.match(settings, /id=\{`settings-ai-account-\$\{account\.id\}`\}/u);
  assert.match(chat, /selectAiAccountModel\(targetAccount\.id, modelId\)/u);
  assert.match(chat, /updateAiAccountReasoningMode\(activeAccount\.id, reasoningMode\)/u);
});
