// 验证资料库「图像」分类的筛选、空态/错误态与卡片渲染，界面不暴露磁盘绝对路径。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { LibraryMediaGrid } = await import("../client/views/LibraryMediaGrid");
const { zhMessages } = await import("@lfaa/client-ui-chat/client");
const { enMessages } = await import("@lfaa/client-ui-chat/client");

const items = [
  {
    path: "C:\\ws\\.lfaa-media\\images\\a.png",
    name: "a.png",
    kind: "image" as const,
    bytes: 2048,
    createdAt: 1_762_000_000_000,
    prompt: "海边悬崖",
    model: "wan2.7-image",
  },
  { path: "C:\\ws\\.lfaa-media\\videos\\b.mp4", name: "b.mp4", kind: "video" as const, bytes: 4096, createdAt: 1_762_000_000_000 },
];

test("图像分类渲染类型筛选与卡片，提示词作为标题且不写磁盘路径", () => {
  const markup = renderToStaticMarkup(createElement(LibraryMediaGrid, {
    locale: zhMessages,
    items,
    loading: false,
    error: null,
    query: "",
    onSelect: () => {},
  }));
  assert.match(markup, /role="group" aria-label="图像"/u);
  assert.match(markup, /海边悬崖/u);
  assert.match(markup, /b\.mp4/u);
  assert.match(markup, /图片/u);
  assert.match(markup, /视频/u);
  assert.match(markup, /语音/u);
  assert.doesNotMatch(markup, /\.lfaa-media/u);
  assert.doesNotMatch(markup, /C:\\/u);
});

test("搜索无匹配时显示筛选空态，素材为空时显示生成引导", () => {
  const noMatch = renderToStaticMarkup(createElement(LibraryMediaGrid, {
    locale: enMessages,
    items,
    loading: false,
    error: null,
    query: "not-there",
    onSelect: () => {},
  }));
  assert.match(noMatch, /No generated media matches the filter/u);
  assert.doesNotMatch(noMatch, /海边悬崖/u);

  const empty = renderToStaticMarkup(createElement(LibraryMediaGrid, {
    locale: zhMessages,
    items: [],
    loading: false,
    error: null,
    query: "",
    onSelect: () => {},
  }));
  assert.match(empty, /还没有生成的图片或视频/u);

  const failed = renderToStaticMarkup(createElement(LibraryMediaGrid, {
    locale: zhMessages,
    items: [],
    loading: false,
    error: "load",
    query: "",
    onSelect: () => {},
  }));
  assert.match(failed, /role="alert"/u);
  assert.match(failed, /加载生成素材失败/u);

  const loading = renderToStaticMarkup(createElement(LibraryMediaGrid, {
    locale: enMessages,
    items: [],
    loading: true,
    error: null,
    query: "",
    onSelect: () => {},
  }));
  assert.match(loading, /Loading generated media/u);
});