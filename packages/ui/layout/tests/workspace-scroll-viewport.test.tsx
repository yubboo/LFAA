// 验证 ShellWorkspace 把顶栏与内容滚动区拆开：设置中心等长页面出现滚动条时不再挤压标题栏与正文宽度。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkbenchSnapshot } from "../client/workbench-service";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { ShellWorkspace } = await import("../client/shell/ShellWorkspace");
const { locales } = await import("../client/locales");

const snapshot: WorkbenchSnapshot = {
  activeView: "settings:appearance",
  activeProjectId: null,
  settingsReturnView: null,
  activeLibraryTab: "all",
  activeDomainItem: "",
  workspaceMode: "chatgpt",
  leftSidebarOpen: true,
  rightPanelOpen: false,
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
};

test("中间区域把顶栏与内容滚动区拆开，正文位于滚动区内", () => {
  const markup = renderToStaticMarkup(createElement(ShellWorkspace, {
    snapshot,
    locale: locales.zh,
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

  // 顶栏直接挂在中间区域下，内容滚动区紧随其后，避免滚动条挤压顶栏宽度。
  assert.match(markup, /<main[^>]*><header class="workspaceBar"/u);
  const viewportStart = markup.indexOf('class="workspaceViewport"');
  assert.ok(viewportStart > markup.indexOf('class="workspaceBar"'), "内容滚动区应位于顶栏之后");
  const viewportMarkup = markup.slice(viewportStart);
  assert.match(viewportMarkup, /data-testid="view-body"/u);
  assert.doesNotMatch(viewportMarkup, /class="workspaceBar"/u);
});