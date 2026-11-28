// 更多应用菜单浮层几何单测：卡片必须落在左二栏内，宽度跟栏走且不压住中间会话区。
import assert from "node:assert/strict";
import test from "node:test";
import { APP_MENU_ESTIMATED_HEIGHT, resolveAppMenuGeometry } from "../client/navigation/app-menu-geometry";
import { POPOVER_MAX_WIDTH } from "../client/navigation/popover-geometry";

const trigger = { left: 7, right: 43, top: 268, bottom: 304, width: 36 };
const column = (left: number, width: number) => ({ left, right: left + width, bottom: 900, width });

test("左二栏展开时卡片贴左边线（2px）、右边给滚动条让位（12px），宽度取栏内宽", () => {
  const geometry = resolveAppMenuGeometry({ trigger, column: column(50, 273), viewportWidth: 1829, viewportHeight: 900 });
  assert.equal(geometry.left, 52);
  assert.equal(geometry.top, 268);
  assert.equal(geometry.width, 259);
  assert.equal(geometry.left + geometry.width, 311);
  assert.ok(geometry.left + geometry.width <= 50 + 273 - 12);
});

test("栏宽超过上限时卡片封顶 21.5rem，不随栏无限变宽", () => {
  const geometry = resolveAppMenuGeometry({ trigger, column: column(50, 600), viewportWidth: 2400, viewportHeight: 900 });
  assert.equal(geometry.width, POPOVER_MAX_WIDTH);
});

test("1024 窗窄栏下卡片继续收窄，但仍给出正宽度", () => {
  const geometry = resolveAppMenuGeometry({ trigger, column: column(50, 146), viewportWidth: 1024, viewportHeight: 800 });
  assert.equal(geometry.left, 52);
  assert.equal(geometry.width, 132);
  assert.ok(geometry.width > 0);
});

test("左二栏收起（无栏）时退回贴着图标栏右侧 8px 的独立浮层", () => {
  const geometry = resolveAppMenuGeometry({ trigger, column: null, viewportWidth: 1440, viewportHeight: 900 });
  assert.equal(geometry.left, 51);
  assert.equal(geometry.width, POPOVER_MAX_WIDTH);
});

test("无栏且视口很窄时，卡片宽度按剩余空间收缩且不为负", () => {
  const geometry = resolveAppMenuGeometry({ trigger, column: column(50, 0), viewportWidth: 120, viewportHeight: 700 });
  assert.equal(geometry.width, 61);
  const cramped = resolveAppMenuGeometry({ trigger, column: null, viewportWidth: 40, viewportHeight: 700 });
  assert.equal(cramped.width, 0);
});

test("短视口下顶边自动向上夹紧，并保留顶部与底部安全间距", () => {
  const clamped = resolveAppMenuGeometry({ trigger: { ...trigger, top: 420 }, column: column(50, 220), viewportWidth: 1440, viewportHeight: 500 });
  assert.equal(clamped.top, 500 - APP_MENU_ESTIMATED_HEIGHT - 8);
  const tiny = resolveAppMenuGeometry({ trigger: { ...trigger, top: 2 }, column: column(50, 220), viewportWidth: 1440, viewportHeight: 200 });
  assert.equal(tiny.top, 8);
});
