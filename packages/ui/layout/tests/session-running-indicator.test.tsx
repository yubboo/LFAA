// 验证左二会话行的任务状态联动：进行中显示转圈，完成且未读显示小圆点，两者互斥；正在查看的会话不显示完成点。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkbenchChatProvider, WorkbenchChatSessionSummary } from "../contract/index";
import type { SessionItemDeps } from "../client/components/navigation-items";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { createRecentSidebarItems, createSessionSidebarItem } = await import("../client/components/navigation-items");
const { SidebarSectionList } = await import("../client/components/SidebarSectionList");

/** 构造一条会话摘要，仅覆盖侧栏行用到的字段。 */
function session(id: string, extra: Partial<WorkbenchChatSessionSummary> = {}): WorkbenchChatSessionSummary {
  return {
    id,
    title: `会话 ${id}`,
    projectId: "p1",
    messageCount: 1,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

/** 构造只暴露运行与待处理状态的聊天提供方，状态由测试控制。 */
function provider(
  runningIds: string[],
  attention: Record<string, "approval" | "question"> = {},
): WorkbenchChatProvider<ReactNode> {
  return {
    getSessions: () => [],
    getActiveSessionId: () => null,
    isSessionRunning: (sessionId) => runningIds.includes(sessionId),
    getSessionAttention: (sessionId) => attention[sessionId] ?? null,
    subscribe: () => () => {},
    startNewChat: () => {},
    openSession: () => {},
  };
}

function deps(chatProvider: WorkbenchChatProvider<ReactNode>): SessionItemDeps {
  return {
    activeView: "workspace",
    activeChatSessionId: null,
    showActive: true,
    onRowActivate: () => {},
    chatProvider,
    onSelectChatSession: () => {},
  };
}

test("运行中的会话行使用旋转图标，切走会话不影响状态", () => {
  const item = createSessionSidebarItem(session("s1"), deps(provider(["s1"])));

  assert.equal(item.icon, "working");
  assert.equal(item.hideIcon, undefined);
});

test("运行中的项目子会话即使原本隐藏图标也保留转圈", () => {
  const item = createSessionSidebarItem(session("s2"), deps(provider(["s2"])), {
    nested: true,
    hideIcon: true,
  });

  assert.equal(item.icon, "working");
  assert.equal(item.nested, true);
  assert.equal(item.hideIcon, undefined);
});

test("未运行的会话保持铅笔图标与项目子行的隐藏图标设置", () => {
  const item = createSessionSidebarItem(session("s3"), deps(provider([])), {
    nested: true,
    hideIcon: true,
  });

  assert.equal(item.icon, "newChat");
  assert.equal(item.hideIcon, true);
});

test("最近分组的会话行同样跟随运行状态切换图标", () => {
  const recents = [
    { id: "recent:s1", label: "会话 s1", view: "workspace" as const, sessionId: "s1", updatedAt: 0 },
    { id: "recent:s2", label: "会话 s2", view: "workspace" as const, sessionId: "s2", updatedAt: 0 },
  ];
  const items = createRecentSidebarItems(recents, {
    projects: [],
    chatSessions: [session("s1"), session("s2")],
    activeView: "workspace",
    activeProjectId: null,
    chatProvider: provider(["s1"]),
    onOpenProject: () => {},
    onNavigate: () => {},
  });

  assert.deepEqual(items.map((item) => item.icon), ["working", "newChat"]);
});

test("进行中隐藏完成点，结束后才显示未读小圆点", () => {
  const running = createSessionSidebarItem(session("s1", { unread: true }), deps(provider(["s1"])));
  const finished = createSessionSidebarItem(session("s2", { unread: true }), deps(provider([])));

  assert.equal(running.icon, "working");
  assert.equal(running.unread, undefined);
  assert.equal(finished.unread, true);
});

test("正在查看的会话不显示完成点", () => {
  const item = createSessionSidebarItem(session("s3", { unread: true }), {
    ...deps(provider([])),
    activeChatSessionId: "s3",
  });

  assert.equal(item.active, true);
  assert.equal(item.unread, undefined);
});

test("最近分组的完成点同样遵循进行中与正在查看的隐藏规则", () => {
  const recents = [
    { id: "recent:s1", label: "会话 s1", view: "workspace" as const, sessionId: "s1", updatedAt: 0, active: false },
    { id: "recent:s2", label: "会话 s2", view: "workspace" as const, sessionId: "s2", updatedAt: 0, active: true },
    { id: "recent:s3", label: "会话 s3", view: "workspace" as const, sessionId: "s3", updatedAt: 0, active: false },
  ];
  const items = createRecentSidebarItems(recents, {
    projects: [],
    chatSessions: [session("s1", { unread: true }), session("s2", { unread: true }), session("s3", { unread: true })],
    activeView: "workspace",
    activeProjectId: null,
    chatProvider: provider(["s1"]),
    onOpenProject: () => {},
    onNavigate: () => {},
  });

  assert.equal(items[0]?.unread, undefined);
  assert.equal(items[1]?.unread, undefined);
  assert.equal(items[2]?.unread, true);
});

test("待确认/待回答的会话显示徽标并隐藏完成未读点", () => {
  const approval = createSessionSidebarItem(session("s1", { unread: true }), deps(provider([], { s1: "approval" })));
  const question = createSessionSidebarItem(session("s2", { unread: true }), deps(provider([], { s2: "question" })));

  assert.equal(approval.attention, "approval");
  assert.equal(approval.attentionLabel, "待确认");
  assert.equal(approval.unread, undefined);
  assert.equal(question.attention, "question");
  assert.equal(question.attentionLabel, "待回答");
  assert.equal(question.unread, undefined);
});

test("正在查看的会话不显示待确认/待回答徽标", () => {
  const item = createSessionSidebarItem(session("s3", { unread: true }), {
    ...deps(provider([], { s3: "question" })),
    activeChatSessionId: "s3",
  });

  assert.equal(item.active, true);
  assert.equal(item.attention, undefined);
});

test("最近分组的会话同样显示待处理徽标", () => {
  const items = createRecentSidebarItems(
    [{ id: "recent:s1", label: "会话 s1", view: "workspace" as const, sessionId: "s1", updatedAt: 0, active: false }],
    {
      projects: [],
      chatSessions: [session("s1", { unread: true })],
      activeView: "workspace",
      activeProjectId: null,
      chatProvider: provider([], { s1: "question" }),
      onOpenProject: () => {},
      onNavigate: () => {},
    },
  );

  assert.equal(items[0]?.attention, "question");
  assert.equal(items[0]?.attentionLabel, "待回答");
  assert.equal(items[0]?.unread, undefined);
});

test("侧栏渲染待确认与待回答徽标", () => {
  const markup = renderToStaticMarkup(createElement(SidebarSectionList, {
    ariaLabel: "导航",
    groups: [{
      id: "recent",
      title: "最近",
      items: [
        { id: "approval", label: "等待批准", icon: "newChat", attention: "approval", attentionLabel: "待确认", onClick: () => {} },
        { id: "question", label: "等待回答", icon: "newChat", attention: "question", attentionLabel: "待回答", onClick: () => {} },
      ],
    }],
  }));

  assert.match(markup, /待确认/u);
  assert.match(markup, /待回答/u);
  assert.match(markup, /data-attention="approval"/u);
  assert.match(markup, /data-attention="question"/u);
});

test("侧栏渲染把 working 图标输出为带旋转样式的 svg", () => {
  const markup = renderToStaticMarkup(createElement(SidebarSectionList, {
    ariaLabel: "导航",
    groups: [{
      id: "recent",
      title: "最近",
      items: [{
        id: "recent:s1",
        label: "会话 s1",
        icon: "working",
        onClick: () => {},
      }],
    }],
  }));

  assert.match(markup, /会话 s1/u);
  assert.match(markup, /class="[^"]*working[^"]*"/u);
});

test("侧栏只为完成且未读的行渲染小圆点", () => {
  const markup = renderToStaticMarkup(createElement(SidebarSectionList, {
    ariaLabel: "导航",
    groups: [{
      id: "recent",
      title: "最近",
      items: [
        { id: "done", label: "已完成", icon: "newChat", unread: true, actions: createElement("span", null, "操作"), onClick: () => {} },
        { id: "working", label: "进行中", icon: "working", actions: createElement("span", null, "操作"), onClick: () => {} },
      ],
    }],
  }));

  assert.match(markup, /已完成/u);
  assert.match(markup, /进行中/u);
  assert.equal((markup.match(/unreadDot/gu) ?? []).length, 1);
});