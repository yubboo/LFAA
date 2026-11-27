// 验证输入框右下角动作：运行中显示暂停、中断可续写时显示继续、空闲时显示发送。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { zhMessages } from "../client/locales.zh";

(globalThis as { React?: typeof React }).React = React;

const { ComposerRightActions } = await import("../client/composer/ComposerRightActions");

function render(props: { isRunning: boolean; paused: boolean; canSend?: boolean; draft?: string }) {
  return renderToStaticMarkup(createElement(ComposerRightActions, {
    locale: zhMessages,
    draft: props.draft ?? "",
    canSend: props.canSend ?? false,
    isRunning: props.isRunning,
    paused: props.paused,
    onChangeDraft: () => undefined,
    onSend: () => undefined,
    onStop: () => undefined,
    onContinue: () => undefined,
    onNotice: () => undefined,
  }));
}

test("运行中发送位显示暂停按钮", () => {
  const html = render({ isRunning: true, paused: false });
  assert.match(html, /aria-label="暂停 \(Ctrl\+D\)"/u);
  assert.match(html, /pauseBtn/u);
  assert.doesNotMatch(html, /aria-label="发送"/u);
});

test("中断后发送位显示继续生成按钮", () => {
  const html = render({ isRunning: false, paused: true });
  assert.match(html, /aria-label="继续生成"/u);
  assert.match(html, /continueBtn/u);
  assert.doesNotMatch(html, /aria-label="发送"/u);
});

test("空闲时恢复发送按钮", () => {
  const html = render({ isRunning: false, paused: false, draft: "你好", canSend: true });
  assert.match(html, /aria-label="发送"/u);
  assert.match(html, /sendBtn/u);
  assert.doesNotMatch(html, /aria-label="继续生成"/u);
});