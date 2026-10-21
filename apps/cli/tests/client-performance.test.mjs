/**
 * 功能：长期回归共享界面调度、AI Work 计时订阅/流式消息/滚动和工作台存储故障。
 * 作用：使用隔离的事件、计时器和协议夹具验证工作量、顺序与撤销，不伪造真实浏览器帧性能。
 * 关联文件：connection/{read-poller,stream-deltas,api}、ui-chat/{activity-clock,conversation-scroll}、ui-dockkit/workbench-preferences。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { createReadPoller } from "../../../packages/client/connection/src/read-poller.ts";
import { createStreamDeltas } from "../../../packages/client/connection/src/stream-deltas.ts";
import { pauseAiRun, resumeAiRun, streamAiChat } from "../../../packages/client/connection/src/api.ts";
import { saveWorkbenchLeftWidth } from "../../../packages/client/ui-dockkit/src/workbench-preferences.ts";
import { createSnapshotCache, clearClientSnapshots } from "../../../packages/client/store/src/snapshot-cache.ts";
import { createAiActivityClockStore } from "../../../packages/client/ui-chat/src/activity-clock.ts";
import { observeWorkbenchMetrics } from "../../../packages/client/ui-dockkit/src/use-workbench-metrics.ts";
import { buildConversationAnchors, conversationAnchorReply } from "../../../packages/client/ui-chat/src/conversation-anchor-preview.ts";
import { buildConversationAnchorLayout, createConversationScrollTracker, createFrameCoalescer, findNearestConversationAnchorIndex, shouldAutoScrollToLatest, shouldFollowLatestMessage, shouldShowScrollToLatest, updateConversationAnchorPointerTarget } from "../../../packages/client/ui-chat/src/conversation-scroll.ts";
import { sameTerminalTask } from "../../../packages/client/ui-workspace/src/terminal-snapshot.ts";

function browserEvents(t) {
  const page = new EventTarget();
  page.visibilityState = "visible";
  const browser = new EventTarget();
  for (const [key, value] of [["document", page], ["window", browser]]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key]; });
  }
  return { page, browser };
}
function frames(t) {
  const pending = new Map();
  let id = 0;
  for (const [key, value] of [
    ["requestAnimationFrame", callback => { pending.set(++id, callback); return id; }],
    ["cancelAnimationFrame", frame => pending.delete(frame)]
  ]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key]; });
  }
  return { pending, run() { const callbacks = [...pending.values()]; pending.clear(); for (const callback of callbacks) callback(0); } };
}

test("慢读取期间 1000 次刷新合并为一次尾随对账，任何时刻最多一个请求", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  browserEvents(t);
  const gates = [];
  let active = 0, maxActive = 0;
  const poller = createReadPoller(async () => {
    active += 1; maxActive = Math.max(maxActive, active);
    const gate = Promise.withResolvers(); gates.push(gate);
    await gate.promise; active -= 1;
  }, 1000);
  t.after(() => poller.stop());
  await nextTurn();
  let refresh;
  for (let index = 0; index < 1000; index += 1) refresh = poller.refresh();
  t.mock.timers.tick(10_000);
  assert.equal(gates.length, 1);
  gates[0].resolve(); await nextTurn();
  assert.equal(gates.length, 2);
  gates[1].resolve(); await refresh;
  assert.equal(maxActive, 1);
  t.mock.timers.tick(1000); await nextTurn();
  assert.equal(gates.length, 3);
  gates[2].resolve(); await nextTurn();
});

test("隐藏暂停读取，恢复立即对账；停止后焦点、可见事件和旧请求都不能重启", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { page, browser } = browserEvents(t);
  const gates = [];
  const poller = createReadPoller(() => { const gate = Promise.withResolvers(); gates.push(gate); return gate.promise; }, 1000);
  t.after(() => poller.stop());
  await nextTurn();
  page.visibilityState = "hidden"; page.dispatchEvent(new Event("visibilitychange"));
  gates[0].resolve(); await nextTurn();
  t.mock.timers.tick(100_000); await nextTurn();
  await poller.refresh();
  assert.equal(gates.length, 1);
  page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange"));
  browser.dispatchEvent(new Event("focus")); await nextTurn();
  assert.equal(gates.length, 2);
  poller.stop(); gates[1].resolve(); await nextTurn();
  page.dispatchEvent(new Event("visibilitychange")); browser.dispatchEvent(new Event("focus"));
  t.mock.timers.tick(100_000); await nextTurn();
  assert.equal(gates.length, 2);
});

test("Browser Dock 隐藏时停止修订轮询并取消在途读取，卸载时撤销监听和计时器", () => {
  const panel = readFileSync(new URL("../../../packages/client/ui-sidebar-browser/src/BrowserPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /document\.visibilityState === "hidden"/u);
  assert.match(panel, /activeRequest\?\.abort\(\)/u);
  assert.match(panel, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/u);
  assert.match(panel, /document\.removeEventListener\("visibilitychange", onVisibilityChange\)/u);
  assert.match(panel, /if \(timer\) clearTimeout\(timer\)/u);
});

test("读取失败仍能在下一轮恢复，手动调用可以观察错误", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  browserEvents(t);
  let calls = 0;
  const poller = createReadPoller(async () => { if (++calls === 1 || calls === 3) throw new Error("隔离读取失败"); }, 1000);
  t.after(() => poller.stop());
  await nextTurn();
  t.mock.timers.tick(1000); await nextTurn();
  assert.equal(calls, 2);
  await assert.rejects(poller.refresh(), /隔离读取失败/u);
});

test("1000 个同帧文本片段只更新一次，跨消息和终止保持原始文本顺序", t => {
  const animation = frames(t), emitted = [];
  const deltas = createStreamDeltas(value => emitted.push(value));
  for (let index = 0; index < 1000; index += 1) deltas.push({ messageId: "a", delta: "字" });
  assert.equal(animation.pending.size, 1); assert.equal(emitted.length, 0);
  animation.run();
  assert.deepEqual(emitted, [{ messageId: "a", delta: "字".repeat(1000) }]);
  deltas.push({ messageId: "a", delta: "尾" }); deltas.push({ messageId: "b", delta: "下" }); deltas.flush();
  assert.deepEqual(emitted.slice(1), [{ messageId: "a", delta: "尾" }, { messageId: "b", delta: "下" }]);
  deltas.push({ messageId: "b", delta: "取消内容" }); deltas.dispose(); animation.run();
  assert.equal(emitted.length, 3); assert.equal(animation.pending.size, 0);
});

test("AI Work共享秒表只通知耗时订阅者，并在最后一个工作区停止后清理", () => {
  let now = 1000, timerCallback, starts = 0, clears = 0;
  const clock = createAiActivityClockStore({
    now: () => now,
    setInterval: callback => { starts += 1; timerCallback = callback; return starts; },
    clearInterval: () => { clears += 1; }
  });
  const historicalRows = Array.from({ length: 1000 }, () => ({ updates: 0 }));
  const elapsedLabels = [{ updates: 0 }, { updates: 0 }];
  const unsubscribeLabels = elapsedLabels.map(label => clock.subscribe(() => { label.updates += 1; }));
  assert.equal(starts, 0, "空闲时不创建计时器");

  const stopFirst = clock.start();
  const stopSecond = clock.start();
  assert.equal(starts, 1, "多个工作区共用一个秒表");
  now = 2000;
  timerCallback();
  assert.equal(clock.getSnapshot(), now);
  assert.deepEqual(elapsedLabels.map(label => label.updates), [1, 1]);
  assert.equal(historicalRows.reduce((sum, row) => sum + row.updates, 0), 0, "历史行没有订阅秒表");

  unsubscribeLabels[1]();
  now = 3000;
  timerCallback();
  assert.deepEqual(elapsedLabels.map(label => label.updates), [2, 1]);
  stopFirst(); stopFirst();
  assert.equal(clears, 0, "其他工作区仍在使用时不清理共享计时器");
  stopSecond();
  assert.equal(clears, 1, "最后一个工作区退出后只清理一次");
  unsubscribeLabels[0]();
});

test("AI Work 分段流式正文使用稳定纯文本，终态 Markdown 保留且无光标", () => {
  const response = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkResponse.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
  assert.match(response, /const ResponseText = memo/u);
  assert.ok(response.includes("streaming ? <AiStreamingMarkdown content={content} /> : <AiMarkdown content={content} />"));
  assert.match(readFileSync(new URL("../../../packages/client/ui-chat/src/AiMarkdown.tsx", import.meta.url), "utf8"), /AiStreamingMarkdown/u);
  assert.doesNotMatch(styles, /ai-work-chat__message-content--streaming[^\n]*::after/u);
});

test("历史首屏按账户与会话去重，切换时取消过期读取", () => {
  const chat = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
  assert.ok(chat.includes("const messageSessionKey = `${userId}:${conversationKey}`;"));
  assert.ok(chat.includes("if (loadedMessageSessionKeyRef.current === messageSessionKey)"));
  assert.ok(chat.includes("loadAiMessages(activeSessionId, undefined, controller.signal)"));
  assert.ok(chat.includes("loadedMessageSessionKeyRef.current = messageSessionKey;"));
  assert.ok(chat.includes("return () => { alive = false; controller.abort(); };"));
});

test("设置中心独立工作区读取并发启动，共享会话列表按账户取消旧请求", () => {
  const settings = readFileSync(new URL("../../../packages/client/ui-settings/src/SettingsPage.tsx", import.meta.url), "utf8");
  const workspaceStart = settings.indexOf('case "workspace":');
  const workspaceEnd = settings.indexOf('case "developer":', workspaceStart);
  const workspaceCase = settings.slice(workspaceStart, workspaceEnd);
  assert.match(workspaceCase, /Promise\.all\(\[\s*loadHealthOnce\(\),\s*loadSteamcmdSettings\(\),\s*loadMinecraftStorageSettings\(\),\s*loadProjectStorageLocations\(\)/u);
  assert.doesNotMatch(workspaceCase, /loadDataDirectorySettings\(/u, "业务内容目录由项目存储 Owner 一次读取，不再重复请求独立目录设置");

  const appWorkspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(appWorkspace.includes("loadAiSessions({ signal: controller.signal })"));
  assert.ok(appWorkspace.includes("const cacheKey = userId;"));
  assert.ok(!appWorkspace.includes("loadAiSessions({ appId: app, signal: controller.signal })"));
  assert.ok(appWorkspace.includes("const aiSessionsRequestRef = useRef<{ userId: string; controller: AbortController } | null>(null);"));
  assert.ok(appWorkspace.includes("if (pendingRequest?.userId === userId && !pendingRequest.controller.signal.aborted) return;"));
  assert.match(appWorkspace, /if \(pendingRequest\?\.userId === userId\) \{\s*pendingRequest\.controller\.abort\(\);\s*aiSessionsRequestRef\.current = null;\s*\}/u);
  assert.ok(appWorkspace.includes("if (controller.signal.aborted || aiSessionsRequestRef.current !== request) return;"));
});

test("AI Work 主聊挂载唯一分段展示，沿用原活动展开和完成清理", () => {
  const chat = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
  const response = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkResponse.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
  assert.ok(chat.includes('return aiActivityClock.start();'));
  assert.ok(chat.includes('import { aiActivityClock } from "./activity-clock.js";'));
  assert.doesNotMatch(chat, /const \[activityClock|setActivityClock|setInterval/u);
  assert.ok(chat.includes('<AiWorkResponse message={message} pauseLabel='));
  assert.ok(chat.includes('<AiLiveActivityDuration activity={activity} />'));
  assert.ok(chat.includes('renderActivity={renderActivity} renderInteraction={renderInteraction}'));
  assert.ok(chat.includes('appendAiTextDelta(item, value)'));
  assert.match(chat, /onPresentation:/u);
  assert.ok(chat.includes('setExpandedActivitySteps(current => current?.messageId === completedMessageId ? null : current)'));
  assert.ok(chat.includes('aria-expanded={activityExpanded} aria-controls={activityDetailId}'));
  assert.ok(chat.includes('activityExpanded ? <div className="ai-work-chat__activity-step-detail"'));
  assert.match(response, /summary\.durationText/u);
  assert.ok(response.includes('className="ai-work-chat__response-duration" role="status"'));
  assert.match(response, /useSyncExternalStore\(aiActivityClock\.subscribe/u);
  assert.ok(response.includes('<AiLiveResponseDuration message={message} />'));
  assert.ok(response.includes('pauseLabel ?? summary.label'));
  assert.match(styles, /response-divider[^}]*border-top: 1px solid var\(--color-border-subtle\)/u);
});

test("AI Work流式增量保持历史消息行的记忆边界", () => {
  const chat = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
  assert.match(chat, /const AiWorkMessageRow = memo\(function AiWorkMessageRow/u);
  assert.match(chat, /return <AiWorkMessageRow[\s\S]*?message=\{item\}[\s\S]*?actions=\{messageRowActions\}/u);
  assert.match(chat, /editingMessage=\{editingMessage\?\.messageId === item\.id \? editingMessage : null\}/u);
  assert.match(chat, /expandedActivitySteps=\{expandedActivitySteps\?\.messageId === item\.id \? expandedActivitySteps : null\}/u);
  assert.match(chat, /useLayoutEffect\(\(\) => \{\s*messageRowActionsRef\.current = \{\s*copyMessage,\s*editUserMessage,\s*submitEditedMessage,\s*cancelMessageEditing,\s*openMessageFeedback,\s*toggleActivityStep,\s*openWritingProposal\s*\};\s*\}, \[copyMessage, editUserMessage, submitEditedMessage, cancelMessageEditing, openMessageFeedback, toggleActivityStep, openWritingProposal\]\)/u);
  assert.match(chat, /setMessages\(current => current\.map\(item => item\.id === value\.messageId \? appendAiTextDelta\(item, value\) : item\)\)/u);
});

test("AI Work流式增量不会重复执行未变化的用量栏", () => {
  const chat = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
  const footer = readFileSync(new URL("../../../packages/client/ui-chat/src/AiUsageFooter.tsx", import.meta.url), "utf8");
  assert.match(footer, /export const AiUsageFooter = memo\(function AiUsageFooter/u);
  assert.match(chat, /const openAiContextSettings = useCallback\(\(\) => onOpenSettings\("ai", "ai-context-usage-setting"\), \[onOpenSettings\]\)/u);
  assert.match(chat, /<AiUsageFooter[\s\S]*?onOpenContextSettings=\{openAiContextSettings\}/u);
});

test("AI Work模型按钮保留可见的目录版本标签", () => {
  const chat = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
  assert.match(chat, /const activeModelVersionTag = activeModel \? modelOptionVersionTag\(activeModel\) : undefined/u);
  assert.match(chat, /ai-work-chat__model-name[\s\S]*?ai-work-chat__model-version-tag/u);
  assert.match(chat, /aria-label=\{activeAccount \? `模型：\$\{activeModel \? modelSelectorDisplayLabel\(activeModel\)/u);
  assert.match(styles, /ai-work-chat__composer-control--model \.ai-work-chat__composer-control-label \{ display: flex/u);
  assert.match(styles, /ai-work-chat__model-version-tag \{ flex: 0 0 auto/u);
  assert.match(styles, /\.ai-work-chat__composer-control-label,\s*\.ai-work-chat__composer-control-chevron \{ display: none/u);
  assert.match(styles, /\.ai-work-chat__composer-control--model \.ai-work-chat__composer-control-label \{ display: none/u);
});

test("AI Work 文件活动显示真实路径并通过登记项目打开现有 Git 审阅器", () => {
  const chat = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
  const reviewer = readFileSync(new URL("../../../packages/client/ui-workspace/src/GitChangeSummary.tsx", import.meta.url), "utf8");
  assert.match(chat, /activity\.fileChanges\?\.map/u);
  assert.match(chat, /onOpenProjectFileReview\(change\.projectId!, change\.path\)/u);
  assert.match(chat, /查看差异与编辑/u);
  assert.match(workspace, /workspaceProjects\.find\(item => item\.id === projectId/u);
  assert.match(workspace, /onOpenProjectFileReview=\{openProjectFileReview\}/u);
  assert.match(reviewer, /current\.files\.find\(file => file\.projectPath === path\)/u);
  assert.match(reviewer, /setReviewPath\(changedFile\.path\)/u);
  assert.match(reviewer, /<GitChangeReview appId=\{appId\} project=\{project\} status=\{status\} initialPath=\{reviewPath\}/u);
});

test("AI Work 待处理审批与澄清贴近输入框，处理后记录回到原回复", () => {
  const chat = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
  assert.match(chat, /const renderInteraction = \(activity: AiActivityItem\)/u);
  assert.match(chat, /已回答的澄清问题/u);
  assert.ok(chat.includes('<strong>{questionText}</strong>'));
  assert.ok(chat.includes('skipped ? "已跳过" : answerText || "未记录文字答案"'));
  assert.ok(chat.includes('activity.detail?.startsWith("你的回答：")'));
  assert.match(chat, /activity\.status === "approval_required" && !activity\.approvalAnswer\) return null/u);
  assert.match(chat, /activity\.status === "waiting_input"\) return null/u);
  assert.match(chat, /function renderPendingComposerInteraction\(\)/u);
  assert.match(chat, /aria-label="待处理审批"/u);
  assert.match(chat, /\{renderPendingComposerInteraction\(\)\}/u);
  assert.ok(chat.indexOf("{renderPendingComposerInteraction()}") < chat.indexOf("<form ref={composerFormRef}"));
  assert.match(chat, /className="ai-work-chat__approval-record"/u);
  assert.match(chat, /className="ai-work-chat__question-record"/u);
  assert.match(chat, /activity\.approvalQuestion/u);assert.match(chat, /activity\.approvalAnswer/u);
  assert.match(chat, /answerAiRunQuestion\(question\.runId/u);assert.match(chat, /decideAiApproval\(approvalId, decision\)/u);
  assert.match(styles, /ai-work-chat__composer-interaction[^}]*max-height: min\(38dvh, 320px\)/u);
  assert.match(styles, /ai-work-chat__activity-output-card[^}]*max-height: 240px/u);
  assert.doesNotMatch(chat, /result\.userMessage\.id/u);
});

test("真实 SSE 解析合并文本，并在没有末尾空行时先交付全文再完成", async t => {
  const animation = frames(t), events = [];
  const source = Array.from({ length: 1000 }, () => 'event: delta\ndata: {"messageId":"m","delta":"文"}\n\n').join("")
    + 'event: done\ndata: {"status":"complete"}\n';
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.credentials, "include");
    return new Response(source, { headers: { "content-type": "text/event-stream" } });
  });
  await streamAiChat({ appId: "writing", sessionId: null, content: "测试协议", signal: new AbortController().signal,
    onSession() {}, onActivity() {}, onUsage() {}, onError() {},
    onDelta: value => events.push(value.delta), onDone: status => events.push(status)
  });
  assert.deepEqual(events, ["文".repeat(1000), "complete"]);
  assert.equal(animation.pending.size, 0);
});

test("Run SSE 在 done 前断流后按同一 Run ID 重订阅并恢复快照", async t => {
  const animation = frames(t), requests = [], sessions = [], deltas = [], done = [];
  const userMessage = { id: "run-user", role: "user", content: "继续回答", status: "complete" };
  const assistant = content => ({ id: "recovered-run", role: "assistant", content, status: "streaming", activity: [] });
  const session = { id: "existing-session", appId: "writing", title: "恢复测试", planMode: false };
  const first = `event: session\ndata: ${JSON.stringify({ runId: "recovered-run", session, userMessage, assistantMessage: assistant("") })}\n\n`
    + 'event: delta\ndata: {"messageId":"recovered-run","delta":"已收到的片段"}\n\n';
  const resumed = `event: session\ndata: ${JSON.stringify({ runId: "recovered-run", session, userMessage, assistantMessage: assistant("已收到的片段") })}\n\n`
    + 'event: delta\ndata: {"messageId":"recovered-run","delta":"和后续内容"}\n\n'
    + 'event: done\ndata: {"status":"complete"}\n\n';
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, method: options.method, body: options.body });
    return new Response(requests.length === 1 ? first : resumed, { headers: { "content-type": "text/event-stream" } });
  });

  await streamAiChat({ appId: "writing", sessionId: "existing-session", content: "继续回答", signal: new AbortController().signal,
    onSession: value => sessions.push(value.assistantMessage.content), onActivity() {}, onUsage() {}, onError() {},
    onDelta: value => deltas.push(value.delta), onDone: status => done.push(status)
  });

  assert.deepEqual(requests.map(({ url, method }) => [url, method]), [
    ["/api/ai/chat/stream", "POST"],
    ["/api/ai/runs/recovered-run/events", "GET"]
  ]);
  assert.deepEqual(sessions, ["", "已收到的片段"]);
  assert.deepEqual(deltas, ["已收到的片段", "和后续内容"]);
  assert.deepEqual(done, ["complete"]);
  assert.equal(animation.pending.size, 0);
});

test("Run SSE 恢复当前暂停状态，控制 API 只请求当前 Run 的暂停/继续路由", async t => {
  const states = [], requests = [];
  const session = { id: "pause-session", appId: "workspace", title: "暂停测试", planMode: false };
  const userMessage = { id: "pause-user", role: "user", content: "暂停", status: "complete" };
  const assistantMessage = { id: "pause-run", role: "assistant", content: "", status: "streaming", activity: [] };
  const stream = `event: session\ndata: ${JSON.stringify({ runId: "pause-run", session, userMessage, assistantMessage })}\n\n`
    + 'event: pause-state\ndata: {"runId":"pause-run","state":"paused"}\n\n'
    + 'event: done\ndata: {"status":"complete"}\n\n';
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, method: options.method });
    if (url === "/api/ai/chat/stream") return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    return Response.json({ pauseState: url.endsWith("/pause") ? "pausing" : "running" });
  });
  await streamAiChat({ appId: "workspace", sessionId: null, content: "暂停", signal: new AbortController().signal,
    onSession() {}, onPauseState: value => states.push(value), onActivity() {}, onUsage() {}, onError() {}, onDelta() {}, onDone() {}
  });
  assert.deepEqual(states, [{ runId: "pause-run", state: "paused" }]);
  assert.deepEqual(await pauseAiRun("pause-run"), { pauseState: "pausing" });
  assert.deepEqual(await resumeAiRun("pause-run"), { pauseState: "running" });
  assert.deepEqual(requests, [
    { url: "/api/ai/chat/stream", method: "POST" },
    { url: "/api/ai/runs/pause-run/pause", method: "POST" },
    { url: "/api/ai/runs/pause-run/resume", method: "POST" }
  ]);
});

test("取消 SSE 撤销尚未绘制的文本，不在取消后回调或泄漏动画帧", async t => {
  const animation = frames(t), events = [], abort = new AbortController();
  let feed;
  const body = new ReadableStream({ start(controller) { feed = controller; } });
  t.mock.method(globalThis, "fetch", async () => new Response(body));
  const reading = streamAiChat({ appId: "writing", sessionId: null, content: "测试取消", signal: abort.signal,
    onSession() {}, onActivity() {}, onUsage() {}, onError() {}, onDelta: value => events.push(value), onDone: value => events.push(value)
  });
  feed.enqueue(new TextEncoder().encode('event: delta\ndata: {"messageId":"m","delta":"未绘制"}\n\n'));
  await nextTurn(); assert.equal(animation.pending.size, 1);
  abort.abort(); feed.close(); await reading; animation.run();
  assert.deepEqual(events, []); assert.equal(animation.pending.size, 0);
});

test("工作台相同栏宽只写一次，存储拒绝访问时仍允许页面内操作", t => {
  const { browser } = browserEvents(t);
  let stored = null, writes = 0;
  browser.localStorage = { getItem: () => stored, setItem: (_key, value) => { writes += 1; stored = value; } };
  const limits = { min: 100, initial: 200, max: 400 };
  for (let index = 0; index < 1000; index += 1) saveWorkbenchLeftWidth(250, limits);
  assert.equal(writes, 1);
  saveWorkbenchLeftWidth(1000, limits); assert.equal(stored, "400");
  browser.localStorage.getItem = () => { throw new Error("测试存储被禁用"); };
  assert.doesNotThrow(() => saveWorkbenchLeftWidth(300, limits));
});

test("短期快照按最近使用淘汰，超预算内容不缓存；身份退出统一释放各模块缓存", t => {
  const messages = createSnapshotCache(value => value.bytes), settings = createSnapshotCache();
  t.after(() => { messages.dispose(); settings.dispose(); });
  for (let index = 0; index < 16; index += 1) messages.set(`会话${index}`, { bytes: 1 });
  assert.ok(messages.get("会话0"));
  messages.set("会话16", { bytes: 1 });
  assert.equal(messages.get("会话1"), undefined); assert.ok(messages.get("会话0"));
  messages.set("超预算会话", { bytes: 8 * 1024 * 1024 + 1 });
  assert.equal(messages.get("超预算会话"), undefined);
  messages.set("大内容A", { bytes: 5 * 1024 * 1024 }); messages.set("大内容B", { bytes: 5 * 1024 * 1024 });
  assert.equal(messages.get("大内容A"), undefined); assert.ok(messages.get("大内容B"));
  settings.set("账户A", { theme: "dark" }); settings.set("账户B", { theme: "light" });
  clearClientSnapshots();
  assert.equal(messages.get("大内容B"), undefined); assert.equal(settings.get("账户A"), undefined); assert.equal(settings.get("账户B"), undefined);
});

test("1000 个容器尺寸通知只测量初始外框一次、同帧更新一次，同尺寸与卸载不重渲染", t => {
  const { browser } = browserEvents(t), animation = frames(t);
  browser.requestAnimationFrame = globalThis.requestAnimationFrame; browser.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  let notify, disconnected = false, measurements = 0;
  const element = { getBoundingClientRect() { measurements += 1; return { width: 1000, height: 800 }; } };
  const original = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: class {
    constructor(callback) { notify = callback; }
    observe(target) { assert.equal(target, element); }
    disconnect() { disconnected = true; }
  } });
  t.after(() => { if (original) Object.defineProperty(globalThis, "ResizeObserver", original); else delete globalThis.ResizeObserver; });
  const updates = [], stop = observeWorkbenchMetrics(element, value => updates.push(value));
  t.after(stop);
  const resize = width => notify([{ target: element, borderBoxSize: [{ inlineSize: width, blockSize: 800 }], contentRect: { width, height: 800 } }]);
  for (let index = 0; index < 1000; index += 1) resize(1200);
  assert.equal(animation.pending.size, 1); animation.run();
  assert.equal(measurements, 1); assert.equal(updates.length, 1); assert.equal(updates[0].containerWidth, 1200);
  resize(1200); animation.run(); assert.equal(updates.length, 1);
  notify([{ target: element, contentRect: { width: 900, height: 600 } }]); animation.run();
  assert.equal(updates.at(-1).containerWidth, 900);
  resize(1300); stop(); animation.run();
  assert.equal(updates.length, 2); assert.ok(disconnected); assert.equal(animation.pending.size, 0);
});

test("长会话滚动按帧合并，锚点重测不误报布局尺寸变化，卸载撤销", t => {
  const animation = frames(t);
  let notify, rectangles = 0, disconnected = false;
  const original = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: class {
    constructor(callback) { notify = callback; } observe() {} disconnect() { disconnected = true; }
  } });
  t.after(() => { if (original) Object.defineProperty(globalThis, "ResizeObserver", original); else delete globalThis.ResizeObserver; });
  const container = Object.assign(new EventTarget(), { clientHeight: 500, scrollHeight: 100000, scrollTop: 0, firstElementChild: {},
    getBoundingClientRect() { rectangles++; return { top: 50 }; },
    querySelectorAll() { return Array.from({ length: 500 }, (_, index) => ({ dataset: { aiAnchorId: String(index) }, getBoundingClientRect() { rectangles++; return { top: 50 + (index === 1 ? 129 : index * 200) - container.scrollTop }; } })); }
  });
  const snapshots = [], tracker = createConversationScrollTracker(container, value => snapshots.push(value));
  t.after(() => tracker.stop());
  animation.run(); assert.equal(rectangles, 501); assert.equal(snapshots.at(-1).activeId, "0"); assert.equal(snapshots.at(-1).layoutChanged, false);
  assert.equal(snapshots.at(-1).viewportHeight, 500);
  container.scrollTop = 80000;
  for (let i = 0; i < 1000; i++) tracker.refresh();
  assert.equal(animation.pending.size, 1); animation.run();
  assert.equal(rectangles, 501); assert.equal(snapshots.at(-1).activeId, "400"); assert.equal(snapshots.at(-1).layoutChanged, false);
  tracker.refresh(true); animation.run();
  assert.equal(rectangles, 1002); assert.equal(snapshots.at(-1).layoutChanged, false);
  for (let i = 0; i < 1000; i++) notify();
  animation.run(); assert.equal(rectangles, 1503); assert.equal(snapshots.at(-1).layoutChanged, true);
  container.dispatchEvent(new Event("load")); animation.run(); assert.equal(rectangles, 2004); assert.equal(snapshots.at(-1).layoutChanged, true);
  tracker.refresh(true); tracker.stop(); notify(); animation.run();
  container.dispatchEvent(new Event("load")); animation.run();
  assert.ok(disconnected); assert.equal(animation.pending.size, 0); assert.equal(snapshots.length, 5);
});

test("会话导航按提问数量动态增长并保持整数像素等距", () => {
  const single = buildConversationAnchorLayout(1, 900);
  assert.equal(single.height, 64); assert.deepEqual(single.positions, [32]);
  assert.equal(single.hitAreaHeight, 12);
  assert.equal(single.markOffset, 5);

  const short = buildConversationAnchorLayout(4, 900);
  assert.equal(short.height, 64);
  assert.deepEqual(short.positions, [14, 26, 38, 50]);
  assert.equal(short.hitAreaHeight, 12);
  assert.ok(short.positions.slice(1).every((position, index) => position - short.positions[index] >= short.hitAreaHeight));

  const longer = buildConversationAnchorLayout(20, 900);
  assert.ok(longer.height > short.height);
  assert.ok(longer.positions.every(Number.isInteger));
  assert.deepEqual(new Set(longer.positions.slice(1).map((position, index) => position - longer.positions[index])), new Set([12]));
  assert.ok(longer.positions.every(position => position >= 0 && position < longer.height));

  const capped = buildConversationAnchorLayout(50, 900);
  assert.equal(capped.height, Math.round(900 * .42));
  assert.deepEqual(new Set(capped.positions.slice(1).map((position, index) => position - capped.positions[index])), new Set([7]));
  assert.equal(capped.hitAreaHeight, 7);
  assert.ok(capped.positions.every(position => position >= 0 && position < capped.height));

  const dense = buildConversationAnchorLayout(500, 900);
  assert.equal(dense.markHeight, 1);
  assert.equal(dense.hitAreaHeight, 1);
  assert.ok(dense.height > capped.height);
  assert.deepEqual(new Set(dense.positions.slice(1).map((position, index) => position - dense.positions[index])), new Set([1]));
  assert.ok(dense.positions.every(position => position >= 0 && position < dense.height));

  for (const layout of [single, short, longer, capped, dense]) {
    assert.ok(layout.positions.every(position => {
      const buttonTop = position - Math.floor(layout.hitAreaHeight / 2);
      const markTop = buttonTop + layout.markOffset;
      return Number.isInteger(buttonTop)
        && Number.isInteger(markTop)
        && markTop === position - Math.floor(layout.markHeight / 2);
    }));
  }
});

test("会话导航横杠与预览卡共用无间隙的 48px 手形命中区", () => {
  const styles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
  const buttonRule = styles.match(/\.ai-work-chat__anchor \{[^}]+\}/)?.[0] ?? "";
  const previewRule = styles.match(/\.ai-work-chat__anchor-preview \{[^}]+\}/)?.[0] ?? "";

  assert.match(buttonRule, /width:\s*48px/);
  assert.match(buttonRule, /cursor:\s*pointer/);
  assert.doesNotMatch(buttonRule, /transform:/);
  assert.match(previewRule, /left:\s*calc\(100% - 4px\)/);
  assert.match(previewRule, /cursor:\s*pointer/);
  assert.match(previewRule, /transform:\s*translateY\(-50%\)/);
  assert.ok(styles.includes('.ai-work-chat__anchor:is(:hover, :focus-visible, [data-pointer-active="true"]) .ai-work-chat__anchor-mark { width: 34px; background: var(--settings-accent, var(--color-brand)); }'));
  assert.ok(styles.includes('.ai-work-chat__anchor-list:has(.ai-work-chat__anchor:is(:hover, :focus-visible, [data-pointer-active="true"])) .ai-work-chat__anchor.is-active:not(:hover, :focus-visible, [data-pointer-active="true"]) .ai-work-chat__anchor-mark { background: var(--color-text-subtle); }'));
});

test("指针停在会话预览卡上时仅对应刻度变长且卡片保持显示", () => {
  const styles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
  const resetRule = '.ai-work-chat__anchor-list:has(.ai-work-chat__anchor-preview:hover) .ai-work-chat__anchor-mark { width: 6px; background: var(--color-text-subtle); }';
  const selectedCardRule = '.ai-work-chat__anchor-list:has(.ai-work-chat__anchor-preview:hover) .ai-work-chat__anchor:has(.ai-work-chat__anchor-preview:hover) .ai-work-chat__anchor-mark { width: 34px; background: var(--settings-accent, var(--color-brand)); }';
  const staircaseRules = styles.match(/\.ai-work-chat__anchor-list:not\(:has\(\.ai-work-chat__anchor-preview:hover\)\)[^{}]*\{\s*width:\s*(?:28|22|16|11|8)px;\s*\}/g) ?? [];

  assert.ok(styles.includes(resetRule));
  assert.ok(styles.includes(selectedCardRule));
  assert.ok(styles.indexOf(resetRule) < styles.indexOf(selectedCardRule));
  assert.equal(staircaseRules.length, 5);
  assert.ok(styles.includes('.ai-work-chat__anchor:is(:hover, :focus-visible, [data-pointer-active="true"]) .ai-work-chat__anchor-preview { opacity: 1; visibility: visible; }'));
});

test("会话导航在整条动态轨道上选择最近锚点并稳定处理边界", () => {
  assert.equal(findNearestConversationAnchorIndex([], 0), null);
  assert.equal(findNearestConversationAnchorIndex([12, 24, 36], Number.NaN), null);
  assert.equal(findNearestConversationAnchorIndex([12, 24, 36], -100), 0);
  assert.equal(findNearestConversationAnchorIndex([12, 24, 36], 12), 0);
  assert.equal(findNearestConversationAnchorIndex([12, 24, 36], 18), 0);
  assert.equal(findNearestConversationAnchorIndex([12, 24, 36], 19), 1);
  assert.equal(findNearestConversationAnchorIndex([12, 24, 36], 100), 2);

  for (const [count, viewportHeight] of [[4, 900], [20, 900], [50, 900], [500, 900]]) {
    const { positions } = buildConversationAnchorLayout(count, viewportHeight);
    assert.equal(positions.length, count);
    positions.forEach((position, index) => {
      assert.equal(findNearestConversationAnchorIndex(positions, position), index);
      if (index < positions.length - 1) {
        const midpoint = (position + positions[index + 1]) / 2;
        assert.equal(findNearestConversationAnchorIndex(positions, midpoint), index);
        assert.equal(findNearestConversationAnchorIndex(positions, midpoint + 0.1), index + 1);
      }
    });
  }
});

test("会话轨道指针更新每帧只处理最新坐标并能取消待执行帧", t => {
  const animation = frames(t);
  const updates = [];
  const coalescer = createFrameCoalescer(value => updates.push(value));

  coalescer.schedule(12);
  coalescer.schedule(27);
  coalescer.schedule(44);
  assert.equal(animation.pending.size, 1);
  animation.run();
  assert.deepEqual(updates, [44]);

  coalescer.schedule(58);
  coalescer.cancel();
  animation.run();
  assert.deepEqual(updates, [44]);
  assert.equal(animation.pending.size, 0);

  coalescer.schedule(72);
  animation.run();
  assert.deepEqual(updates, [44, 72]);

  coalescer.schedule(86);
  coalescer.cancel();
  animation.run();
  assert.deepEqual(updates, [44, 72]);
  assert.equal(animation.pending.size, 0);
});

test("会话轨道跟随只切换前后两个刻度的瞬时标记", () => {
  const marker = () => ({ value: null, writes: 0, setAttribute(name, value) { assert.equal(name, "data-pointer-active"); this.value = value; this.writes += 1; }, removeAttribute(name) { assert.equal(name, "data-pointer-active"); this.value = null; this.writes += 1; } });
  const first = marker();
  const second = marker();

  let selected = updateConversationAnchorPointerTarget(null, first);
  assert.equal(first.value, "true");
  selected = updateConversationAnchorPointerTarget(selected, first);
  assert.equal(first.writes, 1);
  selected = updateConversationAnchorPointerTarget(selected, second);
  assert.equal(first.value, null);
  assert.equal(second.value, "true");
  assert.equal(first.writes + second.writes, 3);
  selected = updateConversationAnchorPointerTarget(selected, null);
  assert.equal(second.value, null);
  assert.equal(selected, null);
});

test("会话导航将助手输出配给最近的提问，并在下一条提问处开始新一轮", () => {
  const message = (id, role, content, status = "complete") => ({ id, role, content, status, createdAt: "2026-10-02T00:00:00.000Z", activity: [] });
  const anchors = buildConversationAnchors([
    message("q1", "user", "第一条问题"),
    message("a1", "assistant", "第一条\n回复"),
    message("q2", "user", "第二条问题"),
    message("a2", "assistant", "", "queued"),
    message("q3", "user", "第三条问题")
  ]);
  assert.deepEqual(anchors.map(({ question, reply }) => [question.id, reply?.id ?? null]), [["q1", "a1"], ["q2", "a2"], ["q3", null]]);
  assert.equal(conversationAnchorReply(anchors[0].reply), "第一条 回复");
  assert.equal(conversationAnchorReply(anchors[1].reply), "回复排队中");
  assert.equal(conversationAnchorReply(anchors[2].reply), "尚无助手回复");
});

test("AI Work 只按用户滚动意图切换跟随，流式布局变化不会意外暂停", () => {
  assert.equal(shouldFollowLatestMessage(true, null, 120), true);
  assert.equal(shouldFollowLatestMessage(false, null, 0), false);
  assert.equal(shouldFollowLatestMessage(true, "up", 1), false);
  assert.equal(shouldFollowLatestMessage(false, "down", 65), false);
  assert.equal(shouldFollowLatestMessage(false, "down", 64), true);
  assert.equal(shouldFollowLatestMessage(true, "down", 120), true);
});

test("回到底部只在消息布局变化时自动调整位置，普通滚动帧不打断滚动", () => {
  assert.equal(shouldAutoScrollToLatest(true, false), false);
  assert.equal(shouldAutoScrollToLatest(true, true), true);
  assert.equal(shouldAutoScrollToLatest(false, true), false);
});

test("刷新恢复时按首次绘制位置同步决定是否显示回到底部", () => {
  assert.equal(shouldShowScrollToLatest(65, 1), true);
  assert.equal(shouldShowScrollToLatest(64, 1), false);
  assert.equal(shouldShowScrollToLatest(500, 0), false);
});

test("终端同值任务快照不触发更新，输出、取消及任务切换仍能被识别", () => {
  const task = { id: "隔离任务", nodeId: "隔离节点", shell: "powershell", workingDirectory: "", status: "running", message: "执行中", createdAt: "2026-10-01", result: { stdout: "正文".repeat(10000), stderr: "", exitCode: null, timedOut: false, outputTruncated: false }, cancelRequested: false };
  for (let i = 0; i < 1000; i++) assert.ok(sameTerminalTask(task, structuredClone(task)));
  assert.equal(sameTerminalTask(task, { ...task, id: "其他任务" }), false);
  assert.equal(sameTerminalTask(task, { ...task, cancelRequested: true }), false);
  assert.equal(sameTerminalTask(task, { ...task, result: { ...task.result, stdout: "新输出" } }), false);
  assert.equal(sameTerminalTask(task, null), false);
});
