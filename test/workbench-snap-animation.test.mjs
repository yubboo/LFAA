/**
 * 文件：workbench-snap-animation.test.mjs
 * 作用：防回归检查工作台吸附收起与反向拉出时的短过渡状态。
 * 负责：确保 Pointer 未松手时 snap capture 可反向释放，且 release 动画只短暂存在，不破坏普通 resize 跟手。
 * 不负责：替代浏览器真实拖拽手感与用户视觉验收。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workbench = fs.readFileSync("packages/ui/src/workbench/ResizableWorkbench.tsx", "utf8");
const css = fs.readFileSync("packages/ui/src/workbench/workbench.css", "utf8");
const interaction = fs.readFileSync("packages/ui/src/workbench/workbench-interaction.config.ts", "utf8");
const layout = fs.readFileSync("packages/ui/src/workbench/workbench-layout.config.ts", "utf8");

test("snap capture 不再在 min 立即触发，而是使用 capture threshold", () => {
  assert.doesNotMatch(workbench, /!drag\.snapped && raw <= drag\.min/);
  assert.match(workbench, /!drag\.snapped && raw <= drag\.captureThreshold/);
  assert.match(workbench, /resolveSnapCaptureThreshold\(effectiveMin, snapCaptureRatio\)/);
  assert.match(workbench, /clamp\(raw, drag\.captureThreshold, drag\.max\)/);
});

test("默认 captureRatio 为 0.50 且集中配置有中文说明", () => {
  assert.match(interaction, /captureRatio:\s*0\.50/);
  assert.match(interaction, /minWidth × captureRatio/);
  assert.match(interaction, /默认 0\.50 = 到最小宽度的一半才吸附/);
  assert.match(layout, /snapCaptureRatio/);
});

test("snap capture 保持 Pointer 不松手可反向释放", () => {
  assert.match(workbench, /drag\.snapped && raw >= drag\.min \+ snapHysteresis/);
  assert.match(workbench, /wasSnapped && !drag\.snapped/);
  assert.match(workbench, /beginSnapRelease\(drag\.side\)/);
});

test("反向拉出只启用短暂 release 动画，不永久给拖拽加 transition", () => {
  assert.match(workbench, /data-snap-release="none"/);
  assert.match(workbench, /window\.setTimeout\(\(\) => \{/);
  assert.match(workbench, /snapReleaseDurationMs/);
  assert.match(css, /data-snap-release="left"/);
  assert.match(css, /grid-template-columns var\(--lfaa-snap-release-duration\)/);
  assert.match(css, /var\(--lfaa-snap-capture-duration\)/);
  assert.match(css, /\.lfaa-is-resizing \.lfaa-workbench[\s\S]*transition: none/);
});

test("左栏、右栏与底部复用同一 capture / 反向释放规则", () => {
  assert.ok((workbench.match(/raw <= drag\.captureThreshold/g) ?? []).length >= 2);
  assert.match(workbench, /resolveSnapCaptureThreshold\(bottomLimits\.min, snapCaptureRatio\)/);
  assert.match(css, /data-snap-release="right"/);
  assert.match(css, /data-snap-release="bottom"/);
  assert.match(workbench, /beginSnapRelease\("bottom"\)/);
});

test("减少动态效果偏好会关闭过渡", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition-duration: 0ms !important/);
});


test("ResizableWorkbench 支持受控 leftWidth，供多个 Surface 共用宽度事实源", () => {
  assert.match(workbench, /leftWidth: leftWidthProp/);
  assert.match(workbench, /const leftWidth = leftWidthProp \?\? internalLeftWidth/);
  assert.match(workbench, /setResolvedLeftWidth/);
});
