import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/CanvasWorkspace.tsx", import.meta.url), "utf8");
const workspaceStyles = readFileSync(new URL("../../../packages/client/ui-workspace/src/canvas-workspace.css", import.meta.url), "utf8");
const settingsPage = readFileSync(new URL("../../../packages/client/ui-settings/src/SettingsPage.tsx", import.meta.url), "utf8");

test("无限画布小地图固定放在左上区域，并继续由 showMiniMap 控制显隐", () => {
  assert.match(workspaceSource, /\{canvasSettings\.showMiniMap \? \([\s\S]*?<MiniMap[\s\S]*?position="top-left"/u);
  assert.match(workspaceStyles, /\.lfaa-cnv-stage \.react-flow__panel\.lfaa-cnv-minimap\s*\{[^}]*top:\s*72px;[^}]*left:\s*72px;/u);
  assert.match(workspaceStyles, /@container lfaa-canvas \(max-width: 860px\)[\s\S]*?\.lfaa-cnv-stage \.react-flow__panel\.lfaa-cnv-minimap\s*\{[^}]*top:\s*100px;/u);
  assert.match(workspaceStyles, /@container lfaa-canvas \(max-width: 640px\)[\s\S]*?\.lfaa-cnv-minimap\s*\{\s*display:\s*none;/u);
  assert.match(workspaceStyles, /@media \(max-height: 640px\)[\s\S]*?\.lfaa-cnv-minimap\s*\{\s*display:\s*none;/u);
  assert.match(settingsPage, /title="小地图" description="显示画布左上角的小地图/u);
});
