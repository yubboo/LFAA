// 验证「预览区在左」下两列的收起/展开语义：关掉最后一个标签只收预览列，展开时补回分屏。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import type { WorkbenchClientService } from "../client/workbench-service";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { WorkbenchShell } = await import("../client/shell/WorkbenchShell");
const { WorkbenchClientService: Service } = await import("../client/workbench-service");

/** 装配最小的四栏工作台：一个会话视图 + 一个工作台面板，够区分两列渲染什么。 */
function createService(): WorkbenchClientService {
  const service = new Service(new Context());
  service.registerView({
    id: "workspace",
    title: "Workspace",
    render: () => createElement("section", { "data-testid": "chat-view" }, "chat"),
  });
  service.registerContextPanel({
    id: "agent-capabilities",
    title: "Workbench",
    chrome: "workbench",
    render: () => createElement("div", { "data-testid": "workbench-view" }, "workbench"),
  });
  service.navigate("workspace", null);
  return service;
}

test("预览区在左：收起预览列时 AI 会话列仍然展开，不被连带收起", () => {
  const service = createService();
  service.setLayoutMode("preview-center");

  const openMarkup = renderToStaticMarkup(createElement(WorkbenchShell, { service }));
  assert.match(openMarkup, /data-layout="preview-center"/u);
  assert.match(openMarkup, /data-preview-open="true"/u);
  assert.match(openMarkup, /data-right-open="true"/u);
  assert.match(openMarkup, /data-testid="workbench-view"/u);
  assert.match(openMarkup, /data-testid="chat-view"/u);

  // 关闭最后一个标签走的是「收起预览列」：会话列必须留在原位，并由 CSS 接满剩余宽度。
  service.setPreviewPaneOpen(false);
  const closedMarkup = renderToStaticMarkup(createElement(WorkbenchShell, { service }));
  assert.match(closedMarkup, /data-preview-open="false"/u);
  assert.match(closedMarkup, /data-right-open="true"/u);
  assert.match(closedMarkup, /data-testid="chat-view"/u);
  assert.doesNotMatch(closedMarkup, /data-testid="workbench-view"/u);
});

test("预览区在左：预览列收起后点展开恢复分屏，不会让预览区吃掉整片空间", () => {
  const service = createService();
  service.setLayoutMode("preview-center");
  service.setPreviewPaneOpen(false);

  // 分屏才算「展开」：这一下只把预览列补回来，会话列保持可见。
  service.toggleRightPanel();
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.previewPaneOpen, true);
  assert.equal(snapshot.rightPanelOpen, true);

  // 分屏状态下「收起」仍收最右侧的会话列，预览列铺满。
  service.toggleRightPanel();
  assert.equal(service.getSnapshot().rightPanelOpen, false);
  assert.equal(service.getSnapshot().previewPaneOpen, true);

  // 会话列收着时再点一次，恢复分屏。
  service.toggleRightPanel();
  assert.equal(service.getSnapshot().rightPanelOpen, true);
  assert.equal(service.getSnapshot().previewPaneOpen, true);
});

test("预览区在左：任一列收起后另一列必定可见，打开内容能重新放出预览列", () => {
  const service = createService();
  service.setLayoutMode("preview-center");
  service.setPreviewPaneOpen(false);
  assert.equal(service.getSnapshot().previewPaneOpen, false);
  assert.equal(service.getSnapshot().rightPanelOpen, true);

  // 打开文件 / 终端等入口统一走 setRightPanelOpen(true)：预览列要回来，新标签页才有落点。
  service.setRightPanelOpen(true);
  assert.equal(service.getSnapshot().previewPaneOpen, true);

  // 会话列已经收起时再收预览列，必须把会话列放出来，避免整片空白。
  service.setRightPanelOpen(false);
  service.setPreviewPaneOpen(false);
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.previewPaneOpen, false);
  assert.equal(snapshot.rightPanelOpen, true);
});

test("预览区在左：最大化工作台与切回该排版都会恢复预览列", () => {
  const service = createService();
  service.setLayoutMode("preview-center");
  service.setPreviewPaneOpen(false);

  // 最大化针对工作台：预览列收着时先放出来，否则只会得到一条 0 宽的会话列。
  service.toggleRightPanelMaximized();
  assert.equal(service.getSnapshot().previewPaneOpen, true);
  assert.equal(service.getSnapshot().rightPanelMaximized, true);

  service.toggleRightPanelMaximized();
  service.setPreviewPaneOpen(false);
  service.setLayoutMode("chat-center");
  service.setLayoutMode("preview-center");
  assert.equal(service.getSnapshot().previewPaneOpen, true);
});

test("预览列状态写入独立偏好键，刷新后保持", () => {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    },
  };
  try {
    const service = createService();
    service.setLayoutMode("preview-center");
    service.setPreviewPaneOpen(false);
    assert.equal(store.get("lfaa:preview-pane-open"), "false");
    assert.equal(new Service(new Context()).getSnapshot().previewPaneOpen, false);
  } finally {
    if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window: unknown }).window = prevWindow;
  }
});

test("预览列收起时中间轨道归零、会话列占满剩余宽度，且不再压一条左分隔线", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const css = await readFile(resolve(packageRoot, "client/shell/WorkbenchShell.module.css"), "utf8");
  const collapsedRules = css.match(
    /\.shell\[data-layout="preview-center"\]\[data-preview-open="false"\]\s*\{(?<body>[^}]*)\}/u,
  )?.groups?.body ?? "";

  assert.ok(collapsedRules, "应能找到「预览列收起」的轨道规则");
  assert.match(collapsedRules, /--center-pane-track:\s*0px/u);
  assert.match(collapsedRules, /--right-pane-track:\s*minmax\(0,\s*1fr\)/u);
  assert.match(
    css,
    /\.shell\[data-layout="preview-center"\]\[data-preview-open="false"\]\s*>\s*\.workspace\s*\{[^}]*border-left:\s*0/u,
  );
});