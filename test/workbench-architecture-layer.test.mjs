/** #21.24 App Shell / Web host responsibility-layer contract. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

test("packages/ui is shared UI Kit while product semantics stay in app-shell", () => {
  const packageReadme = read("packages/ui/README.md");
  const appReadme = read("packages/app-shell/src/README.md");
  assert.match(packageReadme, /UI Kit|Design System|共享|通用/i);
  assert.match(appReadme, /产品|Workbench|组合/i);
  const uiIndex = read("packages/ui/src/index.ts");
  assert.match(uiIndex, /InfiniteCanvas|DiscreteSlider|UiEffectHost/);
  assert.doesNotMatch(uiIndex, /DeepSeek|OpenAI|RuntimeControl|AgentSession/);
});

test("web browser bundle and Vite Node dev host are separated by runtime boundary", () => {
  assert.equal(exists("apps/web/src/host-clients/agent-runtime-client.ts"), true);
  assert.equal(exists("apps/web/dev/bridges/agent/agent-runtime-bridge.ts"), true);
  assert.equal(exists("apps/web/dev/bridges/resources/resource-bridge.ts"), true);
  assert.equal(exists("apps/web/dev/bridges/terminal/terminal-bridge.ts"), true);
  assert.equal(exists("apps/web/src/host"), false);
  const vite = read("apps/web/vite.config.ts");
  assert.match(vite, /createLfaaDevResourceBridge\(projectRoot\)/);
  assert.match(vite, /createLfaaDevTerminalBridge\(projectRoot\)/);
  assert.doesNotMatch(vite, /node-pty|spawn\(|readdirSync|chokidar|WebSocketServer/);
});

test("browser LocalTerminal has local view/styles and does not own PTY creation", () => {
  const view = read("apps/web/src/terminal/view/LocalTerminal.tsx");
  const css = read("apps/web/src/terminal/styles/LocalTerminal.module.css");
  assert.match(view, /LocalTerminal\.module\.css/);
  assert.match(css, /\.root|\.host|\.state/);
  assert.doesNotMatch(view, /from ["\']node-pty["\']|require\(["\']node-pty["\']\)|\bspawn\s*\(/);
});

test("WorkCanvas persistence belongs to work-canvas logic, not Session or shared UI", () => {
  const controller = read("packages/app-shell/src/workbench/center/conversation/work-canvas/logic/useWorkCanvasController.ts");
  const layout = read("packages/app-shell/src/workbench/center/conversation/work-canvas/logic/work-canvas-layout.ts");
  const session = read("packages/app-shell/src/workbench/session/logic/useAgentSessionController.ts");
  const canvas = read("packages/ui/src/features/workbench/InfiniteCanvas.tsx");
  assert.match(controller + layout, /WORK_CANVAS_LAYOUT_KEY_PREFIX|resolveWorkCanvasLayoutKey/);
  assert.doesNotMatch(session, /WORK_CANVAS_LAYOUT_KEY_PREFIX|workNodes|nodePositions|canvas-layout/);
  assert.doesNotMatch(canvas, /WORK_CANVAS_LAYOUT_KEY_PREFIX|(?:window\.)?localStorage\s*\./);
});

test("app-shell deep modules use declared package-private imports instead of ../../ chains", () => {
  const pkg = JSON.parse(read("packages/app-shell/package.json"));
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
  walk(path.join(root, "packages/app-shell/src/workbench"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /(?:from\s+|import\()\s*["'](?:\.\.\/){2,}/, path.relative(root, file));
  }
});
