// 验证重构后的右侧工作台面板渲染搜索/URL 栏、6 项工具入口及子智能体/后台任务区块。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatClientStore } from "../client/store/chat-store";
import { getChatLocale } from "../client/locales";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

const { AgentContextPanel } = await import("../client/workbench/AgentContextPanel");
const { RightWorkbenchPane } = await import("../client/workbench/RightWorkbenchPane");
const { RightWorkbenchActions } = await import("../client/workbench/RightWorkbenchActions");
const { RightGitReviewPane } = await import("../client/workbench/RightGitReviewPane");
const { highlightDocumentLines } = await import("../client/conversation/code-highlight");
const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
const { Context } = await import("@deepseek-ai/cordis");

test("AgentContextPanel 渲染搜索/URL 栏、6 项入口、子智能体与后台任务区", () => {
  const store = new ChatClientStore();
  const locale = getChatLocale();
  const html = renderToStaticMarkup(
    createElement(AgentContextPanel, {
      locale,
      store,
      boundProjectName: "lfaa",
      showFilePreview: true,
      onOpenSettings: () => {},
      onOpenCodeReview: () => {},
      onOpenExtensions: () => {},
    }),
  );

  const isZh = locale.isZh;
  assert.ok(html.includes(isZh ? "搜索或输入 URL" : "Search or enter URL"));
  assert.ok(html.includes(isZh ? "审查" : "Review"));
  assert.ok(html.includes(isZh ? "打开文件" : "Open file"));
  assert.ok(html.includes(isZh ? "终端" : "Terminal"));
  assert.ok(html.includes(isZh ? "浏览器" : "Browser"));
  assert.ok(html.includes(isZh ? "侧边提问" : "Side ask"));
  assert.ok(html.includes(isZh ? "扩展" : "Extensions"));
  assert.ok(html.includes(isZh ? "子智能体" : "Subagents"));
  assert.ok(html.includes(isZh ? "后台任务" : "Background tasks"));
});

test("RightWorkbenchPane 渲染顶部标签栏、最右图标轨与工作区文件只读打开及批注回填", () => {
  const store = new ChatClientStore();
  store.openWorkspaceFile("proj-1", "E:/lfaa/src/demo.ts", "src/demo.ts", 42, 42);
  store.enqueueComposerInsert("针对 `src/demo.ts#L42` 修改建议");
  const snap = store.getSnapshot();
  assert.equal(snap.filePreviewTabs.length, 1);
  assert.equal(snap.filePreviewTabs[0]?.targetLine, 42);
  assert.ok(snap.pendingComposerInsert?.text.includes("src/demo.ts#L42"));

  const locale = getChatLocale();
  const html = renderToStaticMarkup(
    createElement(RightWorkbenchPane, {
      locale,
      store,
      boundProjectId: "proj-1",
      boundProjectName: "lfaa",
      showFilePreview: true,
      onOpenSettings: () => {},
      onOpenCodeReview: () => {},
      onOpenExtensions: () => {},
    }),
  );

  const isZh = locale.isZh;
  const normalizedHtml = html.replaceAll("&amp;", "&");
  assert.ok(normalizedHtml.includes("demo.ts"));
  assert.ok(normalizedHtml.includes("L42"));
  assert.ok(normalizedHtml.includes(isZh ? "更多操作" : "More actions"));
  assert.ok(normalizedHtml.includes(isZh ? "刷新" : "Refresh"));
  assert.ok(normalizedHtml.includes(isZh ? "切换侧边栏" : "Toggle sidebar"));
  assert.ok(normalizedHtml.includes(isZh ? "工作区文件树" : "Files"));
  assert.ok(normalizedHtml.includes(isZh ? "工作区上下文" : "Workspace context"));
  assert.ok(normalizedHtml.includes(isZh ? "终端与后台任务" : "Terminal & tasks"));
  assert.ok(normalizedHtml.includes(isZh ? "子智能体团队" : "Subagents"));
});

test("RightWorkbenchPane 启动页提供文件路径、网址及四个快捷入口", () => {
  const locale = getChatLocale();
  const html = renderToStaticMarkup(createElement(RightWorkbenchPane, {
    locale,
    store: new ChatClientStore(),
    boundProjectId: "proj-1",
    boundProjectName: "fixture-project",
    showFilePreview: true,
    onOpenSettings: () => {},
  }));

  assert.ok(html.includes('role="search"'));
  assert.ok(html.includes("fixture-project"));
  assert.ok(html.includes(locale.isZh ? "文件路径或 https:// 网址" : "File path or https:// URL"));
  const groupLabel = locale.isZh ? "快捷操作" : "Shortcuts";
  const group = html.split(`role="group" aria-label="${groupLabel}"`)[1]?.split("</div>")[0] ?? "";
  assert.equal((group.match(/<button\b/gu) ?? []).length, 4);
  for (const label of locale.isZh ? ["终端", "变更", "文件", "侧边提问"] : ["Terminal", "Changes", "Files", "Side chat"]) {
    assert.ok(group.includes(`>${label}</span>`));
  }
});

