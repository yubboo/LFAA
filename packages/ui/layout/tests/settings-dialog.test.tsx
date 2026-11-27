// 验证设置中心改为弹窗呈现：目录/关闭入口可访问，未接入设置项退化为占位说明，
// 且弹窗打开时中央工作区仍停在背景视图而不是换成整页设置页。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkbenchSnapshot } from "../client/workbench-service";

(globalThis as { React?: typeof React }).React = React;

const { SettingsDialog } = await import("../client/panels/SettingsDialog");
const { ShellWorkspace } = await import("../client/shell/ShellWorkspace");
const { locales } = await import("../client/locales");

const snapshot: WorkbenchSnapshot = {
  tabs: [],
  activeView: "settings:appearance",
  activeProjectId: null,
  settingsReturnView: null,
  activeLibraryTab: "all",
  activeDomainItem: "",
  workspaceMode: "chatgpt",
    layoutMode: "chat-center",
  leftSidebarOpen: true,
  rightPanelOpen: false,
  previewPaneOpen: true,
    bottomPanelOpen: false,
    bottomPanels: [],
  rightWorkbenchWide: false,
  rightPanelMaximized: false,
  views: [{
    id: "settings:appearance",
    title: "外观",
    render: () => createElement("section", { "data-testid": "view-body" }, "外观视图正文"),
  }],
  contextPanels: [],
  accountActions: [],
  titleActions: [],
  workspaceActions: [],
  projectProvider: null,
  projects: [],
  sectionProvider: null,
  sections: [],
  chatProvider: null,
  chatSessions: [],
  activeChatSessionId: null,
  shortcuts: [],
};

test("设置弹窗提供目录导航、当前项标记与关闭入口", () => {
  const markup = renderToStaticMarkup(createElement(SettingsDialog, {
    locale: locales.zh,
    activeView: "appearance",
    renderContent: () => createElement("section", { "data-testid": "view-body" }, "外观视图正文"),
    onNavigate: () => {},
    onClose: () => {},
  }));

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /设置中心/u);
  // 目录按分组渲染，当前设置项标记为当前页。
  assert.match(markup, /个人/u);
  assert.match(markup, /常规/u);
  assert.equal((markup.match(/aria-current="page"/gu) ?? []).length, 1);
  assert.match(markup, /aria-current="page"[^>]*>外观</u);
  // 关闭按钮与视图正文都在弹窗内。
  assert.match(markup, /aria-label="关闭"/u);
  assert.match(markup, /data-testid="view-body"/u);
});

test("目录只列已接入页面，未注册视图退化为占位说明而不是空白", () => {
  const markup = renderToStaticMarkup(createElement(SettingsDialog, {
    locale: locales.zh,
    activeView: "settings:profile",
    renderContent: () => null,
    onNavigate: () => {},
    onClose: () => {},
  }));

  // 未接入的页面不再占目录位，也不会出现在目录里。
  assert.doesNotMatch(markup, /个人资料/u);
  assert.match(markup, new RegExp(locales.zh.featureUnavailable.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
});

test("设置弹窗打开时中央工作区仍渲染背景视图", () => {
  const markup = renderToStaticMarkup(createElement(ShellWorkspace, {
    snapshot,
    locale: locales.zh,
    view: "workspace",
    mode: "chatgpt",
    newChatSelected: false,
    workspaceNotice: "",
    isCompact: false,
    isRightMaximized: false,
    hasRightColumn: false,
    hasWorkbenchHost: false,
    leftDragCollapsed: false,
    rightDragCollapsed: false,
    onToggleLeft: () => {},
    onToggleRight: () => {},
  }));

  assert.match(markup, new RegExp(locales.zh.headline, "u"));
  assert.doesNotMatch(markup, /data-testid="view-body"/u);
});
