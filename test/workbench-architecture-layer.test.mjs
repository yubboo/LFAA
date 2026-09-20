/** #21.25 App Shell / Workspace / Web host responsibility-layer contract. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

test("packages/client/ui is shared UI Kit while Workspace product semantics stay in workspace/app-shell", () => {
  const packageReadme = read("packages/client/ui/README.md");
  const appReadme = read("packages/client/app-shell/src/README.md");
  const workspaceReadme = read("packages/client/workspace/README.md");
  assert.match(packageReadme, /UI Kit|Design System|共享|通用/i);
  assert.match(appReadme, /产品|Workbench|组合/i);
  assert.match(workspaceReadme, /Workspace|Chat|Work|父领域/i);
  const uiIndex = read("packages/client/ui/src/index.ts");
  assert.match(uiIndex, /InfiniteCanvas|DiscreteSlider|UiEffectHost/);
  assert.doesNotMatch(uiIndex, /DeepSeek|OpenAI|RuntimeControl|AgentSession/);
});

test("apps/web is a thin product entry and Host business is composed from packages", () => {
  assert.equal(exists("packages/client/connection/src/agent-runtime-client.ts"), true);
  assert.equal(exists("packages/api/agent-controller/src/agent-runtime-bridge.ts"), true);
  assert.equal(exists("packages/terminal/terminal-vite/src/terminal-bridge.ts"), true);
  assert.equal(exists("packages/bundle/web-app/src/vite.ts"), true);
  assert.equal(exists("apps/web/dev"), false);
  assert.equal(exists("apps/web/src/host-clients"), false);
  const vite = read("apps/web/vite.config.ts");
  const bundle = read("packages/bundle/web-app/src/vite.ts");
  assert.match(vite, /@lfaa\/bundle-web-app\/vite/);
  assert.match(bundle, /createLfaaDevTerminalBridge\(options\.projectRoot\)/);
  assert.match(bundle, /lfaaDevAgentRuntimeBridge\(options\.projectRoot, \{ codexRuntime: codexHost\.textRuntime \}\)/);
  assert.doesNotMatch(vite, /node-pty|spawn\(|readdirSync|WebSocketServer|PluginManager/);
});

test("browser LocalTerminal has local view/styles and does not own PTY creation", () => {
  const view = read("packages/client/ui-terminal/src/view/LocalTerminal.tsx");
  const css = read("packages/client/ui-terminal/src/styles/LocalTerminal.module.css");
  assert.match(view, /LocalTerminal\.module\.css/);
  assert.match(css, /\.root|\.host|\.state/);
  assert.doesNotMatch(view, /from ["\']node-pty["\']|require\(["\']node-pty["\']\)|\bspawn\s*\(/);
});

test("WorkCanvas persistence belongs to work-canvas logic, not Session or shared UI", () => {
  const controller = read("packages/client/workspace/src/work/logic/useWorkCanvasController.ts");
  const layout = read("packages/client/workspace/src/work/logic/work-canvas-layout.ts");
  const session = read("packages/client/workspace/src/shared/logic/useWorkspaceSessionController.ts");
  const canvas = read("packages/client/ui/src/features/workbench/InfiniteCanvas.tsx");
  assert.match(controller + layout, /WORK_CANVAS_LAYOUT_KEY_PREFIX|resolveWorkCanvasLayoutKey/);
  assert.doesNotMatch(session, /WORK_CANVAS_LAYOUT_KEY_PREFIX|workNodes|nodePositions|canvas-layout/);
  assert.doesNotMatch(canvas, /WORK_CANVAS_LAYOUT_KEY_PREFIX|(?:window\.)?localStorage\s*\./);
});

test("app-shell deep modules use declared package-private imports instead of ../../ chains", () => {
  const pkg = JSON.parse(read("packages/client/app-shell/package.json"));
  assert.equal(pkg.imports?.["#workbench/contracts"], "./src/workbench/contracts.ts");
  assert.equal(pkg.imports?.["#workbench/shared"], "./src/workbench/shared/index.ts");
  assert.equal(pkg.imports?.["#center/contracts"], "./src/workbench/center/contracts/center-dependencies.ts");
  assert.equal(pkg.imports?.["#composer/contracts"], "./src/workbench/center/composer/contracts/runtime-control-dependencies.ts");

  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(root, "packages/client/app-shell/src/workbench"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /(?:from\s+|import\()\s*["'](?:\.\.\/){2,}/, path.relative(root, file));
  }
});
