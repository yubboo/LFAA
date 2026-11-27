// 验证刷新恢复会话时不再闪现空态引导：恢复中只渲染会话骨架，详情回来后直接进入消息线程。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { ChatMessageList } = await import("../client/conversation/ChatMessageList");
const { zhMessages } = await import("../client/locales.zh");
import type { ChatMessageItem } from "../client/store/chat-types";

const noop = () => {};

/** 渲染消息区的最小属性集；本用例只关心恢复中与详情回来后的空态差异。 */
function renderList(options: { restoring?: boolean; messages?: ChatMessageItem[] }): string {
  return renderToStaticMarkup(createElement(ChatMessageList, {
    locale: zhMessages,
    messages: options.messages ?? [],
    lastMessage: undefined,
    clarification: undefined,
    starterSuggestions: null,
    workspaceMode: "chatgpt",
    restoring: options.restoring ?? false,
    heroComposer: createElement("div", null, "composer"),
    onWorkspaceModeChange: noop,
    selectedFile: undefined,
    pendingApproval: null,
    memoriesCount: 0,
    isRunning: false,
    showHomeSuggestions: false,
    brandWatermark: false,
    activeSessionId: "",
    assistantBodyClass: undefined,
    noticeLinkClass: undefined,
    onOpenFilePreview: noop,
    onOpenTurnChanges: undefined,
    onEditContent: noop,
    onOpenTrace: noop,
    onBranchToNewChat: noop,
    onContinueInterrupted: noop,
    onSubmitQuestion: noop,
    onResolveApproval: noop,
    mediaActions: { busy: false, onQuote: noop, onRegenerate: noop },
    threadRef: { current: null },
    scrollElementRef: { current: null },
  }));
}

test("恢复已记住的会话时渲染骨架而不是空态引导", () => {
  const html = renderList({ restoring: true });
  assert.match(html, /restoreSkeleton/u);
  assert.match(html, /正在恢复对话/u);
  assert.doesNotMatch(html, /我们从哪里开始/u);
  assert.doesNotMatch(html, /我们要做什么/u);
});

test("没有待恢复会话时仍立即显示空态引导", () => {
  const html = renderList({ restoring: false });
  assert.match(html, /我们要聊些什么/u);
  assert.doesNotMatch(html, /restoreSkeleton/u);
});

test("会话详情已回来时直接渲染消息线程", () => {
  const html = renderList({
    restoring: true,
    messages: [{
      id: "m1",
      role: "user",
      content: "继续",
      createdAt: Date.now(),
      status: "done",
    }],
  });
  assert.match(html, /chat-message-m1/u);
  assert.doesNotMatch(html, /restoreSkeleton/u);
});