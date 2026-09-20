import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hook = readFileSync(new URL("../packages/client/ui/src/ui-overlay/useDismissibleLayer.ts", import.meta.url), "utf8");
const uiIndex = readFileSync(new URL("../packages/client/ui/src/index.ts", import.meta.url), "utf8");
const leftSidebar = readFileSync(new URL("../packages/client/app-shell/src/workbench/left/view/LeftSidebarRegion.tsx", import.meta.url), "utf8");
const addMenu = readFileSync(new URL("../packages/client/app-shell/src/workbench/center/composer/view/AddCapabilityMenu.tsx", import.meta.url), "utf8");
const permissionControl = readFileSync(new URL("../packages/client/app-shell/src/workbench/center/composer/view/PermissionControl.tsx", import.meta.url), "utf8");
const runtimeControl = readFileSync(new URL("../packages/client/app-shell/src/workbench/center/composer/runtime-control/view/RuntimeControl.tsx", import.meta.url), "utf8");
const workbenchPopoverModules = [leftSidebar, addMenu, permissionControl, runtimeControl].join("\n");

test("shared ui-overlay dismissible layer owns outside-pointer and Escape behavior", () => {
  assert.match(hook, /document\.addEventListener\("pointerdown", onPointerDown, true\)/);
  assert.match(hook, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(hook, /event\.composedPath/);
  assert.match(hook, /layer\.contains/);
  assert.match(uiIndex, /ui-overlay\/useDismissibleLayer/);
});

test("brand, add, permission and runtime-control popovers reuse the shared dismiss behavior", () => {
  const uses = workbenchPopoverModules.match(/useDismissibleLayer</g) ?? [];
  assert.ok(uses.length >= 4, `expected >=4 shared dismiss layers, got ${uses.length}`);
  for (const token of ["brandMenuRef", "useDismissibleLayer<HTMLDivElement>", "runtimeControlRef"]) {
    assert.match(workbenchPopoverModules, new RegExp(token));
  }
  assert.match(addMenu, /useDismissibleLayer<HTMLDivElement>/);
  assert.match(permissionControl, /useDismissibleLayer<HTMLDivElement>/);
});
