import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const canvasSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/CanvasWorkspace.tsx", import.meta.url), "utf8");
const applicationWorkspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const workbenchSource = readFileSync(new URL("../../../packages/client/ui-layout/src/Workbench.tsx", import.meta.url), "utf8");
const dockWorkbenchSource = readFileSync(new URL("../../../packages/client/ui-dockkit/src/ResizableWorkbench.tsx", import.meta.url), "utf8");
const canvasStyles = readFileSync(new URL("../../../packages/client/ui-workspace/src/canvas-workspace.css", import.meta.url), "utf8");

test("画布侧聊复用唯一 AiWorkChat 并沿用当前 Canvas App 上下文", () => {
  assert.match(workbenchSource, /const appCanvasRoute = route\.match\(APP_CANVAS_ROUTE_PATTERN\)/u);
  assert.match(workbenchSource, /const modeApp = canvasMode \? \(appCanvasRoute\?\.\[1\] as ApplicationId \| undefined\) \?\? app : app/u);
  assert.match(workbenchSource, /canvasWorkspace=\{canvasMode \? \{[\s\S]*?applicationId: \(appCanvasRoute\?\.\[1\] as ApplicationId \| undefined\) \?\? app/u);
  assert.match(applicationWorkspace, /const renderAiWorkChatContent = \(workspaceHeader\?: ReactNode\) => <>[\s\S]*?<AiWorkChat/u);
  assert.equal((applicationWorkspace.match(/<AiWorkChat\b/gu) ?? []).length, 1);
  assert.match(applicationWorkspace, /contextApplicationId=\{canvasWorkspace && canvasWorkspace\.applicationId !== "workspace" \? canvasWorkspace\.applicationId : workContextApplicationId\}/u);
  assert.match(applicationWorkspace, /right=\{voiceMode \? null : canvasWorkspace && canvasChatOpen \? \([\s\S]*?renderAiWorkChatContent\(\)[\s\S]*?\) : right\}/u);
  assert.match(applicationWorkspace, /autoSubmitGoal=\{canvasWorkspace \? null : aiWorkGoal\}/u);
});

test("画布聊天尊重现有默认展开设置，收起后恢复原上下文栏", () => {
  assert.match(applicationWorkspace, /getCanvasChatOpenOverride\(userId, canvasWorkspace\?\.applicationId \?\? app\) \?\? settings\.canvas\.agentPanelDefaultOpen/u);
  assert.match(applicationWorkspace, /explicitState \?\? settings\.canvas\.agentPanelDefaultOpen/u);
  assert.doesNotMatch(applicationWorkspace, /const open = explicitState \?\? true/u);
  assert.match(applicationWorkspace, /aria-label="收起小鱼会话"[\s\S]*?onClick=\{\(\) => setCanvasChatOpen\(false\)\}/u);
  assert.match(applicationWorkspace, /rightCollapsed=\{canvasWorkspace && canvasChatOpen \? false : chrome\.rightCollapsed\}/u);
  assert.match(applicationWorkspace, /onRightCollapsedChange=\{\(rightCollapsed\) => \{[\s\S]*?setCanvasChatOpen\(false\)[\s\S]*?rightCollapsed: true/u);
  assert.match(dockWorkbenchSource, /onPointerDown=\{\(event\) => onSidePointerDown\(event, "right"\)\}/u);
});

test("画布提供可收起状态联动的聊天入口，并定位 Agent 新建的图片节点", () => {
  assert.match(applicationWorkspace, /agentPanelOpen=\{canvasChatOpen\}/u);
  assert.match(applicationWorkspace, /onOpenAgentChat=\{\(\) => setCanvasChatOpen\(true\)\}/u);
  assert.match(canvasSource, /applicationCanvasView === "canvas" && !agentPanelOpen && onOpenAgentChat[\s\S]*?data-testid="canvas-chat-launch"[\s\S]*?onClick=\{onOpenAgentChat\}/u);
  assert.match(canvasStyles, /\.lfaa-cnv-workspace > \.lfaa-cnv-chat-launch\.ant-btn\s*\{[^}]*position:\s*absolute;[^}]*min-height:\s*44px/u);
  assert.match(canvasSource, /setAgentFocusNodeId\(addedImageNode\.id\)/u);
  assert.match(canvasSource, /flowRef\.current\?\.setCenter\(target\.position\.x \+ width \/ 2, target\.position\.y \+ height \/ 2/u);
});
