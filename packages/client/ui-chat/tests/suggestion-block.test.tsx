// 验证追问建议解析：正文与隐藏块拆分、流式半截标记不外泄、容错与建议胶囊渲染。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const { splitSuggestionBlock, dedupeSuggestions } = await import("../client/conversation/suggestion-block");
const { SuggestionChips } = await import("../client/conversation/SuggestionChips");

test("建议隐藏块从正文剥离并解析成短句", () => {
  const raw = "结论写完了。\n\n<!--suggestions:[\"帮我补一份验收清单\",\"继续修剩下的两个用例\"]-->";
  const result = splitSuggestionBlock(raw);
  assert.equal(result.content, "结论写完了。");
  assert.deepEqual(result.suggestions, ["帮我补一份验收清单", "继续修剩下的两个用例"]);
});

test("流式未闭合时正文不露出半截标记", () => {
  assert.equal(splitSuggestionBlock("正在回答<!--sugg").content, "正在回答");
  assert.equal(splitSuggestionBlock("正在回答<!--suggestions:[\"还没写完").content, "正在回答");
  const incomplete = splitSuggestionBlock("正在回答<!--suggestions:[\"还没写完");
  assert.deepEqual(incomplete.suggestions, []);
});

test("非 JSON 块按行兜底，最多保留三条", () => {
  const raw = [
    "正文",
    "<!--suggestions:",
    "- 先跑构建",
    "- 再补单测",
    "- 最后截图验收",
    "- 第四条应被丢弃",
    "-->",
  ].join("\n");
  const result = splitSuggestionBlock(raw);
  assert.equal(result.content, "正文");
  assert.deepEqual(result.suggestions, ["先跑构建", "再补单测", "最后截图验收"]);
});

test("历史建议去重：忽略标点与大小写，并去掉本轮内部重复", () => {
  const fresh = dedupeSuggestions(
    ["帮我补测试。", "继续修剩下的两个用例", "帮我补测试", "继续修剩下的两个用例"],
    ["帮我补测试", "先跑构建"],
  );
  assert.deepEqual(fresh, ["继续修剩下的两个用例"]);
});

test("建议胶囊渲染文本与箭头", () => {
  const markup = renderToStaticMarkup(createElement(SuggestionChips, {
    suggestions: ["帮我补一份验收清单"],
    onSelect: () => {},
  }));
  assert.match(markup, /帮我补一份验收清单/u);
  assert.match(markup, /<button type="button" class="chip"/u);
  assert.match(markup, /<svg/u);
});