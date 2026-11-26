// 验证新会话草稿在项目下的侧栏行：立即可见、当前选中、点击只回到草稿而不打开历史会话。
import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode } from "react";
import type { WorkbenchChatProvider, WorkbenchChatSessionSummary } from "../contract/index";
import type { SessionItemDeps } from "../client/navigation/navigation-items";
import { createSessionSidebarItem } from "../client/navigation/navigation-items";

/** 构造一条尚未落库的新会话草稿摘要。 */
function draftSession(projectId: string | null = "p1", exiting = false): WorkbenchChatSessionSummary {
  return {
    id: `draft:${projectId ?? "global"}`,
    title: "新聊天",
    projectId,
    sectionId: null,
    messageCount: 0,
    createdAt: 1,
    updatedAt: 1,
    draft: true,
    ...(exiting ? { draftExiting: true } : {}),
  };
}

/** 记录草稿行点击去向的聊天提供方。 */
function provider(calls: { startNewChat: Array<{ projectId?: string | null; sectionId?: string | null }>; openSession: string[] }): WorkbenchChatProvider<ReactNode> {
  return {
    getSessions: () => [],
    getActiveSessionId: () => null,
    subscribe: () => () => {},
    startNewChat: (options) => { calls.startNewChat.push(options ?? {}); },
    openSession: (sessionId) => { calls.openSession.push(sessionId); },
  };
}

function deps(chatProvider: WorkbenchChatProvider<ReactNode>, activeChatSessionId: string | null = null): SessionItemDeps {
  return {
    activeView: "workspace",
    activeChatSessionId,
    showActive: true,
    onRowActivate: () => {},
    chatProvider,
    onSelectChatSession: () => {},
  };
}

test("新会话草稿行：项目下立即出现并处于选中态", () => {
  const calls = { startNewChat: [], openSession: [] };
  const item = createSessionSidebarItem(draftSession(), deps(provider(calls)), { nested: true, hideIcon: true, groupId: "project" });

  assert.equal(item.label, "新聊天");
  assert.equal(item.active, true);
  assert.equal(item.icon, "newChat");
  assert.equal(item.nested, true);
  assert.equal(item.animate, true);
  assert.equal(item.exiting, undefined);
  // 草稿没有历史会话菜单与置顶/改名入口。
  assert.equal(item.actions, undefined);
  assert.equal(item.onDoubleClick, undefined);
});

test("新会话草稿行：切到历史会话后不再选中", () => {
  const calls = { startNewChat: [], openSession: [] };
  const item = createSessionSidebarItem(draftSession(), deps(provider(calls), "s1"));
  assert.equal(item.active, false);
});

test("新会话草稿退场：行保留到高度收完，期间不可点击", () => {
  const calls = { startNewChat: [], openSession: [] };
  const item = createSessionSidebarItem(draftSession("p1", true), deps(provider(calls), "s1"));
  assert.equal(item.animate, true);
  assert.equal(item.exiting, true);
  assert.equal(item.active, false);
});

test("新会话草稿行：点击回到草稿，不请求打开不存在的会话", () => {
  const calls = { startNewChat: [], openSession: [] };
  const item = createSessionSidebarItem(draftSession(), deps(provider(calls)), { nested: true, groupId: "project" });
  item.onClick();

  assert.deepEqual(calls.startNewChat, [{ projectId: "p1", sectionId: null }]);
  assert.deepEqual(calls.openSession, []);
});