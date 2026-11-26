// 模式菜单浮层几何单测：卡片必须落在左二栏内，宽度跟栏走且不压住会话区。
import assert from "node:assert/strict";
import test from "node:test";
import { resolveModeMenuGeometry } from "../client/navigation/mode-menu-geometry";
import { POPOVER_MAX_WIDTH } from "../client/navigation/popover-geometry";

const trigger = { left: 63.8, right: 95.8, bottom: 44, width: 32 };
const column = (left: number, width: number) => ({ left, right: left + width, bottom: 900, width });

test("1440 窗：卡片贴左二栏左边线 2px，右边给滚动条让位 12px", () => {
  const geometry = resolveModeMenuGeometry({ trigger, column: column(50, 208.5), viewportWidth: 1440 });
  assert.equal(geometry.left, 52);
  assert.equal(geometry.width, 194.5);
  assert.equal(geometry.left + geometry.width, 246.5);
  assert.ok(geometry.left + geometry.width <= 50 + 208.5 - 12);
});

test("卡片顶部在触发按钮下方 8px", () => {
  const geometry = resolveModeMenuGeometry({ trigger, column: column(50, 208.5), viewportWidth: 1440 });
  assert.equal(geometry.top, 52);
});

test("栏宽超过上限时卡片封顶 21.5rem，不随栏无限变宽", () => {
  const geometry = resolveModeMenuGeometry({ trigger, column: column(50, 600), viewportWidth: 2400 });
  assert.equal(geometry.width, POPOVER_MAX_WIDTH);
});

test("1024 窗窄栏下卡片继续收窄，但仍给出正宽度", () => {
  const geometry = resolveModeMenuGeometry({ trigger, column: column(50, 146.09), viewportWidth: 1024 });
  assert.equal(geometry.left, 52);
  assert.equal(geometry.width, 132.09);
  assert.ok(geometry.width > 0);
});

test("左二栏缺席时退回贴着触发按钮右侧的独立浮层", () => {
  const geometry = resolveModeMenuGeometry({ trigger, column: null, viewportWidth: 1440 });
  assert.equal(geometry.left, 103.8);
  assert.equal(geometry.width, POPOVER_MAX_WIDTH);
});

test("无栏且视口很窄时，卡片宽度按剩余空间收缩且不为负", () => {
  const geometry = resolveModeMenuGeometry({ trigger: { ...trigger, right: 120 }, column: null, viewportWidth: 160 });
  assert.equal(geometry.width, 24);
  const cramped = resolveModeMenuGeometry({ trigger: { ...trigger, right: 150 }, column: null, viewportWidth: 40 });
  assert.equal(cramped.width, 0);
});