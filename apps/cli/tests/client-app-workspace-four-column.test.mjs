import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const workbench = read("../../../packages/client/ui-layout/src/Workbench.tsx");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const workspaceCss = read("../../../packages/client/ui-workspace/src/module-workbench.css");
const rail = read("../../../packages/client/ui-sidebar/src/GlobalNavigationRail.tsx");
const secondaryNavigation = read("../../../packages/client/ui-sidebar/src/SecondaryNavigation.tsx");

test("应用工作区复用 Workbench 已有应用菜单数据与打开链路", () => {
  assert.match(workbench, /const applicationNavigationItems = \[/u);
  assert.match(workbench, /applicationNavigationItems=\{applicationNavigationItems\}/u);
  assert.match(workspace, /applicationNavigationItems\.map\(\(item\) =>/u);
  assert.match(workspace, /if \(item\.route\) onNavigate\(item\.route\)/u);
  assert.match(workspace, /onOpenApplication\(item\.applicationId, "normal"\)/u);
  assert.doesNotMatch(workspace, /const applicationNavigationItems =/u);
});

test("应用图标切换现有左侧 Dock，仍由 ResizableWorkbench 管理分栏", () => {
  assert.match(workspace, /applicationsExpanded=\{!chrome\.leftCollapsed\} onToggleApplications=\{toggleLeft\}/u);
  assert.match(rail, /if \(onToggleApplications\) \{[\s\S]*?onToggleApplications\(\)/u);
  assert.match(workspace, /<ResizableWorkbench[\s\S]*?left=\{left\}[\s\S]*?center=\{center\}[\s\S]*?right=\{right\}/u);
  assert.match(workspace, /return \{ leftCollapsed: false, rightCollapsed: false, rightSwapped: false, terminalOpen: false \}/u);
});

test("左二应用列表沿用共享 SecondaryNavigation 并保留会话与应用专属菜单", () => {
  assert.match(workspace, /<SecondaryNavigation ariaLabel="应用导航"[\s\S]*?groups=\{applicationNavigationGroups\}/u);
  assert.match(workspace, /className="module-sidebar__sessions"/u);
  assert.match(workspace, /aria-label="Minecraft 工作区菜单"/u);
  assert.match(workspace, /aria-label="LFAA 联机服务菜单"/u);
  assert.match(workspaceCss, /\.module-sidebar__application-navigation\s*\{/u);
});

test("共享二级导航支持可选说明和尾部图标，其他页面仍可只显示名称", () => {
  assert.match(secondaryNavigation, /description\?: string/u);
  assert.match(secondaryNavigation, /trailingIcon\?: WorkbenchIconName/u);
  assert.match(secondaryNavigation, /item\.description \? <small>/u);
  assert.match(secondaryNavigation, /item\.trailingIcon \? <WorkbenchIcon/u);
});
