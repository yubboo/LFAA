// 验证工作区中央与左二滚动视口预留稳定槽位，长内容出现滚动条时不挤动标题与列表内容。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath } from "node:url";
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

test("左二会话项目列表常驻预留右侧滚动条槽位", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const css = await readFile(resolve(packageRoot, "client/panels/SidebarSectionList.module.css"), "utf8");
  const groupsRule = css.match(/\.groups\s*\{(?<body>[\s\S]*?)\}/u)?.groups?.body ?? "";

  assert.ok(groupsRule, "应能找到左二列表滚动容器样式");
  assert.match(groupsRule, /scrollbar-gutter:\s*stable\s*;/u);
  assert.doesNotMatch(groupsRule, /scrollbar-gutter:\s*stable\s+both-edges\s*;/u);
  // 与会话栏同口径：滚动条右缘离分隔线 2px（Shell 统一定义）。
  assert.match(groupsRule, /margin-inline-end:\s*var\(--pane-scrollbar-gap,\s*2px\)/u);
});

test("Shell 统一给出 2px 的滚动条与分隔线间隙", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const shellCss = await readFile(resolve(packageRoot, "client/shell/WorkbenchShell.module.css"), "utf8");
  assert.match(shellCss, /--pane-scrollbar-gap:\s*2px/u);
});

test("调宽手柄向中间会话区只覆盖 2px，给滚动条留出间隙", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const css = await readFile(resolve(packageRoot, "client/shell/ResizeHandle.module.css"), "utf8");

  assert.match(css, /--resize-handle-inner:\s*2px/u);
  // 左右手柄都在「有滚动条的一侧」只压 2px，可见分隔线仍压在栏边界上。
  assert.match(css, /\.resizeHandleLeft\s*\{[^}]*right:\s*calc\(var\(--resize-handle-inner\)\s*-\s*var\(--resize-handle-width\)\)/u);
  assert.match(css, /\.resizeHandleRight\s*\{[^}]*left:\s*calc\(-1\s*\*\s*var\(--resize-handle-inner\)\)/u);
  assert.match(css, /\.resizeHandleRight::after\s*\{[^}]*left:\s*var\(--resize-handle-inner\)/u);
  assert.match(css, /\.resizeHandleLeft::after\s*\{[^}]*left:\s*var\(--resize-handle-inner\)/u);
});
