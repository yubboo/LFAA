// 验证账号菜单里的三档外观开关：档位顺序、当前选中项、图标随解析出的明暗切换。
import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppearanceMode } from "../contract/index";
import type { AppearanceStore } from "../client/appearance-store";

// Node 测试环境没有自动注入 React（项目走 classic JSX 运行时），先挂到全局。
(globalThis as { React?: typeof React }).React = React;

const { ThemeModeQuickSwitch } = await import("../client/components/ThemeModeQuickSwitch");

// 测试只要用到开关相关的几条文案，其余键交给断言里不关心它的组件。
const locale = {
  quickThemeSwitch: "切换外观模式",
  darkModeLabel: "深色模式",
  system: "跟随系统",
  lightModeLabel: "浅色模式",
} as unknown as import("../client/locales").ThemeLocaleMessages;

/** 只记录切换结果的最小 store 替身，组件只用 setMode。 */
function fakeStore(): AppearanceStore & { writed: AppearanceMode[] } {
  const writed: AppearanceMode[] = [];
  return {
    writed,
    setMode: (mode: AppearanceMode) => { writed.push(mode); },
  } as unknown as AppearanceStore & { writed: AppearanceMode[] };
}

function render(mode: AppearanceMode, resolvedScheme: "light" | "dark"): string {
  return renderToStaticMarkup(createElement(ThemeModeQuickSwitch, {
    locale,
    store: fakeStore(),
    mode,
    resolvedScheme,
  }));
}

test("三档按「深色 / 跟随系统 / 浅色」从左到右排列，只有当前档位被选中", () => {
  const html = render("system", "light");
  const labels = [...html.matchAll(/role="radio"[^>]*aria-label="([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(labels, ["深色模式", "跟随系统", "浅色模式"]);
  assert.equal((html.match(/aria-checked="true"/gu) ?? []).length, 1);
  assert.ok(html.includes('data-stop="1"'), "跟随系统应停在中间档");
  assert.equal((html.match(/role="radio"/gu) ?? []).length, 3);
});

test("滑块位置随档位从左（0）到右（2）", () => {
  assert.ok(render("dark", "dark").includes('data-stop="0"'));
  assert.ok(render("system", "dark").includes('data-stop="1"'));
  assert.ok(render("light", "light").includes('data-stop="2"'));
});

test("图标跟随解析出的明暗：深色是月亮，浅色是太阳", () => {
  assert.ok(render("dark", "dark").includes('data-glyph="moon"'));
  assert.ok(render("light", "light").includes('data-glyph="sun"'));
  // 跟随系统时按系统实际解析值取图标，而不是固定月亮。
  assert.ok(render("system", "light").includes('data-glyph="sun"'));
  assert.ok(render("system", "dark").includes('data-glyph="moon"'));
});

test("开关本身不再带下拉菜单标记，避免和旧胶囊残留混淆", () => {
  const html = render("dark", "dark");
  assert.ok(!html.includes("menuitemradio"));
  assert.ok(!html.includes("data-theme-quick-menu"));
});