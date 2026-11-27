// 验证共享限高滚动视口的溢出边缘计算、实时自动贴底与手动上滚暂停逻辑，以及 ThinkingBlock 的 SSR 渲染结构。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { measureBoundedScrollEdges, resolveBoundedScrollFollow } from "../client/conversation/useBoundedScroll";

(globalThis as { React?: typeof React }).React = React;

const { ThinkingBlock } = await import("../client/conversation/Thinking-Block");

test("measureBoundedScrollEdges 在短内容时不启用滚动与渐隐，超限时按位置切换上下渐隐", () => {
  assert.deepEqual(measureBoundedScrollEdges(0, 180, 240), {
    fadeTop: false,
    fadeBottom: false,
    scrollable: false,
  });
  assert.deepEqual(measureBoundedScrollEdges(0, 242, 240), {
    fadeTop: false,
    fadeBottom: false,
    scrollable: false,
  });
  assert.deepEqual(measureBoundedScrollEdges(0, 600, 240), {
    fadeTop: false,
    fadeBottom: true,
    scrollable: true,
  });
  assert.deepEqual(measureBoundedScrollEdges(120, 600, 240), {
    fadeTop: true,
    fadeBottom: true,
    scrollable: true,
  });
  assert.deepEqual(measureBoundedScrollEdges(360, 600, 240), {
    fadeTop: true,
    fadeBottom: false,
    scrollable: true,
  });
});

test("resolveBoundedScrollFollow 在用户主动上滚时暂停贴底，滚回底部阈值内后恢复跟随", () => {
  // 在底部时向上滚动阅读前文：立刻暂停跟随。
  assert.equal(resolveBoundedScrollFollow(true, 300, 220, 300), false);
  // 暂停状态下略微往下滚但仍远离底部：保持暂停，不抢滚动条。
  assert.equal(resolveBoundedScrollFollow(false, 220, 250, 300), false);
  // 滚回距底阈值（16px）以内：恢复实时贴底跟随。
  assert.equal(resolveBoundedScrollFollow(false, 250, 288, 300), true);
  // 内容继续变长且已暂停跟随：保持暂停。
  assert.equal(resolveBoundedScrollFollow(false, 220, 220, 420), false);
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