// 验证界面贡献「可拆卸」：注册的视图/上下文面板被 dispose 后只移除自己，其余贡献与外壳照常渲染。
// 这是「删一块界面不连带删能力」的最小自动化证据；对应 docs/architecture/structure.md 的可拆卸验收。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Context } from "@deepseek-ai/cordis";

(globalThis as { React?: typeof React }).React = React;

const { WorkbenchClientService } = await import("../client/workbench-service");
const { ShellWorkspace } = await import("../client/shell/ShellWorkspace");
const { locales } = await import("../client/locales");

/** 服务构造会读 localStorage 偏好；测试里用内存实现替换，结束后还原。 */
function installMockWindowStorage() {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  };
  return {
    restore() {
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window: unknown }).window = prevWindow;
      }
    },
  };
}

test("卸载一个视图贡献后，其余贡献与外壳照常存在", () => {
  const mock = installMockWindowStorage();
  try {
    const service = new WorkbenchClientService(new Context());
    const disposeLibrary = service.registerView({
      id: "library",
      title: "资料库",
      render: () => createElement("section", { "data-testid": "library-view" }, "资料库"),
    });
    const disposeReview = service.registerView({
      id: "codeReview",
      title: "代码审查",
      render: () => createElement("section", { "data-testid": "review-view" }, "代码审查"),
    });
    assert.deepEqual(service.getSnapshot().views.map((view) => view.id), ["library", "codeReview"]);

    // 只卸掉资料库：代码审查还在，工作台快照立即重算。
    disposeLibrary();
    assert.deepEqual(service.getSnapshot().views.map((view) => view.id), ["codeReview"]);

    // 重复卸载是安全的（disposer 幂等）。
    disposeLibrary();
    assert.deepEqual(service.getSnapshot().views.map((view) => view.id), ["codeReview"]);
    disposeReview();
    assert.deepEqual(service.getSnapshot().views.map((view) => view.id), []);
  } finally {
    mock.restore();
  }
});

test("视图全部卸下后中央列回退欢迎页而不是崩溃", () => {
  const mock = installMockWindowStorage();
  try {
    const service = new WorkbenchClientService(new Context());
    service.navigate("workspace", null);
    const snapshot = service.getSnapshot();
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

    assert.match(markup, new RegExp(locales.zh.headline, "u"));
  } finally {
    mock.restore();
  }
});

test("卸载一个上下文面板不影响另一个面板", () => {
  const mock = installMockWindowStorage();
  try {
    const service = new WorkbenchClientService(new Context());
    const disposeFiles = service.registerContextPanel({
      id: "files",
      title: "文件",
      chrome: "workbench",
      render: () => createElement("div", null, "文件"),
    });
    service.registerContextPanel({
      id: "git",
      title: "变更",
      chrome: "workbench",
      render: () => createElement("div", null, "变更"),
    });
    assert.deepEqual(service.getSnapshot().contextPanels.map((panel) => panel.id), ["files", "git"]);

    disposeFiles();
    assert.deepEqual(service.getSnapshot().contextPanels.map((panel) => panel.id), ["git"]);
  } finally {
    mock.restore();
  }
});