test("highlightDocumentLines 按嵌套层级配对着色成对标签与括号", () => {
  const rendered = highlightDocumentLines([
    "<div>",
    "  <button onClick={() => {}}>",
    "    <span>ok</span>",
    "  </button>",
    "</div>",
  ]);
  const lineHtml = rendered.map((nodes) => renderToStaticMarkup(createElement(React.Fragment, null, ...nodes)));
  // <div> 与 </div> 颜色序号一致，且与 <button>、<span> 区分
  const divOpenIdx = /data-tag-rainbow="(\d)"/u.exec(lineHtml[0]!)?.[1];
  const divCloseIdx = /data-tag-rainbow="(\d)"/u.exec(lineHtml[4]!)?.[1];
  const btnOpenIdx = /data-tag-rainbow="(\d)"/u.exec(lineHtml[1]!)?.[1];
  const btnCloseIdx = /data-tag-rainbow="(\d)"/u.exec(lineHtml[3]!)?.[1];
  const spanMatches = [...lineHtml[2]!.matchAll(/data-tag-rainbow="(\d)"/gu)].map((m) => m[1]);
  assert.ok(divOpenIdx !== undefined && divOpenIdx === divCloseIdx);
  assert.ok(btnOpenIdx !== undefined && btnOpenIdx === btnCloseIdx && btnOpenIdx !== divOpenIdx);
  assert.equal(spanMatches.length, 2);
  assert.equal(spanMatches[0], spanMatches[1]);
  assert.notEqual(spanMatches[0], btnOpenIdx);
});

test("RightWorkbenchActions 渲染右侧顶栏 4 项去重控制，WorkbenchClientService 支持最大化状态切换与收起复位", () => {
  const store = new ChatClientStore();
  const locale = getChatLocale();
  const html = renderToStaticMarkup(
    createElement(RightWorkbenchActions, {
      isZh: locale.isZh,
      store,
      projectId: "proj-1",
      jobs: [{ id: "j1", sessionId: "s1", title: "pnpm dev", command: "pnpm dev", cwd: ".", status: "running", output: "", startedAt: Date.now() }],
      subagents: [{ id: "a1", sessionId: "s1", role: "Code Reviewer", mode: "read", status: "running", prompt: "", output: "", stepsCount: 2, startedAt: Date.now() }],
      compact: false,
      rightPanelMaximized: false,
      onOpenReviewTab: () => {},
      onOpenFileTree: () => {},
      onOpenTerminal: () => {},
      onOpenSubagents: () => {},
      onNewBrowserTab: () => {},
      onToggleMaximize: () => {},
      onCollapsePanel: () => {},
    }),
  );

  assert.ok(html.includes(locale.isZh ? "工作台更多选项" : "More workbench options"));
  assert.ok(html.includes(locale.isZh ? "切换概览面板 Ctrl+Alt+O" : "Toggle overview Ctrl+Alt+O"));
  assert.ok(html.includes(locale.isZh ? "最大化窗格 Ctrl+Shift+M" : "Maximize pane"));
  assert.ok(html.includes(locale.isZh ? "切换侧面板 Ctrl+Shift+B" : "Toggle right panel"));
  assert.ok(!html.includes("收起辅助栏"));

  const sessionOnlyHtml = renderToStaticMarkup(
    createElement(RightWorkbenchActions, {
      variant: "sessionOnly",
      isZh: locale.isZh,
      store,
      projectId: "proj-1",
    }),
  );
  assert.ok(sessionOnlyHtml.includes(locale.isZh ? "工作台更多选项" : "More workbench options"));
  assert.ok(sessionOnlyHtml.includes(locale.isZh ? "切换概览面板 Ctrl+Alt+O" : "Toggle overview Ctrl+Alt+O"));
  assert.ok(!sessionOnlyHtml.includes(locale.isZh ? "最大化窗格 Ctrl+Shift+M" : "Maximize pane"));

  const workbenchOnlyHtml = renderToStaticMarkup(
    createElement(RightWorkbenchActions, {
      variant: "workbenchOnly",
      isZh: locale.isZh,
      store,
      projectId: "proj-1",
      onToggleMaximize: () => {},
      onCollapsePanel: () => {},
    }),
  );
  assert.ok(!workbenchOnlyHtml.includes(locale.isZh ? "工作台更多选项" : "More workbench options"));
  assert.ok(workbenchOnlyHtml.includes(locale.isZh ? "最大化窗格 Ctrl+Shift+M" : "Maximize pane"));
  assert.ok(workbenchOnlyHtml.includes(locale.isZh ? "切换侧面板 Ctrl+Shift+B" : "Toggle right panel"));

  const reviewHtml = renderToStaticMarkup(
    createElement(RightGitReviewPane, {
      isZh: locale.isZh,
      projectId: null,
      store,
    }),
  );
  assert.ok(reviewHtml.includes(locale.isZh ? "先绑定 Git 项目" : "Link a Git project"));
  assert.ok(!reviewHtml.includes("+0"));

  const wb = new WorkbenchClientService(new Context());
  const disposeAction = wb.registerWorkspaceAction({ id: "test-act", render: () => null });
  assert.equal(wb.getSnapshot().workspaceActions.length, 1);
  disposeAction();
  assert.equal(wb.getSnapshot().workspaceActions.length, 0);
  assert.equal(wb.getSnapshot().rightPanelMaximized, false);
  wb.toggleRightPanelMaximized();
  assert.equal(wb.getSnapshot().rightPanelMaximized, true);
  assert.equal(wb.getSnapshot().rightPanelOpen, true);
  wb.setRightPanelOpen(false);
  assert.equal(wb.getSnapshot().rightPanelOpen, false);
  assert.equal(wb.getSnapshot().rightPanelMaximized, false);
});
