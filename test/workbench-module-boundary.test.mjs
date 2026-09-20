/**
 * #21.24 Workbench 模块边界门禁。
 * 锁定：父子模块 Owner + view/logic/styles/contracts 内部分层 + public index 单一出口。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const appShellRoot = "packages/app-shell/src/workbench";

const modules = [
  ["left", `${appShellRoot}/left/index.ts`, `${appShellRoot}/left/styles/LeftSidebar.module.css`],
  ["center", `${appShellRoot}/center/index.ts`, `${appShellRoot}/center/styles/CenterWorkspace.module.css`],
  ["center/header", `${appShellRoot}/center/header/index.ts`, `${appShellRoot}/center/header/styles/CenterHeader.module.css`],
  ["center/conversation", `${appShellRoot}/center/conversation/index.ts`, `${appShellRoot}/center/conversation/styles/Conversation.module.css`],
  ["center/conversation/work-canvas", `${appShellRoot}/center/conversation/work-canvas/index.ts`, `${appShellRoot}/center/conversation/work-canvas/styles/WorkCanvas.module.css`],
  ["center/composer", `${appShellRoot}/center/composer/index.ts`, `${appShellRoot}/center/composer/styles/Composer.module.css`],
  ["center/composer/runtime-control", `${appShellRoot}/center/composer/runtime-control/index.ts`, `${appShellRoot}/center/composer/runtime-control/styles/RuntimeControl.module.css`],
  ["right", `${appShellRoot}/right/index.ts`, `${appShellRoot}/right/styles/RightSidebar.module.css`],
  ["terminal", `${appShellRoot}/terminal/index.ts`, `${appShellRoot}/terminal/styles/BottomTerminal.module.css`],
  ["shell", `${appShellRoot}/shell/index.ts`, `${appShellRoot}/shell/styles/WorkbenchShell.module.css`],
  ["settings", `${appShellRoot}/settings/index.ts`, `${appShellRoot}/settings/styles/SettingsSurface.module.css`],
  ["session", `${appShellRoot}/session/index.ts`, null],
  ["shared", `${appShellRoot}/shared/index.ts`, `${appShellRoot}/shared/styles/IconButton.module.css`],
];

test("all workbench parent/child modules expose public boundary and local styles when visual", () => {
  for (const [name, index, css] of modules) {
    assert.equal(exists(index), true, `${name} missing public index.ts`);
    if (css) assert.equal(exists(css), true, `${name} missing local CSS Module`);
  }
});

test("module roots do not mix TSX/controllers/styles after responsibility split", () => {
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
  assert.equal(exists(`${appShellRoot}/shell/styles/WorkbenchShell.module.css`), true);
  assert.equal(exists(`${appShellRoot}/center/composer/runtime-control/contracts/runtime-control.types.ts`), true);
});

test("AgentWorkbench remains a thin composition root", () => {
  const source = read("packages/app-shell/src/AgentWorkbench.tsx");
  assert.ok(source.split(/\r?\n/).length <= 160, "AgentWorkbench grew back into a monolith");
  for (const forbidden of ["buildAiProviderViews", "mapPluginInspection", "ResizeObserver", "agentRuntimeHost.subscribe", "<SettingsPage", "<UserMenu", "<ThemeModeMenu", 'className="agent-']) {
    assert.equal(source.includes(forbidden), false, `composition root owns forbidden implementation: ${forbidden}`);
  }
  for (const required of ["useWorkbenchThemeController", "useWorkbenchChromeController", "useAiSettingsController", "usePluginSettingsController", "useAgentSessionController", "<WorkbenchShell", "<SettingsSurface"]) {
    assert.equal(source.includes(required), true, `composition root missing ${required}`);
  }
});

test("global app-shell CSS is reset-only and module CSS cannot escape globally", () => {
  const css = read("packages/app-shell/src/agent-workbench.css");
  assert.ok(css.split(/\r?\n/).length <= 40, "global stylesheet grew beyond reset scope");
  assert.doesNotMatch(css, /^\s*\.agent-/m);
  assert.doesNotMatch(css, /:global\(/);
  const workbenchDir = path.join(root, appShellRoot);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  for (const file of walk(workbenchDir).filter((file) => file.endsWith(".module.css"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /:global\(/, `${path.relative(root, file)} contains :global escape`);
    assert.doesNotMatch(source, /\.agent-[\w-]+/, `${path.relative(root, file)} reaches legacy global agent classes`);
  }
});

test("Center composes child modules only through public entries", () => {
  const source = read(`${appShellRoot}/center/view/CenterWorkspaceRegion.tsx`);
  assert.equal(source.includes("useState("), false);
  for (const token of ['from "../header"', 'from "../conversation"', 'from "../composer"', "<CenterHeader", "<ConversationRegion", "<ComposerRegion"]) {
    assert.equal(source.includes(token), true, `center missing ${token}`);
  }
  assert.doesNotMatch(source, /from "\.\.\/(?:header|conversation|composer)\/(?:view|logic|styles|contracts)\//);
});

test("Conversation delegates Work Surface to work-canvas public entry", () => {
  const source = read(`${appShellRoot}/center/conversation/view/ConversationRegion.tsx`);
  assert.match(source, /from "\.\.\/work-canvas"/);
  assert.match(source, /<WorkCanvasRegion/);
  assert.doesNotMatch(source, /InfiniteCanvas|localStorage|WORK_CANVAS_LAYOUT_KEY_PREFIX/);
});

test("Composer owns RuntimeControl through its public entry only", () => {
  const composer = read(`${appShellRoot}/center/composer/view/ComposerRegion.tsx`);
  assert.match(composer, /from "\.\.\/runtime-control"/);
  assert.doesNotMatch(composer, /from "\.\.\/runtime-control\/(?:view|logic|styles|contracts)\//);
  assert.match(composer, /<RuntimeControl/);
  for (const sibling of ["left/", "right/", "terminal/", "conversation/"]) {
    assert.equal(composer.includes(sibling), false, `Composer deep-links sibling ${sibling}`);
  }
});

test("shell/settings/session own their state instead of AgentWorkbench", () => {
  const shell = read(`${appShellRoot}/shell/logic/useWorkbenchChromeController.ts`);
  const theme = read(`${appShellRoot}/shell/logic/useWorkbenchThemeController.ts`);
  const settings = read(`${appShellRoot}/settings/logic/useAiSettingsController.ts`);
  const plugins = read(`${appShellRoot}/settings/logic/usePluginSettingsController.ts`);
  const session = read(`${appShellRoot}/session/logic/useAgentSessionController.ts`);
  assert.match(shell, /ResizeObserver/); assert.match(shell, /leftPaneWidth/); assert.match(shell, /ChromeState/);
  assert.match(theme, /prefers-color-scheme: dark/);
  assert.match(settings, /buildAiProviderViews/); assert.match(settings, /activeModelBinding/);
  assert.match(plugins, /Plugin Manager/);
  assert.match(session, /agentRuntimeHost|runtimeHost/); assert.match(session, /assistant\.completed/); assert.match(session, /startAgentRun/);
  assert.doesNotMatch(session, /InfiniteCanvas|WORK_CANVAS_LAYOUT_KEY_PREFIX|workNodes|nodePositions|canvas-layout/);
});

test("feature modules do not deep-link sibling feature implementations", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name)) files.push(p);
    }
  };
  walk(path.join(root, appShellRoot));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file).replaceAll("\\", "/");
    if (rel.includes("/shared/") || rel.endsWith("contracts.ts") || rel.endsWith("reasoning-control.ts") || rel.endsWith("runtime-control-dependencies.ts")) continue;
    assert.doesNotMatch(source, /from ["'][^"']*\/(left|right|terminal|settings|session)\/(view|logic|styles|contracts)\//, `${rel} deep-links a feature implementation`);
  }
});
