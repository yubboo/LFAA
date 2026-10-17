/**
 * 功能：锁定 AI Work 提问框的网格收缩、操作栏容器响应和插入光标可见性。
 * 作用：防止 TextArea 撑出聊天列，关联选择器随真实中间栏宽度排布，并保证光标跟随主题文字颜色。
 * 关联文件：packages/client/ui-chat/src/ai-work-chat.css；本测试检查提问框、关联操作栏与 TextArea 样式。
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

test("应用和能力选择放进紧凑的更多菜单，权限与模型操作继续可见", () => {
  const leftGroupStart = chatSource.indexOf('aria-label="添加、权限与更多操作"');
  const rightGroupStart = chatSource.indexOf('aria-label="模型、推理与发送"');
  const permissionControl = chatSource.indexOf("ai-work-chat__composer-control--permission", leftGroupStart);
  const moreControl = chatSource.indexOf("ai-work-chat__composer-control--more", leftGroupStart);
  const moreContentStart = chatSource.indexOf("const composerMoreContent");
  const actionsRule = chatStyles.match(/^\.ai-work-chat__composer-actions\s*\{([^}]*)\}/mu)?.[1] ?? "";

  assert.ok(leftGroupStart >= 0 && rightGroupStart > leftGroupStart);
  assert.ok(permissionControl > leftGroupStart && moreControl > permissionControl && moreControl < rightGroupStart);
  assert.ok(moreContentStart >= 0 && moreContentStart < leftGroupStart);
  assert.ok(chatSource.includes('composerMoreSection === "applications" ? "关联应用" : "Skill / 提示词 / 专家"'));
  assert.match(chatSource, /overlayClassName="ai-work-chat__more-overlay"/u);
  assert.match(actionsRule, /flex-wrap:\s*wrap\s*;/u);
  assert.match(chatSource, /aria-description="关联只提供参考，小鱼按目标决定是否加载。"/u);
});

test("更多菜单采用纵向操作行，选择面板限制最大宽高并跟随视口滚动", () => {
  assert.match(chatStyles, /\.ai-work-chat__more-menu\s*\{[^}]*display:\s*grid/u);
  assert.match(chatStyles, /\.ai-work-chat__more-menu-item\s*\{[^}]*grid-template-columns:\s*20px\s+minmax\(0,\s*1fr\)\s+auto\s+14px/u);
  assert.match(chatStyles, /\.workbench-shell \.ai-work-chat__more-overlay \.ant-popover-inner\s*\{[^}]*max-height:\s*min\(420px,\s*calc\(100dvh - 24px\)\)/u);
  assert.match(chatStyles, /\.ai-work-chat__more-menu-picker > \.ant-select\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/u);
  assert.match(chatStyles, /data-we-glass-floaters[^\n]*ai-work-chat__more-overlay \.ant-popover-inner/u);
  assert.match(chatStyles, /data-background-image="true"[^\n]*ai-work-chat__more-overlay/u);
  assert.ok(chatStyles.includes('.workbench-shell[data-reduced-motion="on"] .ai-work-chat__more-overlay'));
  assert.doesNotMatch(chatStyles, /@container ai-work-composer/u);
  assert.doesNotMatch(composerRule, /container:\s*ai-work-composer/u);
});
