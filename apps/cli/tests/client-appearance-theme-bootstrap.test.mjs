/**
 * 功能：回归验证刷新前的浅色/深色主题提示。
 * 作用：保证标签页提示只接受现有主题枚举、system 遵循系统主题且存储失败不阻断权威设置应用。
 * 关联文件：packages/client/ui-theme/src/appearance-theme-bootstrap.ts、apps/web/index.html、ui-layout/src/Workbench.tsx。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY,
  applyAppearanceThemeBootstrap,
  clearAppearanceThemeBootstrap,
  readAppearanceThemeBootstrap,
  resolveAppearanceThemeBootstrap
} from "../../../packages/client/ui-theme/src/appearance-theme-bootstrap.ts";

function createStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY, initial);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}

test("只接受已有的 light、dark、system 主题值", () => {
  for (const value of ["light", "dark", "system"]) {
    assert.equal(readAppearanceThemeBootstrap(createStorage(value)), value);
  }
  for (const value of [null, "auto", "invalid"]) {
    assert.equal(readAppearanceThemeBootstrap(createStorage(value)), null);
  }
});

test("system 主题按当前系统明暗解析", () => {
  assert.equal(resolveAppearanceThemeBootstrap("system", true), "dark");
  assert.equal(resolveAppearanceThemeBootstrap("system", false), "light");
  assert.equal(resolveAppearanceThemeBootstrap("dark", false), "dark");
  assert.equal(resolveAppearanceThemeBootstrap("light", true), "light");
});

test("应用设置主题时更新首帧提示与浏览器画布色", () => {
  const storage = createStorage();
  const root = { dataset: {}, style: { colorScheme: "" }, removeAttribute() { delete this.dataset.lfaaBootstrapTheme; } };
  const themeColorMeta = { content: "" };
  applyAppearanceThemeBootstrap("system", "dark", { storage, root, themeColorMeta });

  assert.equal(storage.getItem(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY), "system");
  assert.equal(root.dataset.lfaaBootstrapTheme, "dark");
  assert.equal(root.style.colorScheme, "dark");
  assert.equal(themeColorMeta.content, "#181818");

  clearAppearanceThemeBootstrap({ storage, root, themeColorMeta });
  assert.equal(storage.getItem(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY), null);
  assert.equal(root.dataset.lfaaBootstrapTheme, undefined);
  assert.equal(root.style.colorScheme, "");
  assert.equal(themeColorMeta.content, "#f3f5f8");
});

test("标签页存储异常不会阻断当前主题应用", () => {
  const blockedStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); }
  };
  const root = { dataset: {}, style: { colorScheme: "" }, removeAttribute() { delete this.dataset.lfaaBootstrapTheme; } };
  assert.equal(readAppearanceThemeBootstrap(blockedStorage), null);
  assert.doesNotThrow(() => applyAppearanceThemeBootstrap("dark", "dark", { storage: blockedStorage, root }));
  assert.equal(root.dataset.lfaaBootstrapTheme, "dark");
  assert.doesNotThrow(() => clearAppearanceThemeBootstrap({ storage: blockedStorage, root }));
});
