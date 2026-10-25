/**
 * 功能：回归 AI Work 忙碌期间的会话切换合同。
 * 作用：确保列表不随 Agent Run 锁死，切换只撤销当前客户端订阅且旧事件不能污染新会话。
 * 关联文件：packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-chat/src/AiWorkChat.tsx。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = path => readFileSync(resolve(root, path), "utf8");
const workspace = read("packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const chat = read("packages/client/ui-chat/src/AiWorkChat.tsx");
const connection = read("packages/client/connection/src/api.ts");
const controller = read("packages/api/workspace-controller/src/index.ts");

test("Agent Run 忙碌时左二会话、新建与会话菜单仍可操作", () => {
  const renderer = workspace.slice(workspace.indexOf("const renderSession"), workspace.indexOf("useEffect(() => {\n    if (!notificationsOpen)"));
  assert.match(renderer, /onSelectSession\(session\.id\)/u);
  assert.doesNotMatch(renderer, /disabled=\{chatBusy\}/u);
  assert.match(workspace, /aria-label="新建会话"[\s\S]*?onNewSession\(\)/u);
  assert.doesNotMatch(workspace, /chatBusy/u);
});

test("切换会话只中止客户端订阅，且旧 Run 事件不能更新当前会话", () => {
  const detach = chat.slice(chat.indexOf("// 只撤销此页面的事件订阅"), chat.indexOf("useEffect(() => () =>", chat.indexOf("// 只撤销此页面的事件订阅")));
  assert.match(detach, /controller\.abort\(\)/u);
  assert.match(detach, /runRequestGenerationRef\.current \+= 1/u);
  assert.doesNotMatch(detach, /cancelAiRun\(/u);
  assert.match(chat, /const isCurrentSubscription = \(\) => requestGeneration === runRequestGenerationRef\.current && !controller\.signal\.aborted/u);
  for (const event of ["onSession", "onPauseState", "onActivity", "onDelta", "onPresentation", "onUsage", "onDone"]) {
    const start = chat.indexOf(`${event}:`);
    assert.notEqual(start, -1, `${event} handler exists`);
    assert.ok(chat.slice(start, start + 500).includes("isCurrentSubscription()"), `${event} ignores stale subscriptions`);
  }
  assert.match(chat, /setMessagesSessionId\(activeSessionId\)/u);
});

test("只有 Owner 确认目录缺失时才弱化会话并禁止新提交", () => {
  assert.match(workspace, /status === "missing"/u);
  assert.match(workspace, /is-project-directory-missing/u);
  assert.match(workspace, /onSelectSession\(session\.id\)/u);
  assert.match(workspace, /setSessionDirectoryCheckRequest\(\{ sessionId, requestId:/u);
  assert.match(workspace, /loadWorkspaceSessionDirectoryAvailability\(\[sessionId\]/u);
  assert.match(workspace, /const wasBusy = aiChatBusyState\.current;[\s\S]*?if \(wasBusy && !busy\)/u);
  assert.match(connection, /body: JSON\.stringify\(\{ sessionIds \}\)/u);
  const availabilityRoute = controller.slice(controller.indexOf('router.post("/workspace/sessions/directory-availability"'), controller.indexOf('router.post("/workspace/projects/browse"'));
  assert.match(availabilityRoute, /resolveAiSessionWorkspaceContext\(userId, sessionId\)/u);
  assert.doesNotMatch(availabilityRoute, /getAiSession\(userId, sessionId\)/u, "目录检查不得水合完整会话历史");
  assert.match(availabilityRoute, /catch \{\s*\/\/ Offline nodes, permission failures and Host errors are unknown/u);
  assert.match(chat, /if \(projectDirectoryMissing && !followRunId\)/u);
  assert.match(chat, /当前会话仍可查看历史记录/u);
});
