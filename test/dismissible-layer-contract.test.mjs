import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hook = readFileSync(new URL("../packages/ui/src/ui-overlay/useDismissibleLayer.ts", import.meta.url), "utf8");
const uiIndex = readFileSync(new URL("../packages/ui/src/index.ts", import.meta.url), "utf8");
const workbench = readFileSync(new URL("../packages/app-shell/src/AgentWorkbench.tsx", import.meta.url), "utf8");

test("shared ui-overlay dismissible layer owns outside-pointer and Escape behavior", () => {
  assert.match(hook, /document\.addEventListener\("pointerdown", onPointerDown, true\)/);
  assert.match(hook, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(hook, /event\.composedPath/);
  assert.match(hook, /layer\.contains/);
  assert.match(uiIndex, /ui-overlay\/useDismissibleLayer/);
});

test("brand, add, permission and runtime-control popovers reuse the shared dismiss behavior", () => {
  const uses = workbench.match(/useDismissibleLayer</g) ?? [];
  assert.ok(uses.length >= 4, `expected >=4 shared dismiss layers, got ${uses.length}`);
  for (const token of ["brandMenuRef", "addMenuRef", "permissionMenuRef", "runtimeControlRef"]) {
    assert.match(workbench, new RegExp(token));
  }
});
