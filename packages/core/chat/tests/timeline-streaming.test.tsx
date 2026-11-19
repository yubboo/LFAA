// 验证 AssistantTimeline 在流式轮次切换、工具执行、文本输出及完成态时始终保持连贯的活动反馈。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentStepItem } from "../client/chat-types";
import { activityVerbs, getChatLocale, timelineMessages } from "../client/locales";

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

const { AssistantTimeline } = await import("../client/components/AssistantTimeline");

function renderTimeline(overrides: {
  content?: string;
  progressText?: string;
  steps?: AgentStepItem[];
  isStreaming: boolean;
}) {
  const locale = getChatLocale();
  const now = Date.now();
  const html = renderToStaticMarkup(
    createElement(AssistantTimeline, {
      locale,
      content: overrides.content ?? "",
      progressText: overrides.progressText,
      steps: overrides.steps ?? [],
      createdAt: now - 5000,
      isStreaming: overrides.isStreaming,
      pendingApproval: null,
      onResolveApproval: () => {},
      onOpenFile: () => {},
    }),
  );
  return { html, lang: (locale.isZh ? "zh" : "en") as "zh" | "en" };
}

test("流式工具轮次完成后进入下一轮思考时，底部持续显示实时运行状态行", () => {
  const now = Date.now();
  const { html, lang } = renderTimeline({
    isStreaming: true,
    content: "先读取文件。",
    steps: [
      {
        id: "act-1-read",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "读取 README",
        toolName: "read_file",
        permissionLevel: "read",
        textOffset: 6,
        timestamp: now - 2000,
      },
      {
        id: "think-2",
        iteration: 2,
        phase: "think",
        status: "running",
        modelStage: "reasoning",
        title: "第 2 轮思考",
        timestamp: now - 500,
      },
    ],
  });

  assert.ok(html.includes(activityVerbs.read_file[lang][2]));
  assert.match(html, /class="liveTail"/);
  assert.match(html, /<details class="liveTail"/);
  assert.ok(html.includes(timelineMessages[lang].reasoning));
});

test("从 Host 的轮次起点恢复计时，即使流式事件刚更新", () => {
  const now = Date.now();
  const { html, lang } = renderTimeline({
    isStreaming: true,
    content: "检查完成。",
    steps: [{
      id: "think-2", iteration: 2, phase: "think", status: "running",
      title: "请求模型", modelStage: "reasoning",
      startedAt: now - 2_500, timestamp: now - 50,
    }],
  });
  const tail = html.split('class="liveTail"')[1] ?? "";
  assert.ok(tail.includes(lang === "zh" ? "2 秒" : "2s"));
  assert.match(tail, /<summary/);
});

test("正在执行工具分组在末尾时展示动态点与文案，不重复渲染尾部行；完成后收起尾部行", () => {
  const now = Date.now();
  const { html: runningHtml, lang } = renderTimeline({
    isStreaming: true,
    content: "准备写入代码。",
    steps: [
      {
        id: "act-1-write",
        iteration: 1,
        phase: "act",
        status: "running",
        title: "写入文件",
        toolName: "write_file",
        permissionLevel: "write",
        textOffset: 7,
        timestamp: now - 300,
      },
    ],
  });

  assert.ok(runningHtml.includes(activityVerbs.write_file[lang][1]));
  assert.match(runningHtml, /class="liveDot"/);
  assert.doesNotMatch(runningHtml, /class="liveTail"/);

  const { html: doneHtml } = renderTimeline({
    isStreaming: false,
    progressText: "准备写入代码。",
    content: "全部文件已写入。",
    steps: [
      {
        id: "act-1-write",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "写入文件",
        toolName: "write_file",
        permissionLevel: "write",
        textOffset: 7,
        timestamp: now,
      },
    ],
  });

  assert.doesNotMatch(doneHtml, /class="liveTail"/);
  assert.match(doneHtml, /全部文件已写入。/);
});
