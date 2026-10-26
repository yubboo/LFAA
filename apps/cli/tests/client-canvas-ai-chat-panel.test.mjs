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

test("画布右下聊天入口悬停时喷焰起飞，并遵循减少动态效果", () => {
  assert.match(canvasSource, /className="lfaa-cnv-chat-launch__craft" aria-hidden="true"[\s\S]*?<MessageOutlined \/>[\s\S]*?与 AI 对话/u);
  assert.match(canvasSource, /className="lfaa-cnv-chat-launch__effects" aria-hidden="true"[\s\S]*?__smoke[\s\S]*?__jet--left[\s\S]*?__jet--right/u);
  assert.match(canvasStyles, /transition:\s*transform 680ms cubic-bezier\(\.16, 1, \.3, 1\)/u);
  assert.match(canvasStyles, /\.lfaa-cnv-chat-launch__craft::before\s*\{[^}]*opacity:\s*0;[^}]*transition:\s*opacity 420ms/u);
  assert.match(canvasStyles, /--lfaa-cnv-chat-launch-rise:\s*84px/u);
  assert.match(canvasStyles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?translate3d\(0, calc\(0px - var\(--lfaa-cnv-chat-launch-rise\)\), 0\) scale\(1\.05\)/u);
  assert.match(canvasStyles, /\.lfaa-cnv-chat-launch__smoke\s*\{[^}]*top:\s*calc\(100% - var\(--lfaa-cnv-chat-launch-rise\)\);[^}]*left:\s*calc\(50% - 12px\);[^}]*width:\s*152px;[^}]*height:\s*calc\(var\(--lfaa-cnv-chat-launch-rise\) \+ 12px\)/u);
  assert.match(canvasStyles, /@container lfaa-canvas \(max-width: 640px\)[\s\S]*?\.lfaa-cnv-chat-launch__smoke\s*\{[^}]*width:\s*128px/u);
  assert.match(canvasStyles, /@container lfaa-canvas \(max-width: 640px\)[\s\S]*?--lfaa-cnv-chat-launch-rise:\s*38px/u);
  assert.match(canvasStyles, /@media \(max-height: 640px\)[\s\S]*?--lfaa-cnv-chat-launch-rise:\s*38px/u);
  assert.match(canvasStyles, /\.lfaa-cnv-chat-launch.ant-btn:hover \.lfaa-cnv-chat-launch__smoke\s*\{[^}]*opacity:\s*\.9/u);
  assert.match(canvasStyles, /\.lfaa-cnv-chat-launch.ant-btn:hover \.lfaa-cnv-chat-launch__jet\s*\{[^}]*opacity:\s*1/u);
  assert.match(canvasStyles, /\.lfaa-cnv-chat-launch.ant-btn:focus-visible\s*>\s*\.lfaa-cnv-chat-launch__craft[\s\S]*?outline:/u);
  assert.match(canvasStyles, /data-reduced-motion="on"[\s\S]*?\.lfaa-cnv-chat-launch__smoke[\s\S]*?opacity:\s*0/u);
  assert.match(canvasStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.workbench-shell\[data-reduced-motion="system"\][\s\S]*?\.lfaa-cnv-chat-launch__craft[\s\S]*?transform:\s*none/u);
  assert.doesNotMatch(canvasStyles, /\.lfaa-cnv-chat-launch[^{}]*\{[^}]*animation:[^}]*infinite/u);
});
