// 验证右栏检视器：未选中展示存储概览，选中媒体展示提示词与操作，选中资产时先显示读取态。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChatClientStore } from "@lfaa/chat/client";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { LibraryInspector } = await import("../client/views/LibraryInspector");
const { librarySelectionStore } = await import("@lfaa/tool-media/client");
const { zhMessages } = await import("@lfaa/chat/client");
const { enMessages } = await import("@lfaa/chat/client");

const assetItem = {
  id: "asset-1",
  category: "artifact" as const,
  title: "验收报告",
  fileName: "report.md",
  relativePath: "agent-outputs/report.md",
  mimeType: "text/markdown",
  sizeBytes: 2048,
  tags: [],
  projectId: null,
  createdAt: 1_762_000_000_000,
  updatedAt: 1_762_000_000_000,
};

const store = {
  subscribe: () => () => {},
  getSnapshot: () => ({
    libraryAssets: [assetItem],
    memories: [],
    storageState: {
      dataRoot: "C:\\Users\\yu\\.lfaa\\data",
      defaultDataRoot: "C:\\Users\\yu\\.lfaa\\data",
      recommendedProjectDataRoot: "C:\\Users\\yu\\.lfaa\\data",
      mode: "default" as const,
      updatedAt: 1,
    },
  }),
  readLibraryAsset: async () => ({ item: assetItem, isText: true, content: "报告内容" }),
  removeLibraryAsset: async () => {},
  openStorageFolderInExplorer: async () => ({ opened: true, path: "" }),
} as unknown as ChatClientStore;

function render(locale: typeof zhMessages) {
  return renderToStaticMarkup(createElement(LibraryInspector, {
    locale,
    store,
    onOpenStorageSettings: () => {},
  }));
}

test("未选中时展示资料库概览、存储目录与四类数量", () => {
  librarySelectionStore.clear();
  const markup = render(zhMessages);
  assert.match(markup, /data-region="library-inspector"/u);
  assert.match(markup, /资料库概览/u);
  assert.match(markup, /存储目录/u);
  assert.match(markup, /\.lfaa\\data/u);
  assert.match(markup, /图像/u);
  assert.match(markup, /Agent 产物/u);
  assert.match(markup, /Agent 记忆/u);
  assert.match(markup, /点选左侧任意一张卡片/u);
});

test("选中媒体时展示提示词、模型与操作，且不写磁盘路径", () => {
  librarySelectionStore.set({
    kind: "media",
    item: {
      path: "C:\\ws\\.lfaa-media\\images\\a.png",
      name: "a.png",
      kind: "image",
      bytes: 2048,
      createdAt: 1_762_000_000_000,
      prompt: "海边悬崖",
      model: "wan2.7-image",
    },
  });
  try {
    const markup = render(zhMessages);
    assert.match(markup, /媒体详情/u);
    assert.match(markup, /海边悬崖/u);
    assert.match(markup, /wan2\.7-image/u);
    assert.match(markup, /复制提示词/u);
    assert.match(markup, /删除素材/u);
    assert.doesNotMatch(markup, /\.lfaa-media/u);
    assert.doesNotMatch(markup, /C:\\/u);
  } finally {
    librarySelectionStore.clear();
  }
});

test("选中资产时先显示读取状态，英文概览文案可本地化", () => {
  librarySelectionStore.set({ kind: "asset", id: "asset-1", title: "验收报告" });
  try {
    const markup = render(zhMessages);
    assert.match(markup, /资产内容/u);
    assert.match(markup, /正在读取/u);
  } finally {
    librarySelectionStore.clear();
  }

  const overview = render(enMessages);
  assert.match(overview, /Library overview/u);
  assert.match(overview, /Storage directory/u);
});