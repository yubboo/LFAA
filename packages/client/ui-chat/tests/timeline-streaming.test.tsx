// 验证 AssistantTimeline 在流式轮次切换、工具执行、文本输出及完成态时始终保持连贯的活动反馈。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentStepItem } from "../client/store/chat-types";
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

const { AssistantTimeline } = await import("../client/conversation/AssistantTimeline");
const { StepTraceList } = await import("../client/conversation/StepTraceList");

test("中文顶部计时区分运行和结束，保留时分秒及展开控件", () => {
  const props = {
    isZh: true,
    createdAt: Date.now() - 5_000,
    durationMs: 3_723_000,
    expanded: false,
    processId: "run-timer",
    onToggle: () => {},
  };
  const live = renderToStaticMarkup(createElement(StepTraceList, { ...props, isStreaming: true }));
  const done = renderToStaticMarkup(createElement(StepTraceList, { ...props, isStreaming: false }));

  // 步骤计时按需显示单位：未满一分钟时只出现「秒」，不再出现 0 时 / 0 分。
  assert.match(live, /aria-label="用时 \d+ 秒"/u);
  assert.match(live, /aria-controls="run-timer"/u);
  assert.match(done, /用时 1 时 2 分 3 秒/u);
  assert.match(done, /aria-controls="run-timer"/u);
});

