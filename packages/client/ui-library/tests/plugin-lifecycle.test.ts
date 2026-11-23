// 验证 @lfaa/library/client 注册资料库视图、右栏检视器与存储设置页，并在卸载时全部撤销。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// CSS 必须先注册加载钩子，再动态引入客户端插件（静态 import 会先于钩子执行）。
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

test("libraryClientPlugin 注册资料库贡献并在 dispose 时撤销", async () => {
  const { Context } = await import("@deepseek-ai/cordis");
  const { chatClientPlugin } = await import("@lfaa/client-ui-chat/client");
  const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
  const { libraryClientPlugin } = await import("../client/index");

  const ctx = new Context();
  new WorkbenchClientService(ctx);
  const chatFiber = ctx.plugin(chatClientPlugin);
  await chatFiber;

  try {
    const libraryFiber = ctx.plugin(libraryClientPlugin);
    await libraryFiber;

    const snap = ctx.workbench.getSnapshot();
    assert.ok(snap.views.some((view) => view.id === "library"), "应注册资料库视图");
    assert.ok(snap.views.some((view) => view.id === "settings:storage"), "应注册存储设置页");
    assert.ok(snap.contextPanels.some((panel) => panel.id === "library-inspector"), "应注册资料库检视器");

    await libraryFiber.dispose();
    const after = ctx.workbench.getSnapshot();
    assert.equal(after.views.some((view) => view.id === "library"), false);
    assert.equal(after.views.some((view) => view.id === "settings:storage"), false);
    assert.equal(after.contextPanels.some((panel) => panel.id === "library-inspector"), false);
  } finally {
    await chatFiber.dispose();
  }
});