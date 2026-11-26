// 回归：历史持久化里残留的空白浏览器状态，在文件标签已打开时不得再渲染出一个「新标签页」。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

/** 只提供 localStorage 的最小 window 桩，用于模拟「上次退出时留下了空白浏览器状态」。 */
function installWindowStub(persisted: Record<string, string>): () => void {
  const memory = new Map<string, string>(Object.entries(persisted));
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  };
  const stub = globalThis as unknown as { window?: unknown };
  const previous = stub.window;
  stub.window = { localStorage };
  return () => { stub.window = previous; };
}

const { ChatClientStore } = await import("../client/store/chat-store");
const { getChatLocale } = await import("../client/locales");
const { RightWorkbenchPane } = await import("../client/workbench/RightWorkbenchPane");

test("文件标签已打开时不再渲染历史残留的空白「新标签页」", () => {
  const restoreWindow = installWindowStub({
    "lfaa:workbench-state:v1:default": JSON.stringify({ browserOpen: true, browserUrl: "" }),
  });
  try {
    const store = new ChatClientStore();
    store.openWorkspaceFile("proj-1", "E:/lfaa/tsdown.config.ts", "tsdown.config.ts");
    const html = renderToStaticMarkup(createElement(RightWorkbenchPane, {
      locale: getChatLocale(),
      store,
      boundProjectId: "proj-1",
      boundProjectName: "lfaa",
      showFilePreview: true,
      onOpenSettings: () => {},
    }));

    assert.ok(html.includes("tsdown.config.ts"));
    assert.ok(!html.includes("新标签页"));
    assert.ok(!html.includes("New Tab"));
    assert.equal((html.match(/role="tab"/gu) ?? []).length, 1, "标签栏只应有用户打开的文件标签");
  } finally {
    restoreWindow();
  }
});
