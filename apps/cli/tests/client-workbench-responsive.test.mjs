/**
 * 功能：锁定 AI Work 窄屏工作台的最小中心宽度与通用 Surface 断点隔离。
 * 作用：防止应用右 Dock 改动意外压窄 Settings 等复用 ResizableWorkbench 的单栏页面。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkbenchLayoutMetrics, shouldDockResponsiveLeftPane, shouldDockResponsiveRightPane, WORKBENCH_LAYOUT_TOKENS } from "../../../packages/client/ui-dockkit/src/workbench-layout.config.ts";

test("AI Work 在 Compact/Mobile 保留 260px 中心下限，通用 Surface 保持原断点", () => {
  const applicationCompact = resolveWorkbenchLayoutMetrics(850, 800, true);
  assert.equal(applicationCompact.mode, "compact");
  assert.equal(applicationCompact.minCenterWidth, 260);

  const applicationMobile = resolveWorkbenchLayoutMetrics(488, 800, true);
  assert.equal(applicationMobile.mode, "mobile");
  assert.equal(applicationMobile.minCenterWidth, 260);

  const sharedWorkbench = resolveWorkbenchLayoutMetrics(850, 800);
  assert.equal(sharedWorkbench.mode, "compact");
  assert.equal(sharedWorkbench.minCenterWidth, 440);
});

test("响应式应用工作区仅在中心区和左栏下限都放得下时将二级导航改为 Dock", () => {
  assert.equal(shouldDockResponsiveLeftPane(750, 260, 200, true), true);
  assert.equal(shouldDockResponsiveLeftPane(488, 260, 200, true), true);
  assert.equal(shouldDockResponsiveLeftPane(460, 260, 200, true), false);
  assert.equal(shouldDockResponsiveLeftPane(750, 260, 200, false), false);
});

test("Mobile 左导航 Dock 复用大屏标准分隔条宽度", () => {
  assert.equal(WORKBENCH_LAYOUT_TOKENS.separator, 1);
  assert.equal(shouldDockResponsiveLeftPane(461, 260, 200, true), true);
  assert.equal(shouldDockResponsiveLeftPane(460, 260, 200, true), false);
});

test("Compact/Mobile 右栏空间足够时沿用共享 Dock 与拉伸预算", () => {
  assert.equal(WORKBENCH_LAYOUT_TOKENS.center.applicationRightDockFloor, 220);
  assert.equal(shouldDockResponsiveRightPane(448, 260, 228, 0, true), false);
  assert.equal(shouldDockResponsiveRightPane(449, 260, 228, 0, true), true);
  assert.equal(shouldDockResponsiveRightPane(466, 260, 228, 0, true), true);
  assert.equal(shouldDockResponsiveRightPane(649, 260, 228, 200, true), false);
  assert.equal(shouldDockResponsiveRightPane(650, 260, 228, 200, true), true);
  assert.equal(shouldDockResponsiveRightPane(850, 440, 228, 0, true), true);
  assert.equal(shouldDockResponsiveRightPane(850, 440, 228, 0, false), false);
});

test("极窄屏右栏才退回共享 Overlay", () => {
  assert.equal(shouldDockResponsiveRightPane(342, 260, 228, 0, true), false);
  assert.equal(shouldDockResponsiveRightPane(272, 260, 228, 0, true), false);
});

test("窄屏导航使用 Overlay，中屏导航 Dock 后保留完整中心区", () => {
  const cases = [
    { viewportWidth: 320, railWidth: 48, expected: "overlay", mode: "mobile" },
    { viewportWidth: 390, railWidth: 48, expected: "overlay", mode: "mobile" },
    { viewportWidth: 530, railWidth: 64, expected: "dock", mode: "mobile" },
    { viewportWidth: 626, railWidth: 64, expected: "dock", mode: "mobile" },
    { viewportWidth: 753, railWidth: 64, expected: "dock", mode: "mobile" },
    { viewportWidth: 754, railWidth: 64, expected: "dock", mode: "compact" },
  ];

  for (const { viewportWidth, railWidth, expected, mode } of cases) {
    const containerWidth = viewportWidth - railWidth;
    const metrics = resolveWorkbenchLayoutMetrics(containerWidth, 740, true);
    assert.equal(metrics.mode, mode, `${viewportWidth}px viewport should use ${mode} workbench rules`);
    assert.equal(
      shouldDockResponsiveLeftPane(containerWidth, metrics.minCenterWidth, metrics.left.min, true),
      expected === "dock",
      `${viewportWidth}px viewport should choose ${expected}`,
    );
    if (mode === "compact") {
      const threePaneMinimum = metrics.left.min + metrics.minCenterWidth + metrics.right.min + WORKBENCH_LAYOUT_TOKENS.separator * 2;
      assert.ok(threePaneMinimum <= containerWidth, `${viewportWidth}px viewport should preserve all three compact pane minima`);
    }
  }
});
