import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkbenchLayoutMetrics, resolveWorkbenchV3InitialLeftWidth } from "../../../packages/client/ui-dockkit/src/workbench-layout.config.ts";
import { readWorkbenchLeftWidth, WORKBENCH_LEFT_WIDTH_KEY } from "../../../packages/client/ui-dockkit/src/workbench-preferences.ts";

function withStoredWidths(entries, callback) {
  const values = new Map(Object.entries(entries));
  const localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  try {
    callback(values);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  }
}

test("新左栏初始宽在宽屏与窄屏都等于当前最小宽", () => {
  for (const [width, responsiveRightDock] of [[1856, true], [1856, false], [1216, true], [696, true]]) {
    const metrics = resolveWorkbenchLayoutMetrics(width, 900, responsiveRightDock);
    assert.equal(metrics.left.initial, metrics.left.min, `${width}px 容器的默认左栏应等于最小宽`);
  }
});

test("旧 v3 默认宽度迁移到最小宽而手动宽度保持不变", () => {
  const containerWidth = 1856;
  const limits = resolveWorkbenchLayoutMetrics(containerWidth, 1080, true).left;
  const oldDefault = resolveWorkbenchV3InitialLeftWidth(containerWidth);
  assert.equal(oldDefault, 297);
  assert.equal(limits.min, 278);

  withStoredWidths({ "lfaa.workbench.left-width.v3": String(oldDefault) }, values => {
    assert.equal(readWorkbenchLeftWidth(limits, containerWidth), limits.min);
    assert.equal(values.get(WORKBENCH_LEFT_WIDTH_KEY), String(limits.min));
  });

  withStoredWidths({ "lfaa.workbench.left-width.v3": "320" }, values => {
    assert.equal(readWorkbenchLeftWidth(limits, containerWidth), 320);
    assert.equal(values.get(WORKBENCH_LEFT_WIDTH_KEY), "320");
  });
});
