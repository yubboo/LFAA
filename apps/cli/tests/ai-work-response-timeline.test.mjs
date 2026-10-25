/**
 * 功能：回归 AI Work 正文/操作/交互的真实顺序及默认折叠。
 * 作用：验证同一 Run 分段、最终答案隔离、旧消息兼容和帧合并边界。
 * 关联文件：ui-chat/response-timeline.ts、AiWorkResponse.tsx、connection/stream-deltas.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildResponseTimeline, responseToolGroupLabel, splitAiActivityDetail } from "../../../packages/client/ui-chat/src/response-timeline.ts";
import { createStreamDeltas } from "../../../packages/client/connection/src/stream-deltas.ts";
import { appendAiTextDelta, streamAiChat } from "../../../packages/client/connection/src/api.ts";

const activity = (id, offset, kind = "command") => ({ id, contentOffset: offset, kind, title: "执行本机命令", detail: "真实执行摘要", status: "complete", startedAt: "2026-10-11T01:00:00Z", completedAt: "2026-10-11T01:00:01Z", durationMs: 1000 });
function frames(t, schedule = () => 1) {
  for (const [key, value] of [["requestAnimationFrame", schedule], ["cancelAnimationFrame", () => {}]]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
}
function fixture(status = "complete") {
  const texts = ["先核对现状。", "已找到问题。", "**已经完成。**"];
  let end = 0;
  const parts = texts.map((text, index) => { const start = end; end += text.length; return { id: `part-${index}`, start, end, kind: index === 2 ? "final" : "commentary" }; });
  return { id: "run", role: "assistant", status, createdAt: "2026-10-11T01:00:00Z", content: texts.join(""), parts,
    activity: [{ ...activity("internal-agent", 0, "agent"), title: "小鱼主 Agent" }, { ...activity("internal-tools", 0, "tool"), title: "已登记项目工具" }, activity("command-1", parts[0].end), activity("command-2", parts[0].end), { ...activity("question", parts[1].end, "question"), question: "是否继续？", questionId: "q", options: ["继续", "停止"], detail: "你的回答：继续" }, activity("command-3", parts[1].end)] };
}

test("正文与操作组、确认记录交错，最终答案保持为独立的终态片段", () => {
  const result = buildResponseTimeline(fixture());
  assert.deepEqual(result.blocks.map(block => block.kind), ["text", "tools", "text", "interaction", "tools"]);
  assert.doesNotMatch(JSON.stringify(result.blocks), /小鱼主 Agent|已登记项目工具/u);
  assert.deepEqual(result.blocks[1].activities.map(item => item.id), ["command-1", "command-2"]);
  assert.equal(result.blocks[2].content, "已找到问题。");
  assert.equal(result.finalText, "**已经完成。**");
  assert.ok(!JSON.stringify(result.blocks).includes("已经完成"));
  assert.equal(responseToolGroupLabel([{ ...activity("shell", 0, "tool"), title: "执行本机命令" }]), "运行了命令");
  assert.equal(responseToolGroupLabel([{ ...activity("file", 0, "tool"), fileChanges: [{ operation: "modified", path: "src/main.ts", projectId: "project" }] }]), "编辑了文件");
  assert.equal(responseToolGroupLabel([activity("command-1", 0), activity("command-2", 0), activity("command-3", 0)]), "运行了 3 条命令");
  assert.equal(responseToolGroupLabel([
    { ...activity("file-1", 0, "tool"), fileChanges: [{ operation: "modified", path: "src/main.ts", projectId: "project" }] },
    { ...activity("file-2", 0, "tool"), fileChanges: [{ operation: "created", path: "src/new.ts", projectId: "project" }] }
  ]), "更改了 2 个文件");
  assert.deepEqual(splitAiActivityDetail("命令执行完成。\n本机 PowerShell 命令预览：\nGet-ChildItem"), {
    summary: "命令执行完成。", previewLabel: "Shell 命令", preview: "Get-ChildItem"
  });
  assert.deepEqual(splitAiActivityDetail("搜索网页完成。\n搜索查询：\nLFAA 工作台"), {
    summary: "搜索网页完成。", previewLabel: "搜索查询", preview: "LFAA 工作台"
  });
});

test("流式正文、工具与交互按落点留在同条回复，完成后追加最终答案", () => {
  // 独立进程使用 Web 的正式 JSX 编译配置，不为产品注入全局 React 或测试路由。
  const render = (message, showInteractions = true) => execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
    import {createRequire} from 'node:module';
    const require=createRequire(${JSON.stringify(new URL("../../web/package.json", import.meta.url).href)});
    const {createElement}=require('react');const {renderToStaticMarkup}=require('react-dom/server');
    const {AiWorkResponse}=await import(${JSON.stringify(new URL("../../../packages/client/ui-chat/src/AiWorkResponse.tsx", import.meta.url).href)});
    console.log(renderToStaticMarkup(createElement(AiWorkResponse,{message:${JSON.stringify(message)},renderActivity:item=>createElement('span',{key:item.id},item.id),renderInteraction:${showInteractions ? "item=>createElement('section',null,item.question,item.detail)" : "()=>null"},onOpenProjectFileReview:()=>{}})));
  `], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env, TSX_TSCONFIG_PATH: fileURLToPath(new URL("../../../tsconfig.client.json", import.meta.url)) }, encoding: "utf8" }).trim();
  const running = render(fixture("streaming"));
  assert.match(running, /response-duration" role="status">已处理 \d+ (?:小时|分钟|秒)/u);
  assert.doesNotMatch(running, /response-history|response-divider|response-live/u);
  assert.doesNotMatch(running, /小鱼主 Agent|已登记项目工具/u);
  assert.match(running, /正在思考/u);
  assert.doesNotMatch(running, /<details class="ai-work-chat__tool-group"[^>]*\bopen=/u);
  const durationStart = running.indexOf('class="ai-work-chat__response-duration"');
  const currentActionStart = running.indexOf('class="ai-work-chat__activity-current-action--static"');
  const timelineStart = running.indexOf('class="ai-work-chat__response-timeline"');
  assert.ok(durationStart < currentActionStart && currentActionStart < timelineStart, "耗时与当前状态位于流式时间线顶部");
  assert.ok(running.indexOf("先核对现状。") < running.indexOf("command-1"));
  assert.ok(running.indexOf("command-2") < running.indexOf("已找到问题。"));
  assert.ok(running.indexOf("已找到问题。") < running.indexOf("是否继续？"));
  assert.ok(running.indexOf("command-3") < running.indexOf("已经完成。"));
  const leadingBlankLines = fixture("streaming");
  leadingBlankLines.content = "\n\n首段正文\n\n后续段";
  leadingBlankLines.parts = [{ id: "leading-blank-lines", start: 0, end: leadingBlankLines.content.length, kind: "commentary" }];
  const leadingBlankMarkup = render(leadingBlankLines);
  assert.match(leadingBlankMarkup, /class="ai-work-chat__markdown ai-work-chat__streaming-text[^"]*"><span>首段正文\n<\/span><span>\n<\/span><span>后续段<\/span><\/div>/u,
    "开头空行不再撑出空白高度，正文内部的空行仍保留");
  assert.match(running, /<strong>已经完成。<\/strong>/u);
  assert.doesNotMatch(running, /\*\*已经完成。\*\*/u);
  assert.equal([...running.matchAll(/已经完成。/gu)].length, 1);
  assert.match(running, /是否继续？你的回答：继续/u);
  const finished = render(fixture());
  assert.match(finished, /<details class="ai-work-chat__response-history">/u);
  assert.match(finished, /<summary><span>用时 /u);
  assert.doesNotMatch(finished, /小鱼主 Agent|已登记项目工具/u);
  assert.doesNotMatch(finished, /<details class="ai-work-chat__tool-group"[^>]*\bopen=/u);
  assert.doesNotMatch(render(fixture("streaming"), false), /ai-work-chat__response-interaction/u);
  const finalStart = finished.indexOf('class="ai-work-chat__response-final"');
  const historyStart = finished.indexOf('<details class="ai-work-chat__response-history">');
  const historyEnd = finished.indexOf("</details>", historyStart);
  assert.ok(historyStart < finished.indexOf("command-3") && historyEnd < finalStart, "完成后真实工作过程收在用时折叠区，最终答案独立可见");
  assert.match(finished.slice(finalStart), /<strong>已经完成。<\/strong>/u);
  assert.equal([...finished.matchAll(/已经完成。/gu)].length, 1);
  const withFiles = fixture();
  withFiles.activity.push({ ...activity("file-change", 0, "tool"), title: "编辑文件", fileChanges: [
    { operation: "modified", path: "packages/client/ui-chat/src/AiWorkResponse.tsx", projectId: "project" },
    { operation: "created", path: "apps/cli/tests/response.test.mjs", projectId: "project" },
    { operation: "modified", path: "packages/client/ui-chat/README.md", projectId: "project" },
    { operation: "deleted", path: "docs/retired.md", projectId: "project" },
    { operation: "read", path: "README.md", projectId: "project" }
  ] });
  const withFilesHtml = render(withFiles);
  const fileCardStart = withFilesHtml.indexOf('class="ai-work-chat__response-file-changes"');
  assert.ok(withFilesHtml.indexOf('class="ai-work-chat__response-final"') < fileCardStart, "实际文件清单显示在最终正文之后");
  const fileCard = withFilesHtml.slice(fileCardStart);
  assert.match(fileCard, /已更改 4 个文件/u);
  assert.match(fileCard, /新建 1 · 修改 2 · 删除 1/u, "摘要统计真实文件操作类型，不冒充逐文件行数");
  assert.ok(fileCard.indexOf("packages/client/ui-chat/src/AiWorkResponse.tsx") < fileCard.indexOf("apps/cli/tests/response.test.mjs"));
  assert.ok(fileCard.indexOf("apps/cli/tests/response.test.mjs") < fileCard.indexOf("packages/client/ui-chat/README.md"));
  assert.doesNotMatch(fileCard, /docs\/retired\.md/u, "默认只展示前三项");
  assert.match(fileCard, /再显示 1 个文件/u);
  assert.match(fileCard, /aria-expanded="false"/u, "长清单默认收起");
  assert.match(fileCard, /查看变更，从 packages\/client\/ui-chat\/src\/AiWorkResponse\.tsx 开始/u, "总览入口沿用首个文件的真实差异查看回调");
  assert.doesNotMatch(fileCard, /撤销|新增 \d+ 行/u, "不呈现当前数据合同未提供的逐回复撤销或行数");
  assert.doesNotMatch(fileCard, /<code>README\.md<\/code>/u, "只列修改、新建或删除，不把读取文件算作变更");
  const legacy = fixture(); delete legacy.parts;
  const legacyHtml = render(legacy);
  const legacyHistoryStart = legacyHtml.indexOf('<details class="ai-work-chat__response-history">');
  const legacyHistoryEnd = legacyHtml.indexOf("</details>", legacyHistoryStart);
  assert.ok(legacyHistoryEnd < legacyHtml.indexOf('class="ai-work-chat__response-final"'), "旧消息正文完整可见，过程折叠展示且不推测历史落点");
});

