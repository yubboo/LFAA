// 验证左右栏与底部面板统一预览线拖拽、阻尼吸附纯函数、左栏 CollapsePane 包裹与过渡样式契约。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  computeKeyVerticalResizeHeight,
  computeVerticalPreviewOffset,
  computeVerticalResizeOutcome,
  hasExceededVerticalDragThreshold,
} from "../client/shell/vertical-resize";

test("底部面板纵向拖拽在 50% 阈值以下触发磁吸收起，阻尼区按 0.3 弹性缩放", () => {
  const normal = computeVerticalResizeOutcome({ rawHeight: 320, minHeight: 160, maxHeight: 560 });
  assert.deepEqual(normal, { snappedCollapsed: false, height: 320, visualHeight: 320, tension: 0 });

  const clampedMax = computeVerticalResizeOutcome({ rawHeight: 800, minHeight: 160, maxHeight: 560 });
  assert.equal(clampedMax.height, 560);
  assert.equal(clampedMax.visualHeight, 560);
  assert.equal(clampedMax.tension, 0);

  // 最小 160px、50% 吸附线 80px；拖到 120px 时张力为 0.5，视觉高度 160 - 40 * 0.3 = 148。
  const elastic = computeVerticalResizeOutcome({ rawHeight: 120, minHeight: 160, maxHeight: 560 });
  assert.equal(elastic.snappedCollapsed, false);
  assert.equal(elastic.height, 160);
  assert.equal(elastic.visualHeight, 148);
  assert.equal(elastic.tension, 0.5);

  const snapped = computeVerticalResizeOutcome({ rawHeight: 79, minHeight: 160, maxHeight: 560 });
  assert.deepEqual(snapped, { snappedCollapsed: true, height: 160, visualHeight: 0, tension: 1 });

  // 滞回区间：已吸附时回拉到 85px 仍保持吸附，越过 80 + 14 = 94px 才退出吸附。
  const hysteresis = computeVerticalResizeOutcome({ rawHeight: 85, minHeight: 160, maxHeight: 560, wasCollapsed: true });
  assert.equal(hysteresis.snappedCollapsed, true);
  const reopened = computeVerticalResizeOutcome({ rawHeight: 95, minHeight: 160, maxHeight: 560, wasCollapsed: true });
  assert.equal(reopened.snappedCollapsed, false);
});

test("纵向预览线偏移与键盘调高步进正确计算", () => {
  assert.equal(computeVerticalPreviewOffset(260, 340, false), -80);
  assert.equal(computeVerticalPreviewOffset(260, 180, false), 80);
  assert.equal(computeVerticalPreviewOffset(260, 0, true), 260);
  assert.equal(hasExceededVerticalDragThreshold(100, 102), false);
  assert.equal(hasExceededVerticalDragThreshold(100, 103), true);

  assert.equal(
    computeKeyVerticalResizeHeight({ key: "ArrowUp", shiftKey: false, currentHeight: 260, minHeight: 160, maxHeight: 560 }),
    276,
  );
  assert.equal(
    computeKeyVerticalResizeHeight({ key: "ArrowDown", shiftKey: true, currentHeight: 180, minHeight: 160, maxHeight: 560 }),
    160,
  );
});

test("左二栏已包 CollapsePane，实时跟手拖拽在跨吸附阈值时开启平滑过渡且不再瞬间 visibility:hidden", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const [leftColTsx, handleCss, shellCss, shellTsx] = await Promise.all([
    readFile(resolve(packageRoot, "client/shell/ShellLeftColumn.tsx"), "utf8"),
    readFile(resolve(packageRoot, "client/shell/ResizeHandle.module.css"), "utf8"),
    readFile(resolve(packageRoot, "client/shell/WorkbenchShell.module.css"), "utf8"),
    readFile(resolve(packageRoot, "client/shell/WorkbenchShell.tsx"), "utf8"),
  ]);

  assert.match(leftColTsx, /<CollapsePane[\s\S]*side="left"[\s\S]*className=\{styles\.leftPane\}/u);
  assert.match(shellCss, /\.shell\[data-resizing="true"\]\[data-resize-snap-anim="true"\]\s*\{[^}]*transition:\s*grid-template-columns/u);
  assert.match(shellCss, /\.shell\[data-resizing="true"\]\s*>\s*\.workspace[\s\S]*contain:\s*layout style;/u);
  assert.match(handleCss, /pointer-events:\s*none;/u);
  assert.doesNotMatch(handleCss, /visibility:\s*hidden;/u);
  // 吸附收起松手时不再禁用轨道过渡，避免中途松手时闪断。
  assert.doesNotMatch(shellTsx, /handleDragCollapse[\s\S]*?suspendPaneMotion\(\)/u);
});
