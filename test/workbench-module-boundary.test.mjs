/**
 * #21.25 Workbench 模块边界门禁。
 * 锁定：App Shell 是产品外壳；Chat/Work/Session 已交给 @lfaa/workspace；Center 只通过 package public API 组合 Workspace。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const appShellRoot = "packages/client/app-shell/src/workbench";

const modules = [
  ["left", `${appShellRoot}/left/index.ts`, `${appShellRoot}/left/styles/LeftSidebar.module.css`],
  ["center", `${appShellRoot}/center/index.ts`, `${appShellRoot}/center/styles/CenterWorkspace.module.css`],
  ["center/header", `${appShellRoot}/center/header/index.ts`, `${appShellRoot}/center/header/styles/CenterHeader.module.css`],
  ["center/composer", `${appShellRoot}/center/composer/index.ts`, `${appShellRoot}/center/composer/styles/Composer.module.css`],
  ["center/composer/runtime-control", `${appShellRoot}/center/composer/runtime-control/index.ts`, `${appShellRoot}/center/composer/runtime-control/styles/RuntimeControl.module.css`],
  ["right", `${appShellRoot}/right/index.ts`, `${appShellRoot}/right/styles/RightSidebar.module.css`],
  ["terminal", `${appShellRoot}/terminal/index.ts`, `${appShellRoot}/terminal/styles/BottomTerminal.module.css`],
  ["shell", `${appShellRoot}/shell/index.ts`, `${appShellRoot}/shell/styles/WorkbenchShell.module.css`],
  ["settings", `${appShellRoot}/settings/index.ts`, `${appShellRoot}/settings/styles/SettingsSurface.module.css`],
  ["shared", `${appShellRoot}/shared/index.ts`, `${appShellRoot}/shared/styles/IconButton.module.css`],
];

test("all app-shell parent child modules expose public boundary and local styles when visual", () => {
  for (const [name, index, css] of modules) {
    assert.equal(exists(index), true, `${name} missing public index.ts`);
    if (css) assert.equal(exists(css), true, `${name} missing local CSS Module`);
  }
  assert.equal(exists(`${appShellRoot}/center/conversation`), false, "Chat/Work must not return to app-shell conversation owner");
  assert.equal(exists(`${appShellRoot}/session`), false, "Workspace session must not return to app-shell");
});

test("module roots do not mix TSX controllers styles after responsibility split", () => {
  const moduleDirs = modules.map(([name]) => path.join(root, appShellRoot, name));
  for (const dir of moduleDirs) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      assert.ok(["index.ts", "README.md"].includes(entry.name), `${path.relative(root, dir)}/${entry.name} leaks implementation into module root`);
    }
  }
  assert.equal(exists(`${appShellRoot}/shell/view/WorkbenchShell.tsx`), true);
  assert.equal(exists(`${appShellRoot}/shell/logic/useWorkbenchChromeController.ts`), true);
  assert.equal(exists(`${appShellRoot}/center/composer/runtime-control/contracts/runtime-control.types.ts`), true);
});

test("AgentWorkbench remains a thin composition root and consumes workspace public API", () => {
  const source = read("packages/client/app-shell/src/AgentWorkbench.tsx");
  assert.ok(source.split(/\r?\n/).length <= 160, "AgentWorkbench grew back into a monolith");
  for (const forbidden of ["buildAiProviderViews", "mapPluginInspection", "ResizeObserver", "agentRuntimeHost.subscribe", "<SettingsPage", "<UserMenu", "<ThemeModeMenu", 'className="agent-']) {
    assert.equal(source.includes(forbidden), false, `composition root owns forbidden implementation: ${forbidden}`);
  }
  for (const required of ["useWorkbenchThemeController", "useWorkbenchChromeController", "useAiSettingsController", "usePluginSettingsController", "useWorkspaceSessionController", "@lfaa/workspace", "<WorkbenchShell", "<SettingsSurface"]) {
    assert.equal(source.includes(required), true, `composition root missing ${required}`);
  }
});

test("Center composes header workspace modes composer through public entries only", () => {
  const source = read(`${appShellRoot}/center/view/CenterWorkspaceRegion.tsx`);
  assert.equal(source.includes("useState("), false);
  for (const token of ['from "../header"', 'from "../composer"', 'from "@lfaa/workspace"', "<CenterHeader", "<ChatWorkspace", "<WorkWorkspace", "<ComposerRegion"]) {
    assert.equal(source.includes(token), true, `center missing ${token}`);
  }
  assert.doesNotMatch(source, /@lfaa\/workspace\/src|@lfaa\/workspace\/(?:chat|work|shared)\//);
});

test("Composer owns RuntimeControl through its public entry only", () => {
  const composer = read(`${appShellRoot}/center/composer/view/ComposerRegion.tsx`);
  assert.match(composer, /from "\.\.\/runtime-control"/);
  assert.doesNotMatch(composer, /from "\.\.\/runtime-control\/(?:view|logic|styles|contracts)\//);
  assert.match(composer, /<RuntimeControl/);
  for (const sibling of ["left/", "right/", "terminal/", "settings/"]) assert.equal(composer.includes(sibling), false, `Composer deep-links sibling ${sibling}`);
});

test("shell and settings own app chrome state instead of AgentWorkbench", () => {
  const shell = read(`${appShellRoot}/shell/logic/useWorkbenchChromeController.ts`);
  const theme = read(`${appShellRoot}/shell/logic/useWorkbenchThemeController.ts`);
  const settings = read(`${appShellRoot}/settings/logic/useAiSettingsController.ts`);
  const plugins = read(`${appShellRoot}/settings/logic/usePluginSettingsController.ts`);
  assert.match(shell, /ResizeObserver/); assert.match(shell, /leftPaneWidth/); assert.match(shell, /ChromeState/);
  assert.match(theme, /prefers-color-scheme: dark/);
  assert.match(settings, /buildAiProviderViews/); assert.match(settings, /activeModelBinding/);
  assert.match(plugins, /Plugin Manager/);
});
