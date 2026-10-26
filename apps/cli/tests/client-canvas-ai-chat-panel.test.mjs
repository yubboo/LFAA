import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const canvasSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/CanvasWorkspace.tsx", import.meta.url), "utf8");
const applicationWorkspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const workbenchSource = readFileSync(new URL("../../../packages/client/ui-layout/src/Workbench.tsx", import.meta.url), "utf8");
const dockWorkbenchSource = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");
const canvasStyles = readFileSync(new URL("../../../packages/client/ui-workspace/src/canvas-workspace.css", import.meta.url), "utf8");

test("画布助手复用 ApplicationWorkspace 的唯一真实 AiWorkChat", () => {
  assert.match(workbenchSource, /const appCanvasRoute = route\.match\(APP_CANVAS_ROUTE_PATTERN\)/u);
  assert.match(workbenchSource, /canvasWorkspace=\{canvasMode \? \{[\s\S]*?applicationId: appCanvasRoute\?\.\[1\]/u);
  assert.match(applicationWorkspace, /const renderAiWorkChatContent = \(workspaceHeader\?: ReactNode\) => <>[\s\S]*?<AiWorkChat/u);
  assert.equal((applicationWorkspace.match(/<AiWorkChat\b/gu) ?? []).length, 1);
  assert.match(applicationWorkspace, /mode === "ai-work" \? renderAiWorkChatContent\(centerHeader\)/u);
  assert.match(applicationWorkspace, /if \(canvasWorkspace\)[\s\S]*?chatPanel=\{renderAiWorkChatContent\(\)\}/u);
  assert.match(applicationWorkspace, /autoSubmitGoal=\{canvasWorkspace \? null : aiWorkGoal\}/u);
});

test("画布助手由 DockKit 右栏挤压画布，并复用完整拖拽吸附行为", () => {
  assert.match(canvasSource, /data-testid="canvas-chat-launch"[\s\S]*?onClick=\{openChatPanel\}/u);
  assert.match(canvasSource, /import \{ ResizableWorkbench \} from "lfaa-client-ui-dockkit\/src\/ResizableWorkbench\.js"/u);
  assert.match(canvasSource, /useWorkbenchMetrics\(workbenchRef, initialCanvasWorkbenchMetrics, true\)/u);
  assert.match(canvasSource, /const CANVAS_CHAT_MAX_WIDTH_SHARE = 0\.4/u);
  assert.match(canvasSource, /workbenchMetrics\.containerWidth \* CANVAS_CHAT_MAX_WIDTH_SHARE/u);
  assert.match(canvasSource, /left=\{null\}[\s\S]*?leftVisible=\{false\}[\s\S]*?leftCollapsed[\s\S]*?center=\{[\s\S]*?className="lfaa-cnv-center-content"[\s\S]*?className="lfaa-cnv-stage"/u);
  assert.match(canvasSource, /right=\{chatMounted \? \([\s\S]*?data-testid="canvas-chat-drawer"/u);
  assert.match(canvasSource, /rightCollapsed=\{!chatOpen\}[\s\S]*?onRightCollapsedChange=\{handleRightCollapsedChange\}/u);
  assert.match(canvasSource, /persistState=\{false\}/u);
  assert.doesNotMatch(canvasSource, /usePointerResize|lfaa-cnv-chat-resizer|chatWidthPercent|setPointerCapture/u);
  assert.match(dockWorkbenchSource, /onPointerDown=\{\(event\) => onSidePointerDown\(event, "right"\)\}/u);
  assert.match(dockWorkbenchSource, /else if \(drag\.snapped\)[\s\S]*?setResolvedRightCollapsed\(true\)/u);
  assert.match(canvasStyles, /\.lfaa-cnv-workbench \.lfaa-workbench__center\s*\{[^}]*position:\s*relative/u);
  assert.match(canvasStyles, /\.lfaa-cnv-center-content\s*\{[^}]*container-type:\s*inline-size;[^}]*container-name:\s*lfaa-canvas/u);
  assert.match(canvasStyles, /\.lfaa-cnv-workbench \.lfaa-workbench__pane--right\s*\{[^}]*border-left:\s*1px solid var\(--color-border\)/u);
  assert.doesNotMatch(canvasStyles, /\.lfaa-cnv-workspace\.has-chat|\.lfaa-cnv-chat-resizer|\.lfaa-cnv-chat-pane\s*\{[^}]*max-width/u);
});