function renderTimeline(overrides: {
  content?: string;
  reasoning?: string;
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
      reasoning: overrides.reasoning,
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

test("命令行的运行提示与结果图标都固定在行尾、展开箭头前", () => {
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
    // 运行中与结束态统一放在命令正文之后、展开箭头之前。
    assert.ok(titleAt < statusAt && statusAt < row.indexOf("tabler-icon-chevron-right"));
    if (status === "running") {
      assert.ok(row.includes(`>${locale.statusRunning}</span>`));
      assert.match(row, /class="liveDot"/u);
    } else {
      assert.ok(row.includes(status === "done" ? "tabler-icon-check" : "tabler-icon-alert-circle"));
    }
  }
});

test("目录行与文件行一样带完整路径悬停气泡", () => {
  const { html } = renderTimeline({
    isStreaming: true,
    steps: [{
      id: "dir",
      iteration: 1,
      phase: "act",
      status: "done",
      title: "查看目录",
      toolName: "list_dir",
      toolTarget: "docs",
      timestamp: Date.now(),
    }],
  });
  // 目录行由工具行渲染：目标同样有固定图标列与路径气泡。
  assert.match(html, /class="anchor[ "]/u);
  assert.match(html, /class="tip" role="tooltip"/u);
  assert.match(html, /class="text">docs</u);
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

test("完成后过程行收进总行，正文段落仍可见", () => {
  const { html } = renderTimeline({ isStreaming: false, progressText: "我先检查文件。", content: "检查完成。", steps: [
    { id: "read-1", iteration: 1, phase: "act", status: "done", title: "读取文件", toolName: "read_file", textOffset: 7, timestamp: Date.now() },
    { id: "cmd-1", iteration: 1, phase: "act", status: "done", title: "执行命令", toolName: "run_command",
      commandTrace: { command: "git status" }, textOffset: 7, timestamp: Date.now() },
  ] });
  // 正文（过程说明与最终答复）不受折叠影响。
  assert.match(html, /我先检查文件。/u);
  assert.match(html, /检查完成。/u);
  // 轮次标题与工具链折进总行，默认不展开。
  assert.match(html, /class="roundActivity" hidden=""/u);
  // 总行标题按动作类别报数量，不把内部工具名当标题。
  assert.match(html, /1 command, 1 read/u);
});

test("流式运行中过程行保持展开", () => {
  const { html } = renderTimeline({ isStreaming: true, steps: [
    { id: "cmd-1", iteration: 1, phase: "act", status: "running", title: "执行命令", toolName: "run_command",
      commandTrace: { command: "git status" }, timestamp: Date.now() },
  ] });
  assert.doesNotMatch(html, /class="roundActivity" hidden=""/u);
});

test("文件活动保留文件入口，命令活动提供轨迹入口", () => {
  const locale = getChatLocale();
  const html = renderToStaticMarkup(createElement(AssistantTimeline, {
    locale, content: "完成", progressText: "检查", createdAt: 1, isStreaming: false,
    pendingApproval: null, onResolveApproval: () => {}, onOpenFile: () => {}, onOpenTrace: () => {},
    steps: [
      { id: "file", iteration: 1, phase: "act", status: "done", title: "写入", toolName: "write_file", toolTarget: "src/a.ts", timestamp: 2 },
      { id: "cmd", iteration: 1, phase: "act", status: "done", title: "运行", toolName: "run_command", commandTrace: { command: "test-command" }, timestamp: 2 },
    ],
  }));
  assert.match(html, /class="text">src\/a\.ts</u);
  assert.match(html, /<summary class="activityRow" data-kind="command"/u);
  // 轨迹入口文案随语言切换，使用同一 locale 断言避免本机中文环境误报。
  assert.ok(html.includes(`class="traceLink">${locale.isZh ? "查看" : "View"}</button>`));
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
  assert.match(html, /data-activity-segment="round-2"/u);
  assert.ok(html.includes(timelineMessages[lang].reasoning));
  assert.equal(html.match(/data-activity-segment=/gu)?.length, 2);
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
  const tail = html.split('data-activity-segment="round-2"')[1] ?? "";
  assert.ok(tail.includes(lang === "zh" ? "2 秒" : "2s"));
});

test("正文出现时同轮活动行仍在，并在工具到达时原位更新", () => {
  const now = Date.now();
  const think: AgentStepItem = { id: "think-1", iteration: 1, phase: "think", status: "running", title: "思考", modelStage: "replying", timestamp: now };
  const reply = renderTimeline({ isStreaming: true, content: "这是正在输出的回答", steps: [think] });
  assert.match(reply.html, /这是正在输出的回答/u);
  assert.ok(reply.html.includes(timelineMessages[reply.lang].replying));
  assert.match(reply.html, /data-activity-segment="round-1"/u);
  const finalizing = renderTimeline({ isStreaming: true, content: "这是答案", steps: [{ ...think, status: "done" }] });
  assert.ok(finalizing.html.includes(timelineMessages[finalizing.lang].thought));
  assert.match(finalizing.html, /data-activity-segment="round-1"/u);
  const tool = renderTimeline({ isStreaming: true, content: "准备执行", steps: [think, {
    id: "act-1", iteration: 1, phase: "act", status: "running", title: "运行命令", toolName: "run_command", commandTrace: { command: "echo test" }, textOffset: 4, timestamp: now,
  }] });
  assert.match(tool.html, /data-activity-segment="round-1"/u);
  assert.equal(tool.html.match(/data-activity-segment=/gu)?.length, 1);
  assert.match(tool.html, /echo test/u);
  assert.match(tool.html, /class="liveDot"/u);
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
  assert.equal(runningHtml.match(/data-activity-segment=/gu)?.length, 1);
  assert.match(runningHtml, /data-activity-segment="round-1"/u);

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

  assert.equal(doneHtml.match(/data-activity-segment=/gu)?.length, 1);
  assert.match(doneHtml, /data-activity-segment="round-1"/u);
  assert.match(doneHtml, /全部文件已写入。/);
});

test("渐变动效只跟随运行中的回复，给出结果后即使残留运行步骤也不再标记", () => {
  const now = Date.now();
  const runningStep: AgentStepItem = {
    id: "act-live",
    iteration: 1,
    phase: "act",
    status: "running",
    title: "运行命令",
    toolName: "run_command",
    commandTrace: { command: "echo test" },
    timestamp: now,
  };
  const live = renderTimeline({ isStreaming: true, content: "执行中。", steps: [runningStep] });
  assert.match(live.html, /data-live="true"/u);

  // 正常完成：步骤回到 done，不再有运行态标记。
  const finished = renderTimeline({
    isStreaming: false,
    progressText: "执行中。",
    content: "完成。",
    steps: [{ ...runningStep, status: "done" }],
  });
  assert.doesNotMatch(finished.html, /data-live/u);

  // 中止或降级时 Host 可能残留 running 步骤，同样不允许继续渐变动效。
  const interrupted = renderTimeline({
    isStreaming: false,
    progressText: "执行中。",
    content: "任务已手动中止。",
    steps: [runningStep],
  });
  assert.doesNotMatch(interrupted.html, /data-live/u);
});

test("顶部用时行只在运行中标记渐变动效", () => {
  const props = {
    isZh: true,
    createdAt: Date.now() - 1_000,
    durationMs: 1_000,
    expanded: false,
    processId: "run-live-dot",
    onToggle: () => {},
  };
  const live = renderToStaticMarkup(createElement(StepTraceList, { ...props, isStreaming: true }));
  const done = renderToStaticMarkup(createElement(StepTraceList, { ...props, isStreaming: false }));
  assert.match(live, /data-live="true"/u);
  assert.doesNotMatch(done, /data-live/u);
});

test("多轮思维链与动态工具链全程默认展开，保留每轮思考正文与动态目标参数", () => {
  const now = Date.now();
  const { html } = renderTimeline({
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
        id: "act-1-custom",
        iteration: 1,
        phase: "act",
        status: "done",
        title: "调用扩展工具",
        toolName: "mcp_custom_lookup",
        toolTarget: "theme-tokens",
        textOffset: 10,
        startedAt: now - 1_500,
        timestamp: now - 1_200,
      },
      {
        id: "think-2",
        iteration: 2,
        phase: "think",
        status: "done",
        title: "第 2 轮思考",
        detail: "已找到目标文件，可以整理最终决策。",
        startedAt: now - 1_200,
        timestamp: now,
      },
    ],
  });
  // 两轮思维正文全部保留且默认展开可见
  assert.match(html, /先定位官网区块标题的组件文件。/u);
  assert.match(html, /已找到目标文件，可以整理最终决策。/u);
  // 内置工具与自定义扩展工具均动态展示真实目标参数
  assert.match(html, /一个应用，全场景/u);
  assert.match(html, /mcp_custom_lookup/u);
  assert.match(html, /theme-tokens/u);
  // 正文 Markdown 回归标准有序列表，不再出现「推荐」卡片劫持
  assert.match(html, /<ol class="ol">/u);
  assert.doesNotMatch(html, /adviceOptions|adviceOptionRecommended/u);
});

test("旧会话仅有消息级 reasoning 时仍回退渲染可展开思维链块", () => {
  const { html } = renderTimeline({
    isStreaming: false,
    reasoning: "(Thinking) 这是兼容历史会话的思考记录。",
    content: "最终结论。",
    steps: [],
  });
  assert.match(html, /这是兼容历史会话的思考记录。/u);
  assert.doesNotMatch(html, /\(Thinking\)/u);
  assert.match(html, /aria-expanded="true"/u);
});
