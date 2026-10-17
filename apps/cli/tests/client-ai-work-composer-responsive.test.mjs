/**
 * 功能：锁定 AI Work 提问框的网格收缩规则与插入光标可见性。
 * 作用：防止 TextArea 撑出聊天列，并保证输入光标跟随主题文字颜色。
 * 关联文件：packages/client/ui-chat/src/ai-work-chat.css；本测试检查其中提问框容器与 TextArea 样式。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatStyles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
const chatSource = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
const composerRule = chatStyles.match(/^\.ai-work-chat__composer\s*\{([^}]*)\}/mu)?.[1] ?? "";
const composerInputRule = chatStyles.match(/^\.ai-work-chat__composer \.ant-input\s*\{([^}]*)\}/mu)?.[1] ?? "";
const messageStageRule = chatStyles.match(/^\.ai-work-chat__message-stage\s*\{([^}]*)\}/mu)?.[1] ?? "";
const messageListRule = chatStyles.match(/^\.ai-work-chat__message-list\s*\{([^}]*)\}/mu)?.[1] ?? "";
const anchorRule = chatStyles.match(/^\.ai-work-chat__anchors\s*\{([^}]*)\}/mu)?.[1] ?? "";

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

test("窄聊天列为正文增加容器比例留白，锚点仍固定在消息舞台左侧", () => {
  assert.match(messageStageRule, /position:\s*relative\s*;/u);
  assert.match(messageListRule, /padding:\s*22px\s+clamp\(20px,\s*3%,\s*32px\)\s+12px\s*;/u);
  assert.match(anchorRule, /left:\s*0\s*;/u);
});

test("权限、应用和能力关联位于同一操作组，窄宽时操作行可换行", () => {
  const leftGroupStart = chatSource.indexOf('aria-label="添加、权限与关联"');
  const rightGroupStart = chatSource.indexOf('aria-label="模型、推理与发送"');
  const permissionControl = chatSource.indexOf("ai-work-chat__composer-control--permission", leftGroupStart);
  const associationControls = chatSource.indexOf("ai-work-chat__associations", leftGroupStart);
  const actionsRule = chatStyles.match(/^\.ai-work-chat__composer-actions\s*\{([^}]*)\}/mu)?.[1] ?? "";

  assert.ok(leftGroupStart >= 0 && rightGroupStart > leftGroupStart);
  assert.ok(permissionControl > leftGroupStart && associationControls > permissionControl && associationControls < rightGroupStart);
  assert.match(actionsRule, /flex-wrap:\s*wrap\s*;/u);
  assert.match(chatStyles, /\.ai-work-chat__association-select--capability\s*\{[^}]*flex-basis:\s*192px\s*;/u);
  assert.match(chatSource, /aria-description="关联只提供参考，小鱼按目标决定是否加载。"/u);
});