test("老消息不猜测分段；停止时最新部分正文继续可见", () => {
  const old = fixture(); delete old.parts;
  assert.equal(buildResponseTimeline(old).finalText, old.content);
  const stopped = fixture("interrupted"); stopped.parts.forEach(part => part.kind = "commentary");
  assert.equal(buildResponseTimeline(stopped).finalText, "**已经完成。**");
});

test("帧合并不能跨正文段，同一任务的正文只有一份", t => {
  let scheduled; frames(t, callback => { scheduled = callback; return 1; });
  let message = { ...fixture("streaming"), content: "", parts: [] };
  const emitted = [];
  const deltas = createStreamDeltas(value => { emitted.push(value); message = appendAiTextDelta(message, value); });
  deltas.push({ messageId: "run", delta: "阶段", partId: "a", partStart: 0 });
  deltas.push({ messageId: "run", delta: "说明", partId: "a", partStart: 0 });
  deltas.push({ messageId: "run", delta: "结果", partId: "b", partStart: 4 });
  scheduled();
  assert.equal(emitted.length, 2);
  assert.equal(message.content, "阶段说明结果");
  assert.deepEqual(message.parts.map(({ id, start, end }) => ({ id, start, end })), [{ id: "a", start: 0, end: 4 }, { id: "b", start: 4, end: 6 }]);
  deltas.dispose();
});

