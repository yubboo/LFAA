/**
 * 文件：infinite-canvas-contract.test.mjs
 * 作用：检查 Work 无限画布是真交互 Projection，且 Chat/Work 不复制智能核心。
 * v0.0.94：按模块 Owner 读取 contracts，而不是假设实现继续堆在 Composition Root。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const canvas = fs.readFileSync("packages/ui/src/features/workbench/InfiniteCanvas.tsx", "utf8");
const shell = fs.readFileSync("packages/app-shell/src/AgentWorkbench.tsx", "utf8");
const leftSidebar = fs.readFileSync("packages/app-shell/src/workbench/left/LeftSidebarRegion.tsx", "utf8");
const centerWorkspace = fs.readFileSync("packages/app-shell/src/workbench/center/CenterWorkspaceRegion.tsx", "utf8");
const centerHeader = fs.readFileSync("packages/app-shell/src/workbench/center/header/CenterHeader.tsx", "utf8");
const conversationRegion = fs.readFileSync("packages/app-shell/src/workbench/center/conversation/ConversationRegion.tsx", "utf8");
const composerRegion = fs.readFileSync("packages/app-shell/src/workbench/center/composer/ComposerRegion.tsx", "utf8");
const runtimeControl = fs.readFileSync("packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeControl.tsx", "utf8");
const permissionControl = fs.readFileSync("packages/app-shell/src/workbench/center/composer/PermissionControl.tsx", "utf8");
const session = fs.readFileSync("packages/app-shell/src/workbench/session/useAgentSessionController.ts", "utf8");
const aiSettings = fs.readFileSync("packages/app-shell/src/workbench/settings/useAiSettingsController.ts", "utf8");
const settingsViewModels = fs.readFileSync("packages/app-shell/src/workbench/settings/settings-view-models.ts", "utf8");
const workbenchSurface = [shell, leftSidebar, centerWorkspace, centerHeader, conversationRegion, composerRegion, permissionControl, runtimeControl, session, aiSettings, settingsViewModels].join("\n");

test("infinite canvas supports pan zoom reset node drag and edge projection", () => {
  for (const token of ["beginPan", "beginNodeDrag", "onWheel", "applyScale", "setViewport({ x: 80, y: 72, scale: 1 })", "<svg", "onNodesChange?.(next)"]) {
    assert.match(canvas, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("workbench exposes Chat and Work as two surfaces on one permission/model/runtime contract", () => {
  assert.match(workbenchSurface, /agentSurface===?\s*"chat"/);
  assert.match(workbenchSurface, /onAgentSurfaceChange\("work"\)/);
  assert.match(workbenchSurface, /AGENT_PERMISSION_PROFILES/);
  assert.match(workbenchSurface, /runtimeConnected:Boolean\(runtimeHost\)/);
  assert.match(workbenchSurface, /runtimeHost\.startRun\(\{/);
  assert.match(workbenchSurface, /surface:agentSurface/);
  assert.match(workbenchSurface, /permissionProfileId/);
  assert.match(workbenchSurface, /runModelBinding:AgentModelBinding/);
  assert.match(workbenchSurface, /model:runModelBinding/);
  assert.match(workbenchSurface, /selectedModelId/);
  assert.doesNotMatch(workbenchSurface, /GPT-5\.6 Sol/);
  assert.match(workbenchSurface, /Agent Runtime Host 未连接/);
  assert.match(workbenchSurface, /Runtime 未连接/);
});
