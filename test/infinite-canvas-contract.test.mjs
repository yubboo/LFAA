/**
 * 文件：infinite-canvas-contract.test.mjs
 * 作用：锁定 #22.8 Work 无限画布低频布局持久化与选中层级，同时保证 Runtime 业务真值不下沉 UI。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const canvas = read("packages/ui/src/features/workbench/InfiniteCanvas.tsx");
const canvasTypes = read("packages/ui/src/features/workbench/infinite-canvas.types.ts");
const canvasCss = read("packages/ui/src/features/workbench/infinite-canvas.css");
const shell = read("packages/app-shell/src/AgentWorkbench.tsx");
const left = read("packages/app-shell/src/workbench/left/view/LeftSidebarRegion.tsx");
const center = read("packages/app-shell/src/workbench/center/view/CenterWorkspaceRegion.tsx");
const header = read("packages/app-shell/src/workbench/center/header/view/CenterHeader.tsx");
const chat = read("packages/workspace/src/chat/view/ChatWorkspace.tsx");
const workCanvasView = read("packages/workspace/src/work/view/WorkWorkspace.tsx");
const workCanvasController = read("packages/workspace/src/work/logic/useWorkCanvasController.ts");
const workCanvasLayout = read("packages/workspace/src/work/logic/work-canvas-layout.ts");
const session = read("packages/workspace/src/shared/logic/useWorkspaceSessionController.ts");
const composer = read("packages/app-shell/src/workbench/center/composer/view/ComposerRegion.tsx");
const runtimeController = read("packages/app-shell/src/workbench/center/composer/runtime-control/logic/useRuntimeControlController.ts");
const settingsViewModels = read("packages/app-shell/src/workbench/settings/logic/settings-view-models.ts");
const workbenchSurface = [shell, left, center, header, chat, workCanvasView, session, composer, runtimeController, settingsViewModels].join("\n");

test("infinite canvas supports pan zoom reset node drag and edge projection", () => {
  for (const token of ["beginPan", "beginNodeDrag", "onWheel", "applyScale", "resetViewport", "<svg", "onNodesChange?.(next)"]) {
    assert.match(canvas, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("InfiniteCanvas exposes low-frequency commit seams without owning persistence", () => {
  for (const token of ["InfiniteCanvasViewport", "initialViewport", "onViewportCommit", "onNodesCommit"]) {
    assert.match(canvasTypes + canvas, new RegExp(token));
  }
  assert.match(canvas, /VIEWPORT_WHEEL_SETTLE_MS/);
  assert.match(canvas, /scheduleViewportCommit/);
  assert.match(canvas, /onViewportCommit\?\.\(viewportRef\.current\)/);
  assert.match(canvas, /onNodesCommit\?\.\(lastDraggedNodesRef\.current \?\? nodes\)/);
  assert.doesNotMatch(canvas, /(?:window\.)?(?:localStorage|sessionStorage)\s*\./);
});

test("WorkCanvas module owns workspace-scoped visual layout and persists only x/y plus viewport", () => {
  for (const token of [
    'WORK_CANVAS_LAYOUT_KEY_PREFIX = "lfaa.workbench.canvas-layout.v1"',
    "WORK_CANVAS_LAYOUT_VERSION = 1",
    "encodeURIComponent(stableWorkspaceId)",
    "readWorkCanvasLayout",
    "mergeWorkCanvasNodePositions",
    "writeWorkCanvasLayout",
    "WORK_CANVAS_PERSIST_DEBOUNCE_MS",
  ]) assert.match(workCanvasLayout + workCanvasController, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(workCanvasLayout, /nodePositions\[node\.id\]/);
  assert.match(workCanvasLayout, /\[node\.id, \{ x: node\.x, y: node\.y \}\]/);
  assert.doesNotMatch(workCanvasLayout, /nodePositions[\s\S]{0,180}(?:title|description|status|kind)\s*:/);
  assert.match(workCanvasLayout, /rawViewport\.scale >= INFINITE_CANVAS_SCALE_RANGE\.min/);
  assert.match(workCanvasLayout, /rawViewport\.scale <= INFINITE_CANVAS_SCALE_RANGE\.max/);
  assert.match(workCanvasController, /resolveWorkCanvasLayoutKey\(workspaceId\)/);
  assert.match(workCanvasController, /setTimeout\([\s\S]*WORK_CANVAS_PERSIST_DEBOUNCE_MS/);
  assert.match(workCanvasController, /onNodesCommit/);
  assert.match(workCanvasController, /onViewportCommit/);
  assert.match(workCanvasView, /initialViewport=\{controller\.initialViewport\}/);
  assert.match(workCanvasView, /onNodesCommit=\{controller\.onNodesCommit\}/);
  assert.match(workCanvasView, /onViewportCommit=\{controller\.onViewportCommit\}/);
});

test("Canvas layout is not Agent Session business state", () => {
  assert.doesNotMatch(session, /InfiniteCanvas|WORK_CANVAS_LAYOUT_KEY_PREFIX|nodePositions|workNodes|canvas-layout/);
  assert.match(session, /lastRunInput/);
  assert.match(workCanvasController, /lastRunInput/);
  assert.match(center, /<WorkWorkspace workspaceId=\{props\.workspaceId\} lastRunInput=\{props\.lastRunInput\} \/>/);
});

test("selected canvas node is lifted above siblings while edges remain behind nodes", () => {
  assert.match(canvasCss, /\.lfaa-infinite-canvas__edges\{[^}]*z-index:0/);
  assert.match(canvasCss, /\.lfaa-infinite-canvas__node\{[^}]*z-index:10/);
  assert.match(canvasCss, /\.lfaa-infinite-canvas__node\.is-selected\{[^}]*z-index:20/);
  assert.match(canvas, /setSelectedNodeId\(node\.id\)/);
  assert.match(canvas, /onFocus=\{\(\) => setSelectedNodeId\(node\.id\)\}/);
});

test("Workbench still exposes Chat and Work on one model/permission/runtime contract", () => {
  assert.match(workbenchSurface, /agentSurface===?\s*"chat"|agentSurface === "chat"/);
  assert.match(workbenchSurface, /onAgentSurfaceChange\("work"\)/);
  assert.match(workbenchSurface, /runtimeConnected:\s*Boolean\(runtimeHost\)/);
  assert.match(workbenchSurface, /runtimeHost\.startRun\(\{/);
  assert.match(workbenchSurface, /surface:\s*agentSurface/);
  assert.match(workbenchSurface, /permissionProfileId/);
  assert.match(workbenchSurface, /runModelBinding:\s*AgentModelBinding/);
  assert.match(workbenchSurface, /model:\s*runModelBinding/);
  assert.match(workbenchSurface, /selectedModelId/);
  assert.doesNotMatch(workbenchSurface, /GPT-5\.6 Sol/);
  assert.match(workbenchSurface, /Agent Runtime Host 未连接/);
  assert.match(workbenchSurface, /Runtime 未连接/);
});
