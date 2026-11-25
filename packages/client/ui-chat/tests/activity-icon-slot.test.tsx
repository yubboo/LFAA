// 验证同级活动行（工具行 / 文件活动行）都以统一的「图标槽」开头：槽位等宽后，类型图标中心与动词起点才能对齐（开发规范 §3.5）。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getChatLocale } from "../client/locales";
import type { AgentStepItem } from "../client/store/chat-types";

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

const { ToolStepRow } = await import("../client/conversation/Tool-Step-Row");

/** 用真实工具步骤渲染单行，供图标槽结构断言。 */
function renderRow(step: AgentStepItem, live = false) {
  const locale = getChatLocale();
  return renderToStaticMarkup(
    createElement(ToolStepRow, {
      step,
      locale,
      live,
      onOpenFile: () => {},
    }),
  );
}

test("工具行与文件活动行都以统一图标槽起头，动词紧随其后", () => {
  const toolStep: AgentStepItem = {
    id: "step-grep",
    iteration: 1,
    phase: "act",
    status: "done",
    title: "检索内容",
    toolName: "grep",
    toolTarget: "src/test/java/com/lfaa/signin",
    timestamp: 2000,
  };
  const fileStep: AgentStepItem = {
    id: "step-read",
    iteration: 1,
    phase: "act",
    status: "done",
    title: "读取文件",
    toolName: "read_file",
    toolTarget: "src/main/java/Text.java",
    timestamp: 2000,
  };

  const rows = [renderRow(toolStep), renderRow(fileStep)];

  // 第一层就是图标槽，且槽内直接是图标；动词在槽之后，两行的动词起点才能落在同一像素。
  // 断言用结构标记而不是文案：界面语言可能是中文或英文，按文本比对会在英文环境误报。
  for (const html of rows) {
    assert.notEqual(html.indexOf("data-activity-verb"), -1, "行的动词元素必须带 data-activity-verb 标记");
    assert.match(html, /data-icon-slot="true"[^>]*>\s*<svg/u);
    assert.ok(html.indexOf("data-icon-slot") < html.indexOf("data-activity-verb"));
  }
});
