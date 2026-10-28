/**
 * 功能：回归 AI Work 正文/操作/交互的真实顺序及默认折叠。
 * 作用：验证同一 Run 分段、最终答案隔离、旧消息兼容和帧合并边界。
 * 关联文件：ui-chat/response-timeline.ts、AiWorkResponse.tsx、connection/stream-deltas.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildResponseTimeline, getResponseShimmerHue, latestBrowserPreviewActivity, responseToolGroupLabel, splitAiActivityDetail } from "../../../packages/client/ui-chat/src/response-timeline.ts";
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

test("七色流光相位按回复 ID 稳定派生，token 更新不会换色", () => {
  const hue = getResponseShimmerHue("reply-a");
  assert.equal(getResponseShimmerHue("reply-a"), hue);
  assert.notEqual(getResponseShimmerHue("reply-b"), hue);
  assert.ok(Number.isInteger(hue) && hue >= 0 && hue < 360);
});

test("正文与操作组、确认记录交错，最终答案保持为独立的终态片段", () => {
  const result = buildResponseTimeline(fixture());
  assert.deepEqual(result.blocks.map(block => block.kind), ["text", "tools", "text", "interaction", "tools"]);
  assert.doesNotMatch(JSON.stringify(result.blocks), /小鱼主 Agent|已登记项目工具/u);
  assert.deepEqual(result.blocks[1].activities.map(item => item.id), ["command-1", "command-2"]);
  assert.equal(result.blocks[2].content, "已找到问题。");
  assert.equal(result.finalText, "**已经完成。**");
  assert.ok(!JSON.stringify(result.blocks).includes("已经完成"));
  assert.equal(responseToolGroupLabel([{ ...activity("shell", 0, "tool"), title: "执行本机命令" }]), "运行了命令");
  assert.equal(responseToolGroupLabel([{ ...activity("active-file", 0, "tool"), title: "操作项目文件", detail: "参数校验通过；按当前权限执行", status: "running" }]), "正在执行：操作项目文件");
  assert.equal(responseToolGroupLabel([{ ...activity("active-shell", 0), title: "执行本机命令", status: "running" }]), "正在运行命令");
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

test("隐藏重复模型阶段，只保留真实上下文整理、工具和执行错误", () => {
  const firstEnd = "发现问题。".length;
  const content = "发现问题。查询后已修复。";
  const message = {
    id: "status-filter-run", role: "assistant", status: "complete", createdAt: "2026-10-27T00:00:00Z",
    content, activity: [
      { ...activity("prepare", 0, "status"), title: "整理对话上下文" },
      { ...activity("request", 0, "status"), title: "请求 deepseek · deepseek-flash" },
      { ...activity("context", firstEnd, "status"), title: "上下文管理", detail: "根据本轮真实管理结果整理了历史上下文。" },
      { ...activity("inference", firstEnd, "status"), title: "模型推理中 · deepseek-flash" },
      { ...activity("receive", firstEnd, "status"), title: "流式接收回答" },
      { ...activity("tool", firstEnd, "tool"), title: "查询 Minecraft 核心" },
      { ...activity("failure", content.length, "status"), title: "可选路由不可用", status: "unavailable" }
    ], parts: [
      { id: "commentary", start: 0, end: firstEnd, kind: "commentary" },
      { id: "final", start: firstEnd, end: content.length, kind: "final" }
    ]
  };
  const result = buildResponseTimeline(message);
  const serialized = JSON.stringify(result.blocks);
  const context = result.blocks.find(block => block.kind === "activity");
  const tools = result.blocks.find(block => block.kind === "tools");

  assert.doesNotMatch(serialized, /整理对话上下文|请求 deepseek|模型推理中|流式接收回答|deepseek-flash/u);
  assert.equal(context?.activity.title, "已优化对话", "只把真实完成的上下文整理映射为简短操作记录");
  assert.equal(tools?.activities[0]?.id, "tool", "实际派发的工具仍处于正文的真实落点");
  assert.equal(result.blocks.at(-1)?.kind, "activity", "执行错误仍保留为可见状态");
});

test("相邻 Provider 正文分段合并后再流式解析 Markdown", () => {
  const content = "说明文字\n\n> 正在引用\n\n```bash\necho ready\n";
  const quoteCut = content.indexOf("> 正在引用") + 1;
  const fenceCut = content.indexOf("bash") + 2;
  const message = {
    id: "split-markdown-run", role: "assistant", status: "streaming", createdAt: "2026-10-27T00:00:00Z",
    content, activity: [], parts: [
      { id: "reply-1", start: 0, end: quoteCut, kind: "commentary" },
      { id: "reply-2", start: quoteCut, end: fenceCut, kind: "commentary" },
      { id: "reply-3", start: fenceCut, end: content.length, kind: "commentary" }
    ]
  };
  const result = buildResponseTimeline(message);

  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].kind, "text");
  assert.equal(result.blocks[0].content, content);
  assert.equal(result.blocks[0].streaming, true);
});

test("流式正文、工具与交互按落点留在同条回复，完成后追加最终答案", () => {
  // 独立进程使用 Web 的正式 JSX 编译配置，不为产品注入全局 React 或测试路由。
  const render = (message, showInteractions = true) => execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
    import {createRequire} from 'node:module';
    const require=createRequire(${JSON.stringify(new URL("../../web/package.json", import.meta.url).href)});
    const {createElement}=require('react');const {renderToStaticMarkup}=require('react-dom/server');
    const {AiWorkResponse,AiActivityToolUsageCard}=await import(${JSON.stringify(new URL("../../../packages/client/ui-chat/src/AiWorkResponse.tsx", import.meta.url).href)});
    console.log(renderToStaticMarkup(createElement(AiWorkResponse,{message:${JSON.stringify(message)},renderActivity:item=>createElement('span',{key:item.id},item.id,item.toolUsage?createElement(AiActivityToolUsageCard,{usage:item.toolUsage,stages:item.toolStages}):null),renderInteraction:${showInteractions ? "item=>createElement('section',null,item.question,item.detail)" : "()=>null"},onOpenProjectFile:()=>{},onBrowserToolCompleted:()=>{}})));
  `], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env, TSX_TSCONFIG_PATH: fileURLToPath(new URL("../../../tsconfig.client.json", import.meta.url)) }, encoding: "utf8" }).trim();
  const running = render(fixture("streaming"));
  assert.match(running, new RegExp(`--ai-work-stream-hue:${getResponseShimmerHue("run")}deg`), "回复色相来自稳定的消息 ID");
  assert.match(running, /response-duration"><span class="ai-work-chat__assistant-identity">[\s\S]*?小鱼助手[\s\S]*?已处理 \d+ (?:小时|分钟|秒)/u);
  assert.match(running, /class="ai-work-chat__assistant-mark ai-work-chat__assistant-mark--processing" aria-hidden="true"/u, "真实处理中显示装饰性小鱼标识并启用动效状态");
  assert.doesNotMatch(running, /response-duration" role="status"/u, "秒级耗时更新不占用 live status 播报");
  assert.doesNotMatch(running, /response-history|response-divider|response-live/u);
  assert.doesNotMatch(running, /小鱼主 Agent|已登记项目工具/u);
  assert.match(running, /ai-work-chat__activity-live-status--processing[^>]*[\s\S]*?<span>正在回复<\/span>/u, "已有可见正文时状态为正在回复");
  assert.doesNotMatch(running, /activity-current-action--static/u, "当前状态不固定在耗时行下方");
  assert.doesNotMatch(running, /<details class="ai-work-chat__tool-group"[^>]*\bopen=/u, "运行中的工具活动组默认收起，真实状态仍在摘要中");
  const durationStart = running.indexOf('class="ai-work-chat__response-duration"');
  const timelineStart = running.indexOf('class="ai-work-chat__response-timeline"');
  const currentActionStart = running.indexOf('class="ai-work-chat__activity-live-status');
  assert.ok(durationStart < timelineStart && timelineStart < currentActionStart, "当前状态放在实际流式时间线中");
  assert.ok(running.indexOf("先核对现状。") < running.indexOf("command-1"));
  assert.ok(running.indexOf("command-2") < running.indexOf("已找到问题。"));
  assert.ok(running.indexOf("已找到问题。") < running.indexOf("是否继续？"));
  assert.ok(running.indexOf("command-3") < running.indexOf("已经完成。"));

  const thinking = fixture("streaming");
  thinking.content = "";
  thinking.parts = [];
  thinking.activity = [
    { ...activity("request-phase", 0, "status"), title: "请求 deepseek · deepseek-flash" },
    { ...activity("thinking-done", 0, "status"), title: "模型推理中 · deepseek-flash" },
    { ...activity("thinking-phase", 0, "status"), title: "模型推理中 · deepseek-flash", status: "running" }
  ];
  const thinkingMarkup = render(thinking);
  assert.match(thinkingMarkup, /<span>正在思考<\/span>/u, "首个可见正文前保留真实思考状态");
  assert.doesNotMatch(thinkingMarkup, /request-phase|thinking-done|thinking-phase|deepseek-flash/u, "运行中隐藏重复的内部模型阶段行");
  assert.equal([...thinkingMarkup.matchAll(/class="ai-work-chat__activity-live-status/g)].length, 1, "运行中只显示一个当前状态");
  assert.ok(thinkingMarkup.indexOf('class="ai-work-chat__response-timeline"') < thinkingMarkup.indexOf('class="ai-work-chat__activity-live-status'), "思考状态属于时间线，而不是单独固定行");

  const actualReply = fixture("streaming");
  actualReply.activity = [{ ...activity("reply-phase", actualReply.parts[0].end, "status"), title: "流式接收回答", status: "running" }];
  const actualReplyMarkup = render(actualReply);
  assert.ok(actualReplyMarkup.indexOf("已经完成。") < actualReplyMarkup.indexOf("正在回复"), "流式回复状态跟随最新可见正文，而不是停在阶段开始偏移");
  const replyAfterTool = fixture("streaming");
  const replyOffset = replyAfterTool.content.length;
  replyAfterTool.activity = [
    { ...activity("minecraft-core-query", replyOffset, "tool"), title: "查询可用 Minecraft 核心" },
    { ...activity("reply-after-tool", replyOffset, "status"), title: "流式接收回答", status: "running", completedAt: null, durationMs: null }
  ];
  const replyAfterToolMarkup = render(replyAfterTool);
  const replyToolSummary = replyAfterToolMarkup.slice(replyAfterToolMarkup.indexOf("<summary"), replyAfterToolMarkup.indexOf("</summary>") + "</summary>".length);
  assert.match(replyToolSummary, /ai-work-chat__tool-group-live-status[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"><span>正在回复<\/span>/u,
    "工具活动后的正在回复状态嵌入同一条可展开摘要");
  assert.doesNotMatch(replyAfterToolMarkup, /<div class="ai-work-chat__activity-live-status[^>]*>\s*<span>正在回复/u,
    "已合并到工具摘要的回复状态不再另起一行");
  const partialReply = fixture("streaming");
  partialReply.content = "先核对现状。";
  partialReply.parts = [{ id: "part-0", start: 0, end: partialReply.content.length, kind: "commentary" }];
  partialReply.activity = [{ ...activity("reply-phase", 0, "status"), title: "流式接收回答", status: "running" }];
  const partialReplyMarkup = render(partialReply);
  assert.ok(partialReplyMarkup.indexOf("先核对现状。") < partialReplyMarkup.indexOf("正在回复"), "正文增长前状态位于当时正文末尾");

  const activeTool = fixture("streaming");
  activeTool.activity.push({ ...activity("active-file", activeTool.content.length, "tool"), title: "操作项目文件", detail: "参数校验通过；按当前权限执行", status: "running", completedAt: null, durationMs: null,
    toolUsage: { name: "project_files", description: "读取、创建、修改或核对当前项目中的文件。", parameters: [{ name: "operation", type: "string", required: true, description: "要执行的文件操作。" }, { name: "path", type: "string", required: true, description: "项目内相对路径。" }], parametersTruncated: false, guidance: "先读取当前文件；写入后检查实际差异。" },
    toolStages: [{ stage: "模型已选择工具", detail: "模型请求读取指定项目文件。" }, { stage: "参数已校验", detail: "工具 Owner 校验项目相对路径；参数值不公开。" }] });
  const activeToolMarkup = render(activeTool);
  assert.match(activeToolMarkup, /ai-work-chat__tool-group--running[^>]*>/u);
  assert.doesNotMatch(activeToolMarkup, /<details class="ai-work-chat__tool-group[^>]*\bopen=/u, "多步执行时工具组默认收起，避免活动记录挤占正文");
  assert.match(activeToolMarkup, /<summary class="ai-work-chat__tool-contract-summary">[\s\S]*?查看执行步骤/u, "工具步骤以简短动作入口显示，不把原始函数名放在主时间线摘要中");
  assert.doesNotMatch(activeToolMarkup, /<details class="ai-work-chat__tool-contract"[^>]*\bopen=/u, "工具用途、参数字段与阶段详情默认收起");
  assert.doesNotMatch(activeToolMarkup, /<details class="ai-work-chat__tool-contract-details"[^>]*\bopen=/u, "完整工具合同仍需用户主动展开");
  assert.match(activeToolMarkup, /ai-work-chat__tool-contract-steps[^>]*>[\s\S]*?模型已选择工具/u, "展开工具步骤后先显示紧凑的真实阶段标签");
  assert.match(activeToolMarkup, /ai-work-chat__tool-contract-details-summary[^>]*>[\s\S]*?查看完整调用说明与参数/u, "完整合同和 Schema 放在第二层详情中");
  assert.match(activeToolMarkup, /正在执行：操作项目文件/u, "当前工具动作显示在实际工具活动组");
  assert.match(activeToolMarkup, /project_files/u, "显示本轮调用的准确工具函数名");
  assert.match(activeToolMarkup, /读取、创建、修改或核对当前项目中的文件/u, "显示模型本轮收到的工具用途");
  assert.match(activeToolMarkup, /项目内相对路径/u, "显示字段用途，帮助理解工具参数合同");
  assert.match(activeToolMarkup, /参数值不公开/u, "执行阶段沿同一时间线保留且不泄漏实际参数值");
  assert.doesNotMatch(activeToolMarkup, /secret-argument-value/u, "活动流不渲染参数值");
  assert.doesNotMatch(activeToolMarkup, /activity-live-status/u, "真实工具活动不重复生成顶置状态");
  const leadingBlankLines = fixture("streaming");
  leadingBlankLines.content = "\n\n首段正文\n\n后续段";
  leadingBlankLines.parts = [{ id: "leading-blank-lines", start: 0, end: leadingBlankLines.content.length, kind: "commentary" }];
  const leadingBlankMarkup = render(leadingBlankLines);
  assert.match(leadingBlankMarkup, /class="ai-work-chat__markdown[^"]*"><p><span>首段正文<\/span><\/p><p><span>后续段<\/span><\/p><\/div>/u,
    "开头空行不撑高回复，正文空行形成自然分段");
  assert.match(running, /<strong>已经完成。<\/strong>/u);
  assert.doesNotMatch(running, /\*\*已经完成。\*\*/u);
  assert.equal([...running.matchAll(/已经完成。/gu)].length, 1);
  assert.match(running, /是否继续？你的回答：继续/u);
  const finished = render(fixture());
  assert.doesNotMatch(finished, /<details class="ai-work-chat__response-history"/u, "完成后正文与操作不会被整体收进外层折叠");
  assert.match(finished, /<details class="ai-work-chat__response-process"><summary class="ai-work-chat__response-duration ai-work-chat__response-process-summary"><span class="ai-work-chat__assistant-identity">[\s\S]*?小鱼助手[\s\S]*?用时 [\s\S]*?<span class="ai-work-chat__response-state" data-tone="complete">已完成<\/span>/u,
    "完成后小鱼助手用时标题包含默认收起的执行过程");
  assert.doesNotMatch(finished, /ai-work-chat__assistant-mark--processing/u, "回复结束后小鱼保持静止");
  const waiting = fixture("waiting_input");
  waiting.activity = [{ ...activity("pending-question", 0, "question"), status: "waiting_input", completedAt: null, question: "要继续吗？", questionId: "q", options: ["继续"] }];
  assert.doesNotMatch(render(waiting), /ai-work-chat__assistant-mark--processing/u, "等待用户输入时小鱼保持静止");
  assert.match(finished, /class="ai-work-chat__response-state" data-tone="complete">已完成<\/span>/u, "整轮终态来自真实 complete 消息状态并显示在固定标题行");
  assert.doesNotMatch(finished, /小鱼主 Agent|已登记项目工具/u);
  assert.doesNotMatch(finished, /<details class="ai-work-chat__tool-group"[^>]*\bopen=/u, "回看已完成过程时工具组仍默认收起，按需查看具体步骤");
  assert.doesNotMatch(render(fixture("streaming"), false), /ai-work-chat__response-interaction/u);
  const finalStart = finished.indexOf('class="ai-work-chat__response-final"');
  const headerStart = finished.indexOf('class="ai-work-chat__response-duration"');
  const finishedTimelineStart = finished.indexOf('class="ai-work-chat__response-timeline"');
  assert.ok(headerStart < finishedTimelineStart && finishedTimelineStart < finished.indexOf("command-3") && finished.indexOf("command-3") < finalStart && finished.lastIndexOf("</details>") < finalStart,
    "公开过程保持原顺序并收在标题下，最终答复位于折叠区外");
  assert.match(finished.slice(finalStart), /<strong>已经完成。<\/strong>/u);
  assert.equal([...finished.matchAll(/已经完成。/gu)].length, 1);
  const failedReply = fixture("error");
  failedReply.content = "真实执行失败：Provider 连接超时。";
  failedReply.parts = [{ id: "failure-final", start: 0, end: failedReply.content.length, kind: "final" }];
  const failedMarkup = render(failedReply);
  assert.match(failedMarkup, /class="ai-work-chat__response-state" data-tone="error">未能完成<\/span>/u);
  assert.match(failedMarkup, /真实执行失败：Provider 连接超时/u, "失败诊断继续展示真实回复内容，不由状态标签合成");
  const stoppedReply = fixture("interrupted");
  stoppedReply.content = "任务已停止。";
  stoppedReply.parts = [{ id: "stopped-final", start: 0, end: stoppedReply.content.length, kind: "final" }];
  assert.match(render(stoppedReply), /class="ai-work-chat__response-state" data-tone="stopped">已停止<\/span>/u);
  const withStages = fixture();
  withStages.activity.splice(2, 0, { ...activity("request-model", 0, "status"), title: "请求 deepseek · flash", detail: "第 1 次模型请求。" });
  const stageTimeline = buildResponseTimeline(withStages);
  assert.notEqual(stageTimeline.blocks[0].kind, "activity", "完成态也不重复展示内部模型请求阶段");
  const stageMarkup = render(withStages);
  assert.doesNotMatch(stageMarkup, /request-model|请求 deepseek|第 1 次模型请求/u, "内部模型请求信息不进入用户回复");
  const emptyHistory = fixture(); emptyHistory.content = ""; emptyHistory.parts = undefined; emptyHistory.activity = [];
  assert.match(render(emptyHistory), /此回复没有保存可展示的过程更新或工具操作/u, "旧消息没有过程数据时明确说明，避免留下空白区");
  const browserActivity = { ...activity("browser-navigation", 0, "tool"), title: "导航浏览器页面", toolId: "browser-use.navigate", browserProviderId: "lfaa-native-browser", detail: "页面导航完成。\n打开网页：\nhttp://127.0.0.1:3000/canvas" };
  const browserReply = fixture(); browserReply.activity.push(browserActivity);
  assert.equal(latestBrowserPreviewActivity(browserReply)?.id, "browser-navigation");
  const browserMarkup = render(browserReply);
  assert.match(browserMarkup, /网页预览/u);
  assert.match(browserMarkup, /http:\/\/127\.0\.0\.1:3000\/canvas/u);
  assert.match(browserMarkup, /打开方式/u);
  const personalBrowserReply = fixture(); personalBrowserReply.activity.push({ ...browserActivity, id: "personal-browser", browserProviderId: "tabbit-personal" });
  assert.equal(latestBrowserPreviewActivity(personalBrowserReply), null, "个人浏览器页面不伪装成可在 LFAA Dock 重开的预览");
  const failedBrowserReply = fixture(); failedBrowserReply.activity.push({ ...browserActivity, id: "failed-browser", status: "error" });
  assert.equal(latestBrowserPreviewActivity(failedBrowserReply), null, "导航失败不生成预览入口");
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
  assert.doesNotMatch(legacyHtml, /<details class="ai-work-chat__response-history"/u, "旧消息也不再把整轮内容放进外层折叠");
  assert.ok(legacyHtml.indexOf('class="ai-work-chat__response-duration"') < legacyHtml.indexOf('class="ai-work-chat__response-final"'), "旧消息正文在固定助手标题下完整可见");
});

