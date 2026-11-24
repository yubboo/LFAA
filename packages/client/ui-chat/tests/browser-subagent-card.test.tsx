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

test("浏览器子智能体步骤列表包裹在共享限高滚动区里，长列表不再无限拉长卡片", () => {
  const steps = Array.from({ length: 30 }, (_, index) => ({
    id: `s${index + 1}`,
    name: "browser_snapshot",
    label: `核查第 ${index + 1} 屏`,
    target: `http://127.0.0.1:5174/site.html#${index + 1}`,
    status: "done" as const,
  }));
  const longStep: AgentStepItem = {
    id: "child-act-2-sub-b2",
    iteration: 2,
    phase: "act",
    status: "running",
    title: "浏览器验收助手",
    startedAt: 2000,
    timestamp: 2000,
    subagent: {
      id: "sub-b2",
      role: "浏览器验收助手",
      status: "running",
      kind: "browser",
      browserLabel: "内置浏览器",
      liveAction: "视觉截图验收",
      steps,
    },
  };

  const html = renderToStaticMarkup(
    <BrowserSubagentCard step={longStep} isZh={true} live={true} now={9000} />,
  );

  // 步骤列表必须落在共享滚动容器（ScrollArea + 卡片自己的限高类）内，而不是直接铺在详情里。
  assert.match(html, /class="scrollArea stepScroll"/u);
  assert.match(html, /data-axis="y"/u);
  const scrollIndex = html.indexOf('scrollArea stepScroll');
  const listIndex = html.indexOf('<ul class="stepList">');
  assert.ok(scrollIndex >= 0 && listIndex > scrollIndex, "步骤列表应位于共享滚动区内");
  assert.match(html, /30 浏览器步骤/u);
  assert.match(html, /核查第 30 屏/u);
  // 首帧未滚到底部时还没有边缘渐隐，滚动后由 hook 自行补上。
  assert.doesNotMatch(html, /data-fade-top="true"/u);
});

test("浏览器卡片直接展示本轮目标栏与内嵌截图缩略图条", () => {
  const stepWithEvidence: AgentStepItem = {
    id: "child-act-3-sub-b3",
    iteration: 1,
    phase: "act",
    status: "running",
    title: "浏览器验收助手",
    detail: "验证首屏导航点击与表单提交反馈",
    startedAt: 1000,
    timestamp: 1000,
    subagent: {
      id: "sub-b3",
      role: "浏览器验收助手",
      status: "running",
      kind: "browser",
      browserLabel: "内置浏览器",
      liveAction: "正在核查首屏按钮点击",
      steps: [
        {
          id: "s1",
          name: "browser_visual_check",
          label: "视觉截图验收",
          target: "首屏导航与 Hero",
          status: "done",
          browserEvidence: { id: "ev-1", sessionId: "sess-1" },
        },
      ],
    },
  };

  const html = renderToStaticMarkup(
    <BrowserSubagentCard step={stepWithEvidence} isZh={true} live={true} now={5000} />,
  );
  assert.match(html, /目标/u);
  assert.match(html, /验证首屏导航点击与表单提交反馈/u);
  assert.match(html, /展开实时验收截图/u);
  assert.match(html, /首屏导航与 Hero/u);
});
