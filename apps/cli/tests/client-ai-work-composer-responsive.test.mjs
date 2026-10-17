/**
 * 功能：锁定 AI Work 提问框的网格收缩规则与插入光标可见性。
 * 作用：防止 TextArea 撑出聊天列，并保证输入光标跟随主题文字颜色。
 * 关联文件：packages/client/ui-chat/src/ai-work-chat.css；本测试检查其中提问框容器与 TextArea 样式。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatStyles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
const composerRule = chatStyles.match(/^\.ai-work-chat__composer\s*\{([^}]*)\}/mu)?.[1] ?? "";
const composerInputRule = chatStyles.match(/^\.ai-work-chat__composer \.ant-input\s*\{([^}]*)\}/mu)?.[1] ?? "";

test("窄中间栏的提问框及 TextArea 随容器收缩，不由隐式 Grid 最小宽度撑开", () => {
  assert.match(composerRule, /min-width:\s*0\s*;/u);
  assert.match(composerRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/u);
  assert.match(composerInputRule, /width:\s*100%\s*;/u);
  assert.match(composerInputRule, /min-width:\s*0\s*;/u);
});

test("AI Work 输入光标跟随当前文字颜色，避免浅色背景上不可见", () => {
  assert.match(composerInputRule, /caret-color:\s*var\(--we-caret-color,\s*currentColor\)\s*;/u);
  assert.doesNotMatch(composerInputRule, /caret-color:\s*currentColor\s*!important/u);
});
