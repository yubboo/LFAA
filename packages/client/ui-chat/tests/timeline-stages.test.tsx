// 验证时间线三段顺序（思维链 → 正文 → 工具总菜单）、连续无正文工具阶段合并、工具菜单概括与历史 reasoning 兼容。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentStepItem } from "../client/store/chat-types";
import { getChatLocale } from "../client/locales";

(globalThis as { React?: typeof React }).React = React;

const { AssistantTimeline } = await import("../client/conversation/AssistantTimeline");
const { resolveThinkingHeader, summarizeToolGroupMenu } = await import("../client/conversation/round-title");

function renderTimeline(overrides: {
  content?: string;
  reasoning?: string;
  progressText?: string;
  steps?: AgentStepItem[];
  isStreaming: boolean;
  defaultCollapsed?: boolean;
}) {
  const locale = getChatLocale();
  const now = Date.now();
  return renderToStaticMarkup(
    createElement(AssistantTimeline, {
      locale,
      content: overrides.content ?? "",
      reasoning: overrides.reasoning,
      progressText: overrides.progressText,
      steps: overrides.steps ?? [],
      createdAt: now - 5000,
      isStreaming: overrides.isStreaming,
      defaultCollapsed: overrides.defaultCollapsed,
      pendingApproval: null,
      onResolveApproval: () => {},
      onOpenFile: () => {},
    }),
  );
}

test("单阶段按「思维链 → 本轮正文 → 工具总菜单」排序，且连续无正文工具轮次合并进同一个工具总菜单", () => {
  const now = Date.now();
  const html = renderTimeline({
    isStreaming: false,
    progressText: "先检查首页标题样式：",
    content: "## 四、实际决策流程\n\n1. 先确认交付载体\n2. 再评估维护成本",
    steps: [
      {
        id: "think-1",
        iteration: 1,
        phase: "think",
        status: "done",
        title: "第 1 轮思考",
        detail: "先定位官网区块标题的组件文件。",
        startedAt: now - 4_000,
        timestamp: now - 2_000,
      },
      {
        id: "act-1-grep",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "检索",
        toolName: "grep",
        toolTarget: "一个应用，全场景",
        textOffset: 10,
        startedAt: now - 2_000,
        timestamp: now - 1_500,
      },
      {
        id: "act-2-edit",
        iteration: 2,
        phase: "act",
        status: "done",
        title: "编辑文件",
        toolName: "edit_file",
        toolTarget: "src/App.vue",
        textOffset: 10,
        startedAt: now - 1_400,
        timestamp: now - 1_000,
      },
    ],
  });
  // 两轮工具中间无新正文，自动合并进同一个阶段与同一个工具总菜单。
  assert.equal(html.match(/data-activity-segment=/gu)?.length, 1);
  assert.equal(html.match(/class="trigger"/gu)?.length, 1);
  // 渲染顺序严格为：思维链 → 本轮正文 → 工具总菜单。
  const thinkAt = html.indexOf('class="headerBtn"');
  const narrationAt = html.indexOf("先检查首页标题样式：");
  const toolMenuAt = html.indexOf('class="trigger"');
  assert.ok(thinkAt > 0 && narrationAt > thinkAt && toolMenuAt > narrationAt);
  // 思维链默认展开可见（用户可随时点击收起），工具总菜单完成后自动收起为一行。
  assert.match(html, /class="headerBtn" aria-expanded="true"/u);
  assert.match(html, /class="trigger" aria-expanded="false"/u);
  // 正文 Markdown 回归标准有序列表，不再出现「推荐」卡片劫持。
  assert.match(html, /<ol class="ol">/u);
  assert.doesNotMatch(html, /adviceOptions|adviceOptionRecommended/u);
});

test("summarizeToolGroupMenu 按动作类别简洁概括并显式报告失败数", () => {
  const now = Date.now();
  const summary = summarizeToolGroupMenu(
    [
      { id: "t1", iteration: 1, phase: "act", status: "done", title: "读文件", toolName: "read_file", timestamp: now },
      { id: "t2", iteration: 1, phase: "act", status: "done", title: "读文件", toolName: "read_file", timestamp: now },
      { id: "t3", iteration: 2, phase: "act", status: "done", title: "改文件", toolName: "edit_file", timestamp: now },
      { id: "t4", iteration: 2, phase: "act", status: "error", title: "跑命令", toolName: "run_command", timestamp: now },
    ],
    true,
    false,
  );
  assert.equal(summary.label, "分析了 2 个文件、编辑了文件、运行了命令");
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.iconKind, "file");
});

