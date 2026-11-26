// 验证「新建标签页」快捷键在工作台收起时也能生效：先把工作台展开，再切到浏览器标签舞台。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { ChatClientStore } = await import("../client/store/chat-store");
const { registerChatShortcuts } = await import("../client/shortcut-actions");
const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");

test("新建标签页快捷键：工作台收起时自动展开，并切到浏览器标签页", async () => {
  const workbench = new WorkbenchClientService(new Context());
  const store = new ChatClientStore();
  const disposers = registerChatShortcuts({ workbench, store, closeSessionMenus: () => {} });
  try {
    workbench.setRightPanelOpen(false, false);
    assert.equal(workbench.runShortcut("workbench.new-tab"), true);
    assert.equal(workbench.getSnapshot().rightPanelOpen, true, "快捷键应自动展开工作台");

    // 宿主建标签是异步请求（本地测试环境没有服务端），等一拍让刷新请求落到舞台。
    await new Promise((resolve) => { setTimeout(resolve, 30); });
    assert.equal(store.getSnapshot().rightPanelRequest?.tab, "browser");
  } finally {
    for (const dispose of disposers) dispose();
  }
});

test("新建标签页快捷键：预览区在左且预览列收起时，连同预览列一起放出来", async () => {
  const workbench = new WorkbenchClientService(new Context());
  const store = new ChatClientStore();
  const disposers = registerChatShortcuts({ workbench, store, closeSessionMenus: () => {} });
  try {
    workbench.setLayoutMode("preview-center");
    workbench.setPreviewPaneOpen(false);
    workbench.setRightPanelOpen(false, false);
    assert.equal(workbench.runShortcut("workbench.new-tab"), true);
    const snapshot = workbench.getSnapshot();
    assert.equal(snapshot.rightPanelOpen, true);
    assert.equal(snapshot.previewPaneOpen, true, "预览列收起时按快捷键也要恢复分屏");
  } finally {
    for (const dispose of disposers) dispose();
  }
});

test("新建标签页快捷键已登记在插件级，工作台收起也存在于快捷键列表", () => {
  const workbench = new WorkbenchClientService(new Context());
  const store = new ChatClientStore();
  const disposers = registerChatShortcuts({ workbench, store, closeSessionMenus: () => {} });
  try {
    const action = workbench.getSnapshot().shortcuts.find((item) => item.id === "workbench.new-tab");
    assert.ok(action, "快捷键动作应已注册");
    assert.equal(action.keys, "Ctrl+Alt+B");
  } finally {
    for (const dispose of disposers) dispose();
  }
});