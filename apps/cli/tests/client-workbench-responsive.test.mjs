/**
 * 功能：锁定 AI Work 窄屏工作台的最小中心宽度与通用 Surface 断点隔离。
 * 作用：防止应用右 Dock 改动意外压窄 Settings 等复用 ResizableWorkbench 的单栏页面。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkbenchLayoutMetrics } from "../../../packages/client/ui-dockkit/src/workbench-layout.config.ts";

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
