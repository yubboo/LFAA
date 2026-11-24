// 验证思维链中专属浏览器子智能体卡片的运行中提示、步骤列表与完成态摘要渲染。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentStepItem } from "../client/store/chat-types";

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

const { BrowserSubagentCard, isBrowserSubagentStep } = await import("../client/conversation/Browser-Subagent-Card");

test("BrowserSubagentCard 渲染运行中实时状态条与可展开浏览器步骤列表", () => {
  const runningStep: AgentStepItem = {
    id: "child-act-1-sub-b1",
    iteration: 1,
    phase: "act",
    status: "running",
    title: "浏览器验收助手",
    startedAt: 1000,
    timestamp: 1000,
    subagent: {
      id: "sub-b1",
      role: "浏览器验收助手",
      status: "running",
      kind: "browser",
      browserLabel: "内置浏览器",
      liveAction: "思考中",
      steps: [
        { id: "s1", name: "browser_navigate", label: "打开网页", target: "http://127.0.0.1:8123/pelican-bike.html", status: "done" },
        { id: "s2", name: "browser_visual_check", label: "视觉截图验收", status: "running" },
      ],
    },
  };

  assert.equal(isBrowserSubagentStep(runningStep), true);
  const runningHtml = renderToStaticMarkup(
    <BrowserSubagentCard
      step={runningStep}
      isZh={true}
      live={true}
      now={17_000}
      onOpenBrowser={() => {}}
    />,
  );
  assert.match(runningHtml, /正在使用内置浏览器/u);
  assert.match(runningHtml, /思考中 \(16 秒\)/u);
  assert.match(runningHtml, /2 浏览器步骤/u);
  assert.match(runningHtml, /打开网页/u);
  assert.match(runningHtml, /pelican-bike\.html/u);
  assert.match(runningHtml, /查看浏览器/u);

  const doneStep: AgentStepItem = {
    ...runningStep,
    status: "done",
    timestamp: 19_000,
    resultPreview: "PASS：动画流畅，控制台 0 报错。",
    subagent: {
      ...runningStep.subagent!,
      status: "done",
    },
  };
  const doneHtml = renderToStaticMarkup(
    <BrowserSubagentCard
      step={doneStep}
      isZh={true}
      live={false}
    />,
  );
  assert.match(doneHtml, /已使用内置浏览器/u);
  assert.match(doneHtml, /PASS：动画流畅/u);
});
