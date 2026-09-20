/**
 * #21.26 Workspace 父领域与专业术语边界门禁。
 * 锁定：一个 @lfaa/workspace package 内部聚合 chat/work/shared；不回退成 chat-workspace/work-workspace 平级包。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const workspaceRoot = "packages/client/workspace/src";

test("workspace is one real parent package with chat work shared children", () => {
  assert.equal(exists("packages/client/workspace/package.json"), true);
  assert.equal(exists(`${workspaceRoot}/chat/index.ts`), true);
  assert.equal(exists(`${workspaceRoot}/work/index.ts`), true);
  assert.equal(exists(`${workspaceRoot}/shared/index.ts`), true);
  assert.equal(exists("packages/chat-workspace"), false);
  assert.equal(exists("packages/work-workspace"), false);
  const manifest = JSON.parse(read("packages/client/workspace/package.json"));
  assert.equal(manifest.name, "@lfaa/workspace");
  assert.equal(manifest.lfaa?.role, "workspace-feature-composition");
});

test("workspace public entry exports modes and shared session only through child public entries", () => {
  const entry = read(`${workspaceRoot}/index.ts`);
  for (const token of ['./chat', './work', './shared']) assert.match(entry, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(entry, /\/view\/|\/logic\/|\/styles\/|\/contracts\//);
});

test("chat and work keep view styles logic contracts inside their own child modules", () => {
  assert.equal(exists(`${workspaceRoot}/chat/view/ChatWorkspace.tsx`), true);
  assert.equal(exists(`${workspaceRoot}/chat/styles/ChatWorkspace.module.css`), true);
  assert.equal(exists(`${workspaceRoot}/work/view/WorkWorkspace.tsx`), true);
  assert.equal(exists(`${workspaceRoot}/work/logic/useWorkCanvasController.ts`), true);
  assert.equal(exists(`${workspaceRoot}/work/logic/work-canvas-layout.ts`), true);
  assert.equal(exists(`${workspaceRoot}/work/contracts/work-canvas.types.ts`), true);
  assert.equal(exists(`${workspaceRoot}/work/styles/WorkWorkspace.module.css`), true);
  assert.equal(exists(`${workspaceRoot}/shared/logic/useWorkspaceSessionController.ts`), true);
  assert.equal(exists(`${workspaceRoot}/shared/contracts/workspace.types.ts`), true);
});

test("workspace session is the single Chat Work run owner and canvas layout stays in Work", () => {
  const session = read(`${workspaceRoot}/shared/logic/useWorkspaceSessionController.ts`);
  const canvas = read(`${workspaceRoot}/work/logic/useWorkCanvasController.ts`);
  assert.match(session, /runtimeHost\.startRun\(\{/);
  assert.match(session, /assistant\.completed/);
  assert.match(session, /workspaceMode,?/);
  assert.match(session, /WORKSPACE_MODE_KEY = "lfaa\.workspace\.mode\.v1"/);
  assert.match(session, /LEGACY_AGENT_SURFACE_KEY = "lfaa\.agent\.surface\.v1"/);
  assert.doesNotMatch(session, /InfiniteCanvas|WORK_CANVAS_LAYOUT_KEY_PREFIX|nodePositions|canvas-layout/);
  assert.match(canvas, /resolveWorkCanvasLayoutKey\(workspaceId\)/);
  assert.match(canvas, /lastRunInput/);
});

test("future domain packages are not pre-created just to mirror architecture diagrams", () => {
  for (const name of ["project", "canvas", "workflow", "task", "asset", "model", "tool", "storage"]) {
    assert.equal(exists(`packages/${name}`), false, `future package ${name} must wait for real implementation + consumer`);
  }
});
