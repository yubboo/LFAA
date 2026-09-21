/**
 * 文件：workspace-mode-unification.test.mjs
 * 作用：锁定 Chat Agent / Work Agent 同核，以及 Manual 无模型手动模式的产品边界。
 * 负责：验证两种 Agent 表现层共用一个 AgentRunRequest / Runtime Host / Tool 能力，并保证 Manual 不进入 Agent Runtime。
 * 不负责：真实模型网络、真实 Canvas 视觉验收、未注册工具实现。
 * 状态归属：纯源码契约测试，无持久状态。
 * 对外接口：`node --test test/workspace-mode-unification.test.mjs`。
 * 关联文件：@lfaa/agent-runtime、@lfaa/workspace、@lfaa/app-shell、agent-controller。
 * 修改注意事项：禁止重新引入 ChatRuntime/WorkRuntime 两套核心；Manual 必须可在无模型时进入。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const contracts = read("packages/core/agent-runtime/src/core/contracts.ts");
const session = read("packages/client/workspace/src/shared/logic/useWorkspaceSessionController.ts");
const types = read("packages/client/workspace/src/shared/contracts/workspace.types.ts");
const left = read("packages/client/app-shell/src/workbench/left/view/LeftSidebarRegion.tsx");
const center = read("packages/client/app-shell/src/workbench/center/view/CenterWorkspaceRegion.tsx");
const composer = read("packages/client/app-shell/src/workbench/center/composer/view/ComposerRegion.tsx");
const manual = read("packages/client/workspace/src/manual/view/ManualWorkspace.tsx");
const controller = read("packages/api/agent-controller/src/agent-runtime-bridge.ts");
const client = read("packages/client/connection/src/agent-runtime-client.ts");
const codex = read("packages/harness/codex-app-server/src/codex-app-server.ts");

test("Chat and Work are presentation modes over one Agent Core", () => {
  assert.match(contracts, /export type AgentWorkspaceMode = "chat" \| "work"/);
  assert.match(contracts, /readonly workspaceMode: AgentWorkspaceMode/);
  assert.match(contracts, /readonly sessionId: string/);
  assert.doesNotMatch(contracts, /ChatRuntime|WorkRuntime|ChatRunRequest|WorkRunRequest/);
  assert.match(session, /runtimeHost\.startRun\(\{/);
  assert.match(session, /event\.sessionId !== sessionId/);
  assert.match(session, /submitAgentInput/);
  assert.match(left, /聊天 Agent/);
  assert.match(left, /画布 Agent/);
  assert.match(left, /同一套 Agent Core/);
  assert.doesNotMatch(left, /workspaceMode === "chat" \? \(/);
  assert.match(center, /onWorkspaceModeChange/);
  const header = read("packages/client/app-shell/src/workbench/center/header/view/CenterHeader.tsx");
  assert.match(header, /role="tablist"/);
  assert.match(header, />聊天</);
  assert.match(header, />工作</);
  assert.match(header, />手动</);
});

test("Chat intervention is routed through the same Agent Runtime instead of a second chat engine", () => {
  assert.match(contracts, /interveneRun\(runId: string, request: AgentInterventionRequest\)/);
  assert.match(client, /\/interventions/);
  assert.match(controller, /run\.intervention\.accepted/);
  assert.match(controller, /codexRuntime\.steerText/);
  assert.match(codex, /turn\/steer/);
  assert.match(session, /activeRunId \? interveneAgentRun : startAgentRun/);
});

test("Manual is a Workbench mode but never an AgentRunRequest mode", () => {
  assert.match(types, /AgentWorkspaceMode \| "manual"/);
  assert.doesNotMatch(contracts, /AgentWorkspaceMode = [^\n]*manual/);
  assert.match(session, /if \(mode === "manual"\) throw new Error/);
  assert.match(controller, /Manual 不允许进入 Agent Runtime/);
  assert.match(center, /<ManualWorkspace/);
  assert.match(manual, /<InfiniteCanvas/);
  assert.match(manual, /onToggleTerminal/);
  assert.match(composer, /workspaceMode === "manual"/);
  assert.match(composer, /不调用模型/);
});

test("Manual and Agent modes reuse real tool infrastructure instead of fake tool buttons", () => {
  const right = read("packages/client/app-shell/src/workbench/right/view/RightSidebarRegion.tsx");
  assert.match(right, /data-active=\{terminalOpen\} onClick=\{onToggleTerminal\}/);
  assert.match(right, /审查 Tool 尚未注册/);
  assert.match(right, /浏览器 Tool 尚未注册/);
  assert.match(right, /文件 Tool 尚未注册/);
  assert.match(right, /Manual Tool Runtime/);
});


test("Work canvas intervention projects human edits into the same Agent Core and renders the same run output", () => {
  const work = read("packages/client/workspace/src/work/view/WorkWorkspace.tsx");
  const workController = read("packages/client/workspace/src/work/logic/useWorkCanvasController.ts");
  const editor = read("packages/client/workspace/src/work/view/WorkCanvasNodeEditor.tsx");
  assert.match(contracts, /readonly workspaceContext\?: string/);
  assert.match(session, /workspaceContext: workContext\.trim\(\)/);
  assert.match(work, /onContextChange\?\.\(controller\.contextText\)/);
  assert.match(work, /lastRunOutput/);
  assert.match(workController, /lastRunOutput/);
  assert.match(editor, /onSave/);
});
