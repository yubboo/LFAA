// 验证 ThinkingBlock 思考正文滚动视口的溢出边缘计算、流式自动贴底与手动上滚暂停逻辑，以及 SSR 渲染结构。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { measureThinkingScrollEdges, resolveThinkingFollowBottom } from "../client/conversation/useThinkingScroll";

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

const { ThinkingBlock } = await import("../client/conversation/Thinking-Block");

test("measureThinkingScrollEdges 在短内容时不启用滚动与渐隐，超限时按位置切换上下渐隐", () => {
  assert.deepEqual(measureThinkingScrollEdges(0, 180, 240), {
    fadeTop: false,
    fadeBottom: false,
    scrollable: false,
  });
  assert.deepEqual(measureThinkingScrollEdges(0, 242, 240), {
    fadeTop: false,
    fadeBottom: false,
    scrollable: false,
  });
  assert.deepEqual(measureThinkingScrollEdges(0, 600, 240), {
    fadeTop: false,
    fadeBottom: true,
    scrollable: true,
  });
  assert.deepEqual(measureThinkingScrollEdges(120, 600, 240), {
    fadeTop: true,
    fadeBottom: true,
    scrollable: true,
  });
  assert.deepEqual(measureThinkingScrollEdges(360, 600, 240), {
    fadeTop: true,
    fadeBottom: false,
    scrollable: true,
  });
});

test("resolveThinkingFollowBottom 在用户主动上滚时暂停贴底，滚回底部阈值内后恢复跟随", () => {
  // 在底部时向上滚动阅读前文：立刻暂停跟随。
  assert.equal(resolveThinkingFollowBottom(true, 300, 220, 300), false);
  // 暂停状态下略微往下滚但仍远离底部：保持暂停，不抢滚动条。
  assert.equal(resolveThinkingFollowBottom(false, 220, 250, 300), false);
  // 滚回距底阈值（16px）以内：恢复流式贴底跟随。
  assert.equal(resolveThinkingFollowBottom(false, 250, 288, 300), true);
  // 流式内容继续变长且已暂停跟随：保持暂停。
  assert.equal(resolveThinkingFollowBottom(false, 220, 220, 420), false);
});

test("ThinkingBlock 使用共享 ScrollArea 包裹思考正文并保留折叠结构与行内代码渲染", () => {
  const html = renderToStaticMarkup(
    createElement(ThinkingBlock, {
      label: "思考中…",
      durationText: "6 秒",
      reasoningText: "先检查 `scrollViewport` 样式。\n\n再验证滚动条贴底逻辑。",
      live: true,
      isZh: true,
    }),
  );

  assert.match(html, /class="[^"]*scrollViewport[^"]*"/u);
  assert.match(html, /data-axis="y"/u);
  assert.match(html, /<code class="inlineCode">scrollViewport<\/code>/u);
  assert.match(html, /再验证滚动条贴底逻辑。/u);
  assert.match(html, /aria-expanded="true"/u);
});
