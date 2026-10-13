/**
 * 功能：锁定 AI Work 提问框在窄中间栏内的网格收缩规则。
 * 作用：防止 TextArea 的固有最小宽度把输入框撑出聊天列并覆盖右侧栏。
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
