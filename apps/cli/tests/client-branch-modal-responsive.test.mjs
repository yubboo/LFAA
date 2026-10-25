/**
 * 功能：锁定聊天分支弹窗相对工作区的响应式定位与尺寸约束。
 * 作用：避免窄栏或短屏下弹窗偏移、横向溢出、内容不可滚动，或重新引入 inline-block 居中。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatSource = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8").replace(/\r\n/gu, "\n");
const chatStyles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8").replace(/\r\n/gu, "\n");
const branchModalStart = chatSource.indexOf('<Modal\n          className="ai-work-chat__branch-modal"');
const branchModalEnd = chatSource.indexOf("</Modal>", branchModalStart);
const branchModal = chatSource.slice(branchModalStart, branchModalEnd);
const originStart = chatSource.indexOf('branchSource ? <div className="ai-work-chat__branch-origin"');
const messageListStart = chatSource.indexOf('<div className="ai-work-chat__message-list">');
const welcomeStart = chatSource.indexOf('className={`ai-work-chat__welcome', messageListStart);
const composerStart = chatSource.indexOf('<form ref={composerFormRef} className="ai-work-chat__composer"', originStart);

test("聊天分支弹窗按工作区宽高居中、限宽并在短屏内可滚动", () => {
  assert.notEqual(branchModalStart, -1);
  assert.notEqual(branchModalEnd, -1);
  assert.match(branchModal, /rootClassName="ai-work-chat__branch-modal-root"/u);
  assert.match(branchModal, /width="min\(560px, 100%\)"/u);
  assert.match(branchModal, /\.workbench-shell/u);
  assert.doesNotMatch(branchModal, /\bcentered\b/u);

  assert.match(chatStyles, /\.ai-work-chat__branch-modal-root \.ant-modal-wrap\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*padding:\s*16px;/u);
  assert.match(chatStyles, /\.ai-work-chat__branch-modal\.ant-modal\s*\{[^}]*max-width:\s*100%;[^}]*max-height:\s*100%;[^}]*overflow-y:\s*auto;/u);
  assert.doesNotMatch(branchModal + chatStyles.match(/\.ai-work-chat__branch-modal-root \.ant-modal-wrap\s*\{[^}]*\}/u)?.[0] + chatStyles.match(/\.ai-work-chat__branch-modal\.ant-modal\s*\{[^}]*\}/u)?.[0], /display:\s*inline-block/u);
});

test("分支来源条位于新消息列表的末尾、输入框之前", () => {
  assert.ok(messageListStart >= 0 && welcomeStart > messageListStart);
  assert.ok(originStart > welcomeStart, "来源条必须位于历史消息/空白欢迎区之后");
  assert.ok(composerStart > originStart, "来源条必须位于输入框之前");
});
