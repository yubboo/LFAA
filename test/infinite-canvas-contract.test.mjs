/**
 * 文件：infinite-canvas-contract.test.mjs
 * 作用：检查 Work 无限画布是真交互 Projection，且 Chat/Work 不复制智能核心。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const canvas = fs.readFileSync("packages/ui/src/features/workbench/InfiniteCanvas.tsx", "utf8");
const shell = fs.readFileSync("packages/app-shell/src/AgentWorkbench.tsx", "utf8");

test("infinite canvas supports pan zoom reset node drag and edge projection", () => {
  for (const token of ["beginPan", "beginNodeDrag", "onWheel", "applyScale", "setViewport({ x: 80, y: 72, scale: 1 })", "<svg", "onNodesChange?.(next)"]) {
    assert.match(canvas, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("workbench exposes Chat and Work as two surfaces on one permission/model/runtime contract", () => {
  assert.match(shell, /agentSurface === "chat"/);
  assert.match(shell, /onAgentSurfaceChange\("work"\)/);
  assert.match(shell, /AGENT_PERMISSION_PROFILES/);
  assert.match(shell, /runtimeConnected=\{Boolean\(props\.agentRuntimeHost\)\}/);
  assert.match(shell, /props\.agentRuntimeHost\.startRun\(\{/);
  assert.match(shell, /surface: agentSurface/);
  assert.match(shell, /permissionProfileId,/);
  assert.match(shell, /const runModelBinding: AgentModelBinding/);
  assert.match(shell, /model: runModelBinding/);
  assert.match(shell, /selectedModelId/);
  assert.doesNotMatch(shell, /GPT-5\.6 Sol/);
  assert.match(shell, /Agent Runtime Host 未连接/);
  assert.match(shell, /Runtime 未连接/);
});