test("真实 SSE 解析先刷新正文帧再交付分段终态，重连快照保留已有范围", async t => {
  frames(t);
  let attempt = 0; const order = []; const snapshot = { ...fixture("streaming"), content: "阶段", parts: [{ id: "a", start: 0, end: 2, kind: "commentary" }] };
  t.mock.method(globalThis, "fetch", async () => {
    attempt++;
    const frames = attempt === 1 ? [] : [["session", { assistantMessage: snapshot }], ["delta", { messageId: "run", delta: "结果", partId: "b", partStart: 2 }], ["presentation", { messageId: "run", parts: [...snapshot.parts, { id: "b", start: 2, end: 4, kind: "final" }] }], ["done", { status: "complete" }]];
    return new Response(frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
  });
  let message = snapshot;
  await streamAiChat({ runId: "run", appId: "workspace", sessionId: "session", content: "", signal: new AbortController().signal,
    onSession: value => { message = value.assistantMessage; }, onActivity() {}, onUsage() {}, onError: assert.fail,
    onDelta: value => { order.push("delta"); message = appendAiTextDelta(message, value); },
    onPresentation: value => { order.push("presentation"); message.parts = value.parts; }, onDone: () => order.push("done") });
  assert.equal(attempt, 2); assert.deepEqual(order, ["delta", "presentation", "done"]);
  assert.equal(message.content, "阶段结果"); assert.equal(message.parts[1].kind, "final");
});

test("AI Work SSE 保留缓存命中计数，旧 Provider 缺字段时维持未知", async t => {
  const payloads = [
    { messageId: "warm", promptTokens: 100, completionTokens: 8, cacheReadTokens: 76, providerId: "deepseek", modelId: "deepseek-flash" },
    { messageId: "legacy", promptTokens: 40, completionTokens: 5, providerId: "legacy-provider", modelId: "legacy-model" }
  ];
  let requestIndex = 0;
  t.mock.method(globalThis, "fetch", async () => {
    const payload = payloads[requestIndex++];
    return new Response(`event: usage\ndata: ${JSON.stringify(payload)}\n\nevent: done\ndata: {"status":"complete"}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  });
  const received = [];
  for (let index = 0; index < payloads.length; index += 1) {
    await streamAiChat({ runId: "run", appId: "workspace", sessionId: "session", content: "", signal: new AbortController().signal,
      onSession() {}, onActivity() {}, onUsage: value => received.push(value), onError: assert.fail, onDelta() {}, onDone() {} });
  }
  assert.equal(received[0].cacheReadTokens, 76);
  assert.deepEqual(received[1], { messageId: "legacy", promptTokens: 40, completionTokens: 5, cacheReadTokens: null, providerId: "legacy-provider", modelId: "legacy-model" });
});

test("AI Work SSE 传递会话累计用量与模型上下文的实时快照", async t => {
  const sessionUsage = { requestCount: 2, promptTokens: 600, completionTokens: 24, cacheReadTokens: 180, models: [
    { providerId: "deepseek", modelId: "flash", requestCount: 2, promptTokens: 600, completionTokens: 24, cacheReadTokens: 180 }
  ] };
  const normalizedSessionUsage = {
    ...sessionUsage,
    requestCountExact: false,
    models: sessionUsage.models.map(model => ({
      ...model,
      requestCountExact: false,
      cacheReadReportedTokens: null,
      cacheReadReportedRequestCount: null
    }))
  };
  const contextUsage = { providerId: "deepseek", modelId: "flash", contextWindow: 64000, contextWindowSource: "model-catalog", promptTokens: 500, estimatedPromptTokens: 420, systemTokens: 100, toolsTokens: 120, messageTokens: 200, includesImages: false };
  t.mock.method(globalThis, "fetch", async () => new Response([
    `event: usage-progress\ndata: ${JSON.stringify({ messageId: "run", sessionUsage })}`,
    `event: context-usage\ndata: ${JSON.stringify({ messageId: "run", contextUsage })}`,
    `event: usage\ndata: ${JSON.stringify({ messageId: "run", promptTokens: 500, completionTokens: 12, cacheReadTokens: 150, providerId: "deepseek", modelId: "flash", sessionUsage })}`,
    `event: done\ndata: {"status":"complete"}`
  ].join("\n\n"), { headers: { "Content-Type": "text/event-stream" } }));
  const progress = []; const contexts = []; const completedUsage = [];
  await streamAiChat({ runId: "run", appId: "workspace", sessionId: "session", content: "", signal: new AbortController().signal,
    onSession() {}, onActivity() {}, onUsage: value => completedUsage.push(value), onUsageProgress: value => progress.push(value), onContextUsage: value => contexts.push(value), onError: assert.fail, onDelta() {}, onDone() {} });
  assert.deepEqual(progress, [{ messageId: "run", sessionUsage: normalizedSessionUsage }]);
  assert.deepEqual(contexts, [{ messageId: "run", contextUsage }]);
  assert.deepEqual(completedUsage[0], { messageId: "run", promptTokens: 500, completionTokens: 12, cacheReadTokens: 150, providerId: "deepseek", modelId: "flash", sessionUsage: normalizedSessionUsage });
});