test("resolveThinkingHeader 根据思考阶段、耗时与内容意图动态切换文案", () => {
  const step: AgentStepItem = {
    id: "think-1",
    iteration: 1,
    phase: "think",
    status: "running",
    modelStage: "reasoning",
    title: "思考",
    timestamp: Date.now(),
  };
  assert.equal(
    resolveThinkingHeader({ thinkStep: step, thinkDetail: "先看看当前目录。", thinkRunning: true, durationMs: 2_000, liveStageLabel: "正在思考", isZh: true }),
    "正在思考",
  );
  assert.equal(
    resolveThinkingHeader({ thinkStep: step, thinkDetail: "需要检查报错并验证构建。", thinkRunning: true, durationMs: 3_000, liveStageLabel: "正在思考", isZh: true }),
    "正在检查分析",
  );
  assert.equal(
    resolveThinkingHeader({ thinkStep: step, thinkDetail: "先设计整体布局与组件方案。", thinkRunning: true, durationMs: 3_000, liveStageLabel: "正在思考", isZh: true }),
    "正在规划方案",
  );
  assert.equal(
    resolveThinkingHeader({ thinkStep: step, thinkDetail: "继续推导完整状态流转。", thinkRunning: true, durationMs: 8_000, liveStageLabel: "正在思考", isZh: true }),
    "正在深度思考",
  );
  assert.equal(
    resolveThinkingHeader({ thinkStep: { ...step, status: "done" }, thinkDetail: "经过详细推导。", thinkRunning: false, durationMs: 15_000, liveStageLabel: "已分析", isZh: true }),
    "深度思考",
  );
  assert.equal(
    resolveThinkingHeader({ thinkStep: { ...step, status: "done" }, thinkDetail: "确认了所有测试均通过。", thinkRunning: false, durationMs: 3_000, liveStageLabel: "已分析", isZh: true }),
    "已检查分析",
  );
});

test("旧会话仅有消息级 reasoning 时仍回退渲染默认展开的可折叠思维链块", () => {
  const done = renderTimeline({
    isStreaming: false,
    reasoning: "(Thinking) 这是兼容历史会话的思考记录。",
    content: "最终结论。",
    steps: [],
  });
  assert.match(done, /这是兼容历史会话的思考记录。/u);
  assert.doesNotMatch(done, /\(Thinking\)/u);
  assert.match(done, /class="headerBtn" aria-expanded="true"/u);
});

test("顶部汇总行收起时，过程正文随思维链与工具菜单整块隐藏，外部只留最终答案且不加多余上边距", () => {
  const now = Date.now();
  const html = renderTimeline({
    isStreaming: false,
    defaultCollapsed: true,
    progressText: "我先确认目录现状，再写入模板。",
    content: "这是最终答案正文。",
    steps: [
      { id: "think-1", iteration: 1, phase: "think", status: "done", title: "思考", detail: "检查目录", timestamp: now - 1000 },
      { id: "act-1", iteration: 1, phase: "act", status: "done", title: "读目录", toolName: "list_dir", textOffset: 15, timestamp: now },
    ],
  });
  // 整个过程区一起 hidden，过程正文不再漏到外面。
  assert.match(html, /class="flow process" hidden=""/u);
  // 最终答案在过程区外正常显示，且收起时不加 finalBody 多余上边距。
  assert.match(html, /这是最终答案正文。/u);
  assert.doesNotMatch(html, /class="finalBody"/u);
});

test("子智能体卡片直接平级展示在外部，不再套进 ToolGroupFold 产生多余竖线", () => {
  const now = Date.now();
  const html = renderTimeline({
    isStreaming: false,
    progressText: "派发一次浏览器验收。",
    content: "验收完成。",
    steps: [
      {
        id: "act-1",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "调用子智能体",
        toolName: "invoke_subagent",
        textOffset: 10,
        timestamp: now - 1000,
      },
      {
        id: "child-act-1-sub-b1",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "浏览器验收助手",
        textOffset: 10,
        timestamp: now,
        subagent: {
          id: "sub-b1",
          role: "浏览器验收助手",
          status: "done",
          kind: "browser",
          steps: [{ id: "s1", name: "browser_navigate", label: "打开网页", status: "done" }],
        },
      },
    ],
  });
  // 子智能体卡片直接渲染在外层，不包 ToolGroupFold trigger。
  assert.match(html, /已使用内置浏览器|Used Built-in Browser/u);
  assert.doesNotMatch(html, /class="trigger"/u);
});
