// 验证用户消息附件能进入对话气泡并提供可理解的图片加载状态。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, k) => String(k) });" };
    }
    return nextLoad(url, context);
  },
});

const { UserMessageAttachments } = await import("../client/conversation/UserMessageAttachments");

test("用户消息附件显示加载状态并使用中英文可访问标签", () => {
  const attachments = [{ id: "uploaded-image", kind: "image" as const }];
  const markup = renderToStaticMarkup(createElement(UserMessageAttachments, {
    attachments,
    sessionId: "session-1",
    isZh: true,
  }));
  assert.match(markup, /role="group" aria-label="消息图片附件"/u);
  assert.match(markup, /媒体加载中/u);
  assert.doesNotMatch(markup, /uploaded-image/u);

  const english = renderToStaticMarkup(createElement(UserMessageAttachments, {
    attachments,
    sessionId: "session-1",
    isZh: false,
  }));
  assert.match(english, /Message image attachments/u);
  assert.match(english, /Loading media/u);
});

test("引用图与附件共用同一组缩略图，空数组时不渲染", () => {
  const markup = renderToStaticMarkup(createElement(UserMessageAttachments, {
    attachments: [{ id: "uploaded-image", kind: "image" as const }],
    references: [{ messageId: "assistant-1", path: "C:\\ws\\.lfaa-media\\images\\a.png" }],
    sessionId: "session-1",
    isZh: true,
  }));
  // 两张图都处在加载中，且不把本地路径直接写进标记里。
  assert.equal((markup.match(/媒体加载中/gu) ?? []).length, 2);
  assert.doesNotMatch(markup, /\.lfaa-media/u);

  const empty = renderToStaticMarkup(createElement(UserMessageAttachments, {
    attachments: [],
    references: [],
    sessionId: null,
    isZh: true,
  }));
  assert.equal(empty, "");
});
