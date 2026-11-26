// 验证共享胶囊外壳：子内容、类名合并与属性透传，确保左二栏与中间区顶栏消费的是同一份外观。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React from "react";
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

const { CapsuleBar } = await import("../client/index");

test("胶囊外壳渲染子内容并合并调用方类名", () => {
  const markup = renderToStaticMarkup(
    <CapsuleBar className="barCapsule" aria-label="工作区顶部栏">
      <span>首页</span>
    </CapsuleBar>,
  );
  assert.match(markup, /class="capsule barCapsule"/u);
  assert.match(markup, /aria-label="工作区顶部栏"/u);
  assert.match(markup, /<span>首页<\/span>/u);
});

test("没有附加类名时不留下多余空格", () => {
  const markup = renderToStaticMarkup(<CapsuleBar>x</CapsuleBar>);
  assert.match(markup, /class="capsule"/u);
  assert.doesNotMatch(markup, /class="capsule "/u);
});