test("老消息不猜测分段；停止时最新部分正文继续可见", () => {
  const old = fixture(); delete old.parts;
  assert.equal(buildResponseTimeline(old).finalText, old.content);
  const stopped = fixture("interrupted"); stopped.parts.forEach(part => part.kind = "commentary");
  assert.equal(buildResponseTimeline(stopped).finalText, "**已经完成。**");
});

test("流式正文增量更新分段文本，复用活动结构并保持真实顺序", () => {
  const activities = [activity("command", 2)];
  const first = { ...fixture("streaming"), content: "阶段", parts: [{ id: "reply", start: 0, end: 2, kind: "commentary" }], activity: activities };
  const initial = buildResponseTimeline(first, { label: "正在回复", contentOffset: 2, order: 99, isProcessing: true });
  assert.deepEqual(initial.blocks.map(block => block.kind), ["text", "tools", "status"]);
  assert.equal(initial.blocks[0].content, "阶段");

  const next = { ...first, content: "阶段结果", parts: [{ ...first.parts[0], end: 4 }] };
  const updated = buildResponseTimeline(next, { label: "正在回复", contentOffset: 4, order: 99, isProcessing: true });
  assert.strictEqual(next.activity, activities, "text deltas keep the activity array stable so its sorted structure can be reused");
  assert.deepEqual(updated.blocks.map(block => block.kind), ["text", "tools", "status"]);
  assert.equal(updated.blocks[0].content, "阶段结果", "the latest part end and message content are reflected after each delta");
  assert.equal(updated.blocks[1].activities[0].id, "command");
  assert.equal(updated.blocks[2].label, "正在回复");
});

test("帧合并不能跨正文段，同一任务的正文只有一份", t => {
  let scheduled; frames(t, callback => { scheduled = callback; return 1; });
  let message = { ...fixture("streaming"), content: "", parts: [] };
  const emitted = [];
  const deltas = createStreamDeltas(value => { emitted.push(value); message = appendAiTextDelta(message, value); });
  deltas.push({ messageId: "run", delta: "阶段，", partId: "a", partStart: 0 });
  deltas.push({ messageId: "run", delta: "说明", partId: "a", partStart: 0 });
  deltas.push({ messageId: "run", delta: "结果", partId: "b", partStart: 5 });
  scheduled();
  assert.equal(emitted.length, 2);
  assert.equal(message.content, "阶段，说明结果");
  assert.deepEqual(message.parts.map(({ id, start, end }) => ({ id, start, end })), [{ id: "a", start: 0, end: 5 }, { id: "b", start: 5, end: 7 }]);
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
