// 验证 Markdown 图片语法接入聊天渲染：本机媒体走 LocalMediaImage（SSR 阶段显示加载占位），不再输出原始 ![] 文本。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { MarkdownContent } = await import("../client/conversation/MarkdownContent");
const { normalizeLegacyMediaOutput } = await import("../client/conversation/markdown-parser");

test("旧版媒体输出（列表里的绝对路径）只保留图片，路径不再进入正文", () => {
  const legacy = [
    "已用模型 wan2.7-image 生成 1 张图片（耗时 7 秒）。",
    "- 本地文件：C:\\ws\\lfaa-media\\images\\a.png（7510.8 KB）",
    "  ![wan2.7-image 生成图片](/api/media/file?path=E%3A%5Ca.png)",
  ].join("\n");
  const normalized = normalizeLegacyMediaOutput(legacy);
  assert.doesNotMatch(normalized, /本地文件：/u);
  assert.doesNotMatch(normalized, /[A-Za-z]:\\/u);
  assert.doesNotMatch(normalized, /已保存：/u);
  assert.match(normalized, /\n\n!\[wan2\.7-image 生成图片\]/u);

  const html = renderToStaticMarkup(createElement(MarkdownContent, { content: legacy, isZh: true }));
  assert.doesNotMatch(html, /本地文件：/u);
  assert.doesNotMatch(html, /C:\\ws/u);
  assert.doesNotMatch(html, /<li>/u);
  assert.match(html, /已用模型 wan2\.7-image/u);
  assert.match(html, /媒体加载中/u);
});

test("过渡版「已保存：文件名（大小）」也会被收掉，只留图片", () => {
  const legacy = "已用 wan2.7-image 生成 1 张图片（耗时 7 秒）。\n\n![生成图片](/api/media/file?path=E%3A%5Ca.png)\n\n已保存：a.png（8.1 MB）";
  const normalized = normalizeLegacyMediaOutput(legacy);
  assert.doesNotMatch(normalized, /已保存：/u);
  assert.match(normalized, /!\[生成图片\]/u);
});

test("普通列表与文件名提及不被旧版媒体改写规则误伤", () => {
  const text = "- 本地文件：放在项目根目录\n- 参考 a.png 的写法";
  assert.equal(normalizeLegacyMediaOutput(text), text);
});

test("本机媒体图片渲染为预览组件，而不是原始 Markdown 文本", () => {
  const html = renderToStaticMarkup(createElement(MarkdownContent, {
    content: "生成好了：\n\n![海边日落](/api/media/file?path=E%3A%5Clfaa%5Ca.png)\n",
    isZh: true,
  }));
  assert.doesNotMatch(html, /!\[/u);
  assert.match(html, /媒体加载中/u);
});

test("普通文本与外链图片不破坏原有渲染", () => {
  const html = renderToStaticMarkup(createElement(MarkdownContent, {
    content: "看这个 [链接](https://example.com) 和 `code`",
    isZh: true,
  }));
  assert.match(html, /https:\/\/example\.com/u);
  assert.match(html, /code/u);
  assert.doesNotMatch(html, /媒体加载/u);
});