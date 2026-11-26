// 用户菜单浮层几何单测：卡片宽度必须跟着左二栏走，不能盖到中间会话区。
import assert from "node:assert/strict";
import test from "node:test";
import { resolveUserMenuGeometry, USER_MENU_MAX_WIDTH } from "../client/navigation/user-menu-geometry";

const trigger = { left: 13, right: 37, bottom: 884, width: 24 };
const column = (left: number, width: number) => ({ left, right: left + width, bottom: 900, width });

test("左二栏展开时卡片贴左边线（2px）、右边给滚动条让位（12px），宽度取栏内宽", () => {
  const geometry = resolveUserMenuGeometry({ trigger, column: column(50, 273), viewportWidth: 1829, viewportHeight: 900 });
  assert.equal(geometry.left, 52);
  assert.equal(geometry.width, 259);
  assert.equal(geometry.left + geometry.width, 311);
  assert.ok(geometry.left + geometry.width <= 50 + 273);
});

test("栏宽超过上限时卡片封顶 21.5rem，不随栏无限变宽", () => {
  const geometry = resolveUserMenuGeometry({ trigger, column: column(50, 600), viewportWidth: 2400, viewportHeight: 900 });
  assert.equal(geometry.width, USER_MENU_MAX_WIDTH);
});

test("栏比常规窄时卡片继续收窄，但仍给出正宽度", () => {
  const geometry = resolveUserMenuGeometry({ trigger, column: column(50, 146), viewportWidth: 1024, viewportHeight: 800 });
  assert.equal(geometry.left, 52);
  assert.equal(geometry.width, 132);
  assert.ok(geometry.width > 0);
});

test("左二栏收起（无栏）时退回贴着图标栏的独立浮层", () => {
  const geometry = resolveUserMenuGeometry({ trigger, column: null, viewportWidth: 1440, viewportHeight: 900 });
  assert.equal(geometry.left, 45);
  assert.equal(geometry.width, USER_MENU_MAX_WIDTH);
});

test("无栏且视口很窄时，卡片宽度按剩余空间收缩且不为负", () => {
  const geometry = resolveUserMenuGeometry({ trigger, column: column(50, 0), viewportWidth: 120, viewportHeight: 700 });
  assert.equal(geometry.width, 67);
  const cramped = resolveUserMenuGeometry({ trigger, column: null, viewportWidth: 40, viewportHeight: 700 });
  assert.equal(cramped.width, 0);
});

test("卡片底边始终留出视口下边距", () => {
  assert.equal(resolveUserMenuGeometry({ trigger, column: column(50, 273), viewportWidth: 1440, viewportHeight: 900 }).bottom, 16);
  const lowTrigger = { ...trigger, bottom: 898 };
  assert.equal(resolveUserMenuGeometry({ trigger: lowTrigger, column: column(50, 273), viewportWidth: 1440, viewportHeight: 900 }).bottom, 8);
});
