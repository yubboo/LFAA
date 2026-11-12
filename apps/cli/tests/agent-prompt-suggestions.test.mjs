/** 功能：验证 Agent 回复建议协议的分块解析、正文隔离和资源上限。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createPromptSuggestionStream, extractPromptSuggestionsFromVisibleAnswer, promptSuggestionInstruction } from "../../../packages/core/agent-loop/src/prompt-suggestions.ts";

const OPEN = "<lfaa-prompt-suggestions>";
const CLOSE = "</lfaa-prompt-suggestions>";

test("逐字符到达的尾部建议标签被隐藏并提取为建议数组", () => {
  const parser = createPromptSuggestionStream();
  const answer = "已完成本轮检查。";
  const suggestions = ["补一条失败路径回归。", "再检查手机窄屏的按钮换行。"];
  const raw = `${answer}\n${OPEN}${JSON.stringify({ items: suggestions })}${CLOSE}`;
  let visible = "";
  for (const character of raw) visible += parser.push(character);
  const end = parser.finishRound(true);

  assert.equal(visible + end.visibleDelta, `${answer}\n`);
  assert.deepEqual(end.suggestions, suggestions);
});

test("非最终轮次与未闭合/超长元数据不泄漏建议", () => {
  const toolRound = createPromptSuggestionStream();
  let toolVisible = toolRound.push(`过程文字${OPEN}{"items":["不应展示"]}${CLOSE}`);
  const toolEnd = toolRound.finishRound(false);
  toolVisible += toolEnd.visibleDelta;
  assert.equal(toolVisible, "过程文字");
  assert.deepEqual(toolEnd.suggestions, []);

  const incomplete = createPromptSuggestionStream();
  assert.equal(incomplete.push(`答案${OPEN}{"items":[`), "答案");
  assert.deepEqual(incomplete.finishRound(true), { visibleDelta: "", suggestions: [] });

  const oversized = createPromptSuggestionStream();
  oversized.push(`${OPEN}${"x".repeat(2100)}`);
  oversized.push(`${CLOSE}`);
  assert.deepEqual(oversized.finishRound(true).suggestions, []);
});

test("模型在正文明确列出的后续问题可恢复为可点击建议", () => {
  const visibleAnswer = [
    "HTTP 缓存能减少传输、降低服务器压力，并通过缓存策略平衡性能与新鲜度。",
    "两个后续学习问题：",
    "1. Cache-Control 的 max-age 与 s-maxage 分别控制哪一层缓存？",
    "2. 浏览器如何用 ETag 发起协商缓存请求？",
    ""
  ].join("\n");

  assert.deepEqual(extractPromptSuggestionsFromVisibleAnswer(visibleAnswer), [
    "Cache-Control 的 max-age 与 s-maxage 分别控制哪一层缓存？",
    "浏览器如何用 ETag 发起协商缓存请求？"
  ]);
});

test("普通操作步骤不冒充后续建议，输出合同要求正文建议同步到私有元数据", () => {
  assert.deepEqual(extractPromptSuggestionsFromVisibleAnswer("操作步骤：\n1. 打开设置。\n2. 选择模型。\n"), []);
  assert.match(promptSuggestionInstruction, /每一条成功的最终答复都必须/u);
  assert.match(promptSuggestionInstruction, /items 必须有 1 到 3 项/u);
  assert.match(promptSuggestionInstruction, /公开正文不能代替元数据/u);
  assert.match(promptSuggestionInstruction, /公开正文不能代替元数据/u);
});
