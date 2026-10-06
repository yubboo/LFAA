/**
 * 功能：回归 AI Work 刷新恢复时的活动状态时长与 Run 订阅方式。
 * 作用：确认澄清/审批等待使用持久化时间戳，恢复已有 Run 只建立事件订阅。
 * 关联文件：packages/client/ui-chat/src/activity-duration.ts、packages/client/connection/src/api.ts。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { formatAiActivityDuration, getAiActivityDisplayStatus, getAiActivityDurationSeconds, getAiActivitySummary } from "../../../packages/client/ui-chat/src/activity-duration.ts";
import { streamAiChat } from "../../../packages/client/connection/src/api.ts";

const message = (activity, createdAt = "2026-10-02T03:00:00.000Z") => ({
  status: "streaming",
  createdAt,
  activity: [{
    id: "activity-1",
    kind: activity.status === "waiting_input" ? "question" : "tool",
    title: activity.status === "waiting_input" ? "需要你补充信息" : "需要审批",
    detail: "等待用户处理",
    startedAt: activity.startedAt,
    completedAt: null,
    durationMs: null,
    ...activity
  }]
});

test("刷新后待答问题沿用服务端开始时间并明确显示等待", () => {
  const waitingMessage = message({ status: "waiting_input", startedAt: "2026-10-02T03:01:00.000Z" });
  const afterInitialRender = getAiActivitySummary(waitingMessage, Date.parse("2026-10-02T03:01:05.900Z"));
  assert.equal(afterInitialRender.label, "等待你补充信息");
  assert.equal(afterInitialRender.seconds, 5);
  assert.equal(afterInitialRender.durationText, "已等待 5 秒");
  assert.equal(afterInitialRender.messageLabel, "等待你补充信息");
  assert.equal(afterInitialRender.isProcessing, false);
  // 新页面实例重新读取同一条记录时，时长继续从持久化时间戳累计。
  const afterReload = getAiActivitySummary(waitingMessage, Date.parse("2026-10-02T03:01:12.000Z"));
  assert.equal(afterReload.label, "等待你补充信息");
  assert.equal(afterReload.seconds, 12);
  assert.equal(afterReload.messageLabel, "等待你补充信息");
  assert.equal(afterReload.isProcessing, false);
});

test("待审批状态使用审批等待时长，不冒充处理中", () => {
  const summary = getAiActivitySummary(message({ status: "approval_required", startedAt: "2026-10-02T03:01:00.000Z" }), Date.parse("2026-10-02T03:01:08.000Z"));
  assert.equal(summary.label, "等待审批");
  assert.equal(summary.seconds, 8);
  assert.equal(summary.messageLabel, "等待审批");
  assert.equal(summary.isProcessing, false);
});

test("工具运行中明确显示执行阶段并按当前步骤开始时间累计", () => {
  const summary = getAiActivitySummary(message({ status: "running", startedAt: "2026-10-02T03:01:00.000Z" }), Date.parse("2026-10-02T03:01:09.000Z"));
  assert.equal(summary.label, "正在执行工具");
  assert.equal(summary.seconds, 9);
  assert.equal(summary.durationText, "已用 9 秒");
  assert.equal(summary.messageLabel, "正在执行工具");
  assert.equal(summary.isProcessing, true);
});

test("真实模型活动区分思考、回复、工具准备、执行、能力加载与子 Agent 协调", () => {
  const now = Date.parse("2026-10-02T03:01:10.000Z");
  const activeMessage = (activity) => message({ status: "running", ...activity });

  assert.equal(getAiActivitySummary(activeMessage({ kind: "status", title: "模型推理中 · deepseek-flash" }), now).label, "正在思考");
  assert.equal(getAiActivitySummary(activeMessage({ kind: "status", title: "流式接收回答" }), now).label, "正在回复");
  assert.equal(getAiActivitySummary(activeMessage({ kind: "tool", title: "启动 Minecraft 实例", detail: "正在校验工具参数并检查当前权限。" }), now).label, "正在准备工具");
  assert.equal(getAiActivitySummary(activeMessage({ kind: "tool", title: "启动 Minecraft 实例", detail: "参数校验通过；将按当前权限模式执行。" }), now).label, "正在执行工具");
  assert.equal(getAiActivitySummary(activeMessage({ kind: "skill", title: "加载写作 Skill" }), now).label, "正在加载能力");
  assert.equal(getAiActivitySummary(activeMessage({ kind: "agent", title: "委派给 Minecraft 开服顾问" }), now).label, "正在协调子 Agent");
});

test("展开时间线显示面向用户的真实阶段和持久化耗时", () => {
  const running = {
    id: "activity-running",
    kind: "tool",
    title: "启动 Minecraft 实例",
    status: "running",
    detail: "参数校验通过；将按当前权限模式执行。",
    startedAt: "2026-10-02T03:01:00.000Z",
    completedAt: null,
    durationMs: null
  };
  assert.equal(getAiActivityDisplayStatus(running), "正在执行工具");
  assert.equal(getAiActivityDurationSeconds(running, Date.parse("2026-10-02T03:01:08.900Z")), 8);
  assert.equal(getAiActivityDurationSeconds({ ...running, status: "complete", completedAt: "2026-10-02T03:01:07.000Z", durationMs: 7000 }, Date.now()), 7);
  assert.equal(getAiActivityDisplayStatus({ ...running, status: "approval_required" }), "等待审批");
  assert.equal(getAiActivityDisplayStatus({ ...running, status: "waiting_input" }), "等待你补充");
  assert.equal(getAiActivityDisplayStatus({ ...running, status: "unavailable" }), "结果待确认");
  assert.equal(getAiActivityDisplayStatus({ ...running, status: "error" }), "未能完成");
  assert.equal(getAiActivityDisplayStatus({ ...running, status: "complete" }), "已完成");
  assert.equal(formatAiActivityDuration(498), "8 分钟 18 秒");
});

test("整轮排队、停止和失败显示消息真实结束状态", () => {
  const emptyActivity = [];
  const queued = getAiActivitySummary({ status: "queued", createdAt: "2026-10-02T03:01:00.000Z", activity: emptyActivity }, Date.parse("2026-10-02T03:01:05.000Z"));
  const stopped = getAiActivitySummary({ status: "interrupted", createdAt: "2026-10-02T03:00:00.000Z", activity: emptyActivity }, Date.now());
  const failed = getAiActivitySummary({ status: "error", createdAt: "2026-10-02T03:00:00.000Z", activity: emptyActivity }, Date.now());
  assert.equal(queued.label, "排队中");
  assert.equal(queued.durationText, "已排队 5 秒");
  assert.equal(stopped.label, "已停止");
  assert.equal(failed.label, "未能完成");
});

test("本轮结束摘要从消息创建到最后活动按真实时间累计", () => {
  const completedActivity = {
    id: "activity-complete",
    kind: "status",
    title: "模型推理中 · deepseek-flash",
    status: "complete",
    detail: "模型已完成回答。",
    startedAt: "2026-10-02T03:00:00.000Z",
    completedAt: "2026-10-02T03:08:18.000Z",
    durationMs: 498000
  };
  const summary = getAiActivitySummary({ status: "complete", createdAt: "2026-10-02T02:59:00.000Z", activity: [completedActivity] }, Date.now());
  assert.equal(summary.label, "已完成");
  assert.equal(summary.durationText, "用时 9 分钟 18 秒");
});

test("恢复已有 Run 只通过 GET 订阅，不创建新的聊天轮次", async t => {
  let requestUrl;
  let requestOptions;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response('event: done\ndata: {"status":"interrupted"}\n\n', {
      headers: { "content-type": "text/event-stream" }
    });
  });

  await streamAiChat({
    runId: "existing-run",
    appId: "minecraft",
    sessionId: "existing-session",
    content: "",
    signal: new AbortController().signal,
    onSession() {},
    onActivity() {},
    onUsage() {},
    onError() {},
    onDelta() {},
    onDone() {}
  });

  assert.equal(requestUrl, "/api/ai/runs/existing-run/events");
  assert.equal(requestOptions.method, "GET");
  assert.equal("body" in requestOptions, false);
});
