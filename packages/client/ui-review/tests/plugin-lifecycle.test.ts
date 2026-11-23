// 验证 @lfaa/review/client 注册代码审查工作台，并在卸载时撤销视图贡献。
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

test("reviewClientPlugin 注册代码审查工作台并在 dispose 时撤销", async () => {
  const { Context } = await import("@deepseek-ai/cordis");
  const { chatClientPlugin } = await import("@lfaa/client-ui-chat/client");
  const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
  const { reviewClientPlugin } = await import("../client/index");

  const ctx = new Context();
  new WorkbenchClientService(ctx);
  const chatFiber = ctx.plugin(chatClientPlugin);
  await chatFiber;

  try {
    const reviewFiber = ctx.plugin(reviewClientPlugin);
    await reviewFiber;

    assert.ok(ctx.workbench.getSnapshot().views.some((view) => view.id === "codeReview"), "应注册代码审查工作台");
    assert.ok(ctx.workbench.getSnapshot().views.some((view) => view.id === "settings:git"), "应注册 Git 设置页");
    assert.ok(ctx.workbench.getSnapshot().views.some((view) => view.id === "settings:codeReview"), "应注册代码审查设置页");

    await reviewFiber.dispose();
    const after = ctx.workbench.getSnapshot();
    assert.equal(after.views.some((view) => view.id === "codeReview"), false, "卸载后不应残留代码审查视图");
    assert.equal(after.views.some((view) => view.id === "settings:git"), false, "卸载后不应残留 Git 设置页");
    assert.equal(after.views.some((view) => view.id === "settings:codeReview"), false, "卸载后不应残留审查设置页");
  } finally {
    await chatFiber.dispose();
  }
});