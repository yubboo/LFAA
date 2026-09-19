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

test("snap capture 保持 Pointer 不松手可反向释放", () => {
  assert.match(workbench, /drag\.snapped && raw >= drag\.min \+ snapHysteresis/);
  assert.match(workbench, /wasSnapped && !drag\.snapped/);
  assert.match(workbench, /beginSnapRelease\(drag\.side\)/);
});

test("反向拉出只启用短暂 release 动画，不永久给拖拽加 transition", () => {
  assert.match(workbench, /data-snap-release="none"/);
  assert.match(workbench, /window\.setTimeout\(\(\) => \{/);
  assert.match(workbench, /}, 150\)/);
  assert.match(css, /data-snap-release="left"/);
  assert.match(css, /grid-template-columns 150ms cubic-bezier\(\.22, 1, \.36, 1\)/);
  assert.match(css, /\.lfaa-is-resizing \.lfaa-workbench[\s\S]*transition: none/);
});

test("右栏与底部复用同一反向释放规则", () => {
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
