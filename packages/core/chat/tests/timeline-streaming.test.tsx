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
const { StepTraceList } = await import("../client/components/StepTraceList");

test("中文顶部计时区分运行和结束，保留时分秒及展开控件", () => {
  const props = {
    isZh: true,
    steps: [],
    createdAt: Date.now() - 5_000,
    durationMs: 3_723_000,
    expanded: false,
    processId: "run-timer",
    onToggle: () => {},
  };
  const live = renderToStaticMarkup(createElement(StepTraceList, { ...props, isStreaming: true }));
  const done = renderToStaticMarkup(createElement(StepTraceList, { ...props, isStreaming: false }));

  // 步骤计时按需显示单位：未满一分钟时只出现「秒」，不再出现 0 时 / 0 分。
  assert.match(live, /aria-label="思考 \d+ 秒"/u);
  assert.match(live, /aria-controls="run-timer"/u);
  assert.match(done, /用时 1 时 2 分 3 秒/u);
  assert.match(done, /aria-controls="run-timer"/u);
});

function renderTimeline(overrides: {
  content?: string;
  progressText?: string;
  steps?: AgentStepItem[];
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
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
      tokenUsage: overrides.tokenUsage,
      isStreaming: overrides.isStreaming,
      pendingApproval: null,
      onResolveApproval: () => {},
      onOpenFile: () => {},
    }),
  );
  return { html, lang: (locale.isZh ? "zh" : "en") as "zh" | "en" };
}

test("命令行的运行提示在命令前，结果图标在命令后和展开箭头前", () => {
  const command = "status-layout-fixture";
  const locale = getChatLocale();
  const statuses = ["running", "done", "error"] as const;
  for (const status of statuses) {
    const { html } = renderTimeline({
      isStreaming: true,
      steps: [{ id: "cmd", iteration: 1, phase: "act", status, title: "执行命令", toolName: "run_command",
        commandTrace: { command }, timestamp: Date.now() }],
    });
    const row = html.match(/<summary class="activityRow" data-kind="command"[^>]*>.*?<\/summary>/u)?.[0];
    assert.ok(row);
    const titleAt = row.indexOf('class="activityTitle"');
    const statusAt = row.indexOf('class="activityStatus"');
    assert.ok(titleAt >= 0 && statusAt >= 0);
    if (status === "running") {
      assert.ok(statusAt < titleAt);
      assert.ok(row.includes(`>${locale.statusRunning}</span>`));
      assert.match(row, /class="liveDot"/u);
    } else {
      assert.ok(titleAt < statusAt && statusAt < row.indexOf("tabler-icon-chevron-right"));
      assert.ok(row.includes(status === "done" ? "tabler-icon-check" : "tabler-icon-alert-circle"));
    }
  }
});

test("完成态展示本轮 token 用量，没有用量时不显示", () => {
  const { html } = renderTimeline({
    isStreaming: false,
    content: "全部完成。",
    tokenUsage: { promptTokens: 900, completionTokens: 300, totalTokens: 1_200 },
  });
  assert.match(html, /1\.2k tokens/u);

  const noUsage = renderTimeline({ isStreaming: false, content: "完成。" });
  assert.doesNotMatch(noUsage.html, /tokens/u);
});

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
  assert.match(html, /class="liveTail/);
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
  // 类名与 disclosure 合并，按 "liveTail" 之后截断即可
  const tail = html.split("liveTail")[1] ?? "";
  assert.ok(tail.includes(lang === "zh" ? "2 秒" : "2s"));
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
  assert.doesNotMatch(runningHtml, /class="liveTail/);

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

  assert.doesNotMatch(doneHtml, /class="liveTail/);
  assert.match(doneHtml, /全部文件已写入。/);
});
