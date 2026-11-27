// 设置中心「键盘快捷键」页回归：只渲染已注册的真实动作，键位与动作标题来自工作台注册表。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
const { Context } = await import("@deepseek-ai/cordis");
const { ShortcutsSettingsView } = await import("../client/settings/ShortcutsSettingsView");
const { getChatLocale } = await import("../client/locales");
type ChatLocaleMessages = Awaited<ReturnType<typeof getChatLocale>>;

test("快捷键设置页列出已注册动作与键位，未注册动作不出现", () => {
  const service = new WorkbenchClientService(new Context());
  const disposeOne = service.registerShortcut({
    id: "test.one",
    group: "global",
    title: { zh: "测试动作一", en: "Test action one" },
    description: { zh: "演示说明", en: "Demo description" },
    defaultKeys: "Ctrl+Alt+K",
    run: () => {},
  });
  const disposeTwo = service.registerShortcut({
    id: "test.two",
    group: "workbench",
    title: { zh: "测试动作二", en: "Test action two" },
    description: { zh: "未分配键位", en: "Unassigned" },
    defaultKeys: null,
    run: () => {},
  });

  const html = renderToStaticMarkup(createElement(ShortcutsSettingsView, {
    locale: { isZh: true } as ChatLocaleMessages,
    workbench: service,
  }));

  assert.ok(html.includes("测试动作一"));
  assert.ok(html.includes("Ctrl+Alt+K"));
  assert.ok(html.includes("测试动作二"));
  assert.ok(html.includes("未分配"));
  assert.ok(html.includes("恢复默认") || html.includes("全部恢复默认"));
  assert.ok(!html.includes("未注册动作"));

  disposeOne();
  disposeTwo();
  const after = renderToStaticMarkup(createElement(ShortcutsSettingsView, {
    locale: { isZh: true } as ChatLocaleMessages,
    workbench: service,
  }));
  assert.ok(!after.includes("测试动作一"));
